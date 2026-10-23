const express = require('express');
const db = require('../db');
const { authRequired, requireRole } = require('../middleware/auth');
const { distanceKm } = require('../services/geo');
const { logAudit } = require('../services/audit');
const { isValidCoordinate } = require('../middleware/validate');

const router = express.Router();

// Helper to find the nearest available ambulance to pickup coordinates, optionally excluding an ID
function findNearestAvailableAmbulance(pickupLat, pickupLng, excludeId = null) {
  let query = "SELECT * FROM ambulances WHERE status = 'AVAILABLE'";
  const params = [];
  if (excludeId) {
    query += ' AND ambulance_id != ?';
    params.push(excludeId);
  }
  const availableAmbulances = db.prepare(query).all(...params);
  if (!availableAmbulances.length) return null;

  if (pickupLat !== null && pickupLat !== undefined && pickupLng !== null && pickupLng !== undefined) {
    let nearest = null;
    let minDistance = Infinity;

    for (const amb of availableAmbulances) {
      const dist = distanceKm(pickupLat, pickupLng, amb.latitude, amb.longitude);
      const effectiveDist = dist !== null ? dist : 99999;
      if (effectiveDist < minDistance) {
        minDistance = effectiveDist;
        nearest = amb;
      } else if (effectiveDist === minDistance && nearest && amb.ambulance_id < nearest.ambulance_id) {
        nearest = amb;
      }
    }
    return nearest || availableAmbulances[0];
  }

  // Fallback: lowest id
  availableAmbulances.sort((a, b) => a.ambulance_id - b.ambulance_id);
  return availableAmbulances[0];
}

// Restricted to ADMIN and AMBULANCE
router.get('/', authRequired, requireRole('ADMIN', 'AMBULANCE'), (req, res) => {
  res.json(db.prepare('SELECT * FROM ambulances').all());
});

// Admin registers a new ambulance
router.post('/', authRequired, requireRole('ADMIN'), (req, res) => {
  const { vehicle_no, driver_name, driver_phone, status = 'AVAILABLE', latitude = null, longitude = null } = req.body;
  if (!vehicle_no?.trim()) return res.status(400).json({ error: 'vehicle_no is required' });
  const allowedStatuses = ['AVAILABLE', 'ON_TRIP', 'OFFLINE'];
  if (!allowedStatuses.includes(status)) return res.status(400).json({ error: 'Invalid ambulance status' });

  if ((latitude !== null && latitude !== undefined) || (longitude !== null && longitude !== undefined)) {
    if (!isValidCoordinate(latitude, longitude)) {
      return res.status(400).json({ error: 'Valid latitude and longitude are required' });
    }
  }

  const info = db.prepare(`
    INSERT INTO ambulances (vehicle_no, driver_name, driver_phone, status, latitude, longitude)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(vehicle_no.trim(), driver_name || null, driver_phone || null, status, latitude ?? null, longitude ?? null);

  logAudit(db, {
    user_id: req.user.user_id,
    action: 'CREATE',
    entity: 'ambulances',
    entity_id: info.lastInsertRowid,
  });

  res.status(201).json(db.prepare('SELECT * FROM ambulances WHERE ambulance_id = ?').get(info.lastInsertRowid));
});

// Patient requests an ambulance - automatically assigns nearest available vehicle
router.post('/requests', authRequired, requireRole('PATIENT'), (req, res) => {
  const { pickup_location, pickup_lat, pickup_lng, drop_location, drop_hospital_id } = req.body;
  if (!pickup_location || !String(pickup_location).trim()) {
    return res.status(400).json({ error: 'pickup_location is required' });
  }

  const lat = pickup_lat !== undefined && pickup_lat !== null ? Number(pickup_lat) : null;
  const lng = pickup_lng !== undefined && pickup_lng !== null ? Number(pickup_lng) : null;

  if ((lat !== null || lng !== null) && !isValidCoordinate(lat, lng)) {
    return res.status(400).json({ error: 'Invalid pickup coordinates' });
  }

  const createReqTx = db.transaction(() => {
    let reqStatus = 'REQUESTED';
    let assignedAmbulanceId = null;

    // Concurrency-safe atomic assignment loop
    let candidate = findNearestAvailableAmbulance(lat, lng);
    while (candidate) {
      const updateRes = db.prepare("UPDATE ambulances SET status = 'ON_TRIP' WHERE ambulance_id = ? AND status = 'AVAILABLE'")
        .run(candidate.ambulance_id);
      if (updateRes.changes === 1) {
        reqStatus = 'ACCEPTED';
        assignedAmbulanceId = candidate.ambulance_id;
        break;
      }
      // Contended: candidate was taken concurrently; find next nearest excluding candidate
      candidate = findNearestAvailableAmbulance(lat, lng, candidate.ambulance_id);
    }

    const info = db.prepare(`
      INSERT INTO ambulance_requests
        (patient_id, ambulance_id, pickup_location, pickup_lat, pickup_lng, drop_location, drop_hospital_id, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.user.user_id,
      assignedAmbulanceId,
      pickup_location.trim(),
      lat,
      lng,
      drop_location ? drop_location.trim() : null,
      drop_hospital_id ? Number(drop_hospital_id) : null,
      reqStatus
    );

    return { requestId: info.lastInsertRowid, assigned: Boolean(assignedAmbulanceId) };
  });

  const { requestId, assigned } = createReqTx();

  logAudit(db, {
    user_id: req.user.user_id,
    action: 'CREATE',
    entity: 'ambulance_requests',
    entity_id: requestId,
    details: { assigned },
  });

  res.status(201).json(db.prepare('SELECT * FROM ambulance_requests WHERE request_id = ?').get(requestId));
});

// List ambulance requests by role
router.get('/requests', authRequired, (req, res) => {
  let rows;
  if (req.user.role === 'PATIENT') {
    rows = db.prepare('SELECT * FROM ambulance_requests WHERE patient_id = ? ORDER BY created_at DESC').all(req.user.user_id);
  } else if (req.user.role === 'AMBULANCE') {
    if (!req.user.ambulance_id) {
      return res.status(403).json({ error: 'No ambulance assigned to this operator account' });
    }
    // Show requests assigned to this ambulance OR currently unassigned queued requests
    rows = db.prepare(`
      SELECT ar.*, u.name AS patient_name, u.phone AS patient_phone
      FROM ambulance_requests ar
      JOIN users u ON u.user_id = ar.patient_id
      WHERE ar.ambulance_id = ? OR (ar.ambulance_id IS NULL AND ar.status = 'REQUESTED')
      ORDER BY ar.created_at DESC
    `).all(req.user.ambulance_id);
  } else if (req.user.role === 'ADMIN') {
    rows = db.prepare(`
      SELECT ar.*, u.name AS patient_name, u.phone AS patient_phone, a.vehicle_no, a.driver_name
      FROM ambulance_requests ar
      JOIN users u ON u.user_id = ar.patient_id
      LEFT JOIN ambulances a ON a.ambulance_id = ar.ambulance_id
      ORDER BY ar.created_at DESC
    `).all();
  } else {
    return res.status(403).json({ error: 'Not permitted' });
  }

  // Attach ambulance information
  rows = rows.map(r => {
    if (r.ambulance_id) {
      r.ambulance = db.prepare('SELECT ambulance_id, vehicle_no, driver_name, driver_phone, status, latitude, longitude FROM ambulances WHERE ambulance_id = ?').get(r.ambulance_id);
    }
    return r;
  });

  res.json(rows);
});

// Tracking endpoint: GET /api/ambulances/requests/:id/track
router.get('/requests/:id/track', authRequired, (req, res) => {
  const request = db.prepare('SELECT * FROM ambulance_requests WHERE request_id = ?').get(req.params.id);
  if (!request) return res.status(404).json({ error: 'Ambulance request not found' });

  // Authorization: only the requesting patient, assigned ambulance operator, or admin
  const isOwner = req.user.role === 'PATIENT' && req.user.user_id === request.patient_id;
  const isOperator = req.user.role === 'AMBULANCE' && req.user.ambulance_id === request.ambulance_id;
  const isAdmin = req.user.role === 'ADMIN';

  if (!isOwner && !isOperator && !isAdmin) {
    return res.status(403).json({ error: 'You are not authorized to track this request' });
  }

  let ambulance = null;
  let distRemaining = null;
  let etaMinutes = null;

  if (request.ambulance_id) {
    ambulance = db.prepare('SELECT ambulance_id, vehicle_no, driver_name, driver_phone, status, latitude, longitude FROM ambulances WHERE ambulance_id = ?').get(request.ambulance_id);
    if (ambulance && request.pickup_lat && request.pickup_lng && ambulance.latitude && ambulance.longitude) {
      distRemaining = distanceKm(ambulance.latitude, ambulance.longitude, request.pickup_lat, request.pickup_lng);
      if (distRemaining !== null) {
        // ETA assuming 30 km/h average speed in urban traffic
        etaMinutes = Math.max(1, Math.round((distRemaining / 30) * 60));
      }
    }
  }

  // Fetch recent location history
  const history = request.ambulance_id
    ? db.prepare('SELECT latitude, longitude, recorded_at FROM ambulance_locations WHERE ambulance_id = ? ORDER BY recorded_at DESC LIMIT 50').all(request.ambulance_id)
    : [];

  res.json({
    request,
    ambulance,
    pickup_coordinates: {
      latitude: request.pickup_lat,
      longitude: request.pickup_lng,
      address: request.pickup_location,
    },
    distance_remaining_km: distRemaining,
    eta_minutes: etaMinutes,
    eta_label: 'Estimated time based on 30 km/h average urban speed. Informational only.',
    location_history: history,
  });
});

// Patient cancels own request while REQUESTED or ACCEPTED
router.put('/requests/:id/cancel', authRequired, requireRole('PATIENT'), (req, res) => {
  const request = db.prepare('SELECT * FROM ambulance_requests WHERE request_id = ?').get(req.params.id);
  if (!request) return res.status(404).json({ error: 'Request not found' });
  if (request.patient_id !== req.user.user_id) {
    return res.status(403).json({ error: 'You can only cancel your own request' });
  }

  if (!['REQUESTED', 'ACCEPTED'].includes(request.status)) {
    return res.status(409).json({ error: `Cannot cancel a trip that is currently ${request.status}` });
  }

  const cancelTx = db.transaction(() => {
    db.prepare("UPDATE ambulance_requests SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP WHERE request_id = ?").run(request.request_id);
    if (request.ambulance_id) {
      db.prepare("UPDATE ambulances SET status = 'AVAILABLE' WHERE ambulance_id = ?").run(request.ambulance_id);
    }
  });

  cancelTx();

  logAudit(db, {
    user_id: req.user.user_id,
    action: 'CANCEL',
    entity: 'ambulance_requests',
    entity_id: request.request_id,
  });

  res.json(db.prepare('SELECT * FROM ambulance_requests WHERE request_id = ?').get(request.request_id));
});

// Operator updates trip status: accept, reject, start trip (EN_ROUTE), complete
router.put('/requests/:id', authRequired, requireRole('AMBULANCE', 'ADMIN'), (req, res) => {
  const { status, action } = req.body;
  const request = db.prepare('SELECT * FROM ambulance_requests WHERE request_id = ?').get(req.params.id);
  if (!request) return res.status(404).json({ error: 'Request not found' });

  const operatorAmbId = req.user.role === 'AMBULANCE' ? req.user.ambulance_id : request.ambulance_id;

  // Handle operator REJECT action
  if (action === 'reject' || status === 'REJECTED') {
    if (req.user.role === 'AMBULANCE' && request.ambulance_id !== operatorAmbId) {
      return res.status(403).json({ error: 'Not your assigned request' });
    }

    const rejectingAmbulanceId = request.ambulance_id;
    const reassignTx = db.transaction(() => {
      // Free the rejecting ambulance
      if (rejectingAmbulanceId) {
        db.prepare("UPDATE ambulances SET status = 'AVAILABLE' WHERE ambulance_id = ?").run(rejectingAmbulanceId);
      }

      // Find next nearest ambulance excluding the rejecting one
      const nextNearest = findNearestAvailableAmbulance(request.pickup_lat, request.pickup_lng, rejectingAmbulanceId);

      if (nextNearest) {
        db.prepare("UPDATE ambulances SET status = 'ON_TRIP' WHERE ambulance_id = ?").run(nextNearest.ambulance_id);
        db.prepare("UPDATE ambulance_requests SET ambulance_id = ?, status = 'ACCEPTED', updated_at = CURRENT_TIMESTAMP WHERE request_id = ?")
          .run(nextNearest.ambulance_id, request.request_id);
      } else {
        // Queue back as REQUESTED
        db.prepare("UPDATE ambulance_requests SET ambulance_id = NULL, status = 'REQUESTED', updated_at = CURRENT_TIMESTAMP WHERE request_id = ?")
          .run(request.request_id);
      }
    });

    reassignTx();

    logAudit(db, {
      user_id: req.user.user_id,
      action: 'REJECT_AND_REASSIGN',
      entity: 'ambulance_requests',
      entity_id: request.request_id,
    });

    return res.json(db.prepare('SELECT * FROM ambulance_requests WHERE request_id = ?').get(request.request_id));
  }

  // Status transitions
  const allowed = ['ACCEPTED', 'EN_ROUTE', 'COMPLETED', 'CANCELLED'];
  if (!status || !allowed.includes(status)) {
    return res.status(400).json({ error: 'status must be one of ' + allowed.join(', ') });
  }

  const currentStatus = request.status;

  // Valid state transitions
  const validTransitions = {
    REQUESTED: ['ACCEPTED', 'CANCELLED'],
    ACCEPTED: ['EN_ROUTE', 'CANCELLED'],
    EN_ROUTE: ['COMPLETED', 'CANCELLED'],
  };

  if (!validTransitions[currentStatus] || !validTransitions[currentStatus].includes(status)) {
    return res.status(409).json({
      error: `Invalid status transition from ${currentStatus} to ${status}`
    });
  }

  const updateTx = db.transaction(() => {
    // If accepting an unassigned request
    if (status === 'ACCEPTED' && !request.ambulance_id) {
      if (!operatorAmbId) {
        throw new Error('NO_AMBULANCE_LINK');
      }
      db.prepare("UPDATE ambulances SET status = 'ON_TRIP' WHERE ambulance_id = ?").run(operatorAmbId);
      db.prepare("UPDATE ambulance_requests SET ambulance_id = ?, status = 'ACCEPTED', updated_at = CURRENT_TIMESTAMP WHERE request_id = ?")
        .run(operatorAmbId, request.request_id);
      return;
    }

    db.prepare('UPDATE ambulance_requests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE request_id = ?')
      .run(status, request.request_id);

    // Free ambulance when completed or cancelled
    if (['COMPLETED', 'CANCELLED'].includes(status) && request.ambulance_id) {
      db.prepare("UPDATE ambulances SET status = 'AVAILABLE' WHERE ambulance_id = ?").run(request.ambulance_id);
    }
  });

  try {
    updateTx();
  } catch (err) {
    if (err.message === 'NO_AMBULANCE_LINK') {
      return res.status(400).json({ error: 'Cannot accept request without a linked ambulance' });
    }
    return res.status(500).json({ error: 'Failed to update request' });
  }

  logAudit(db, {
    user_id: req.user.user_id,
    action: `STATUS_${status}`,
    entity: 'ambulance_requests',
    entity_id: request.request_id,
  });

  res.json(db.prepare('SELECT * FROM ambulance_requests WHERE request_id = ?').get(request.request_id));
});

// Operator updates live GPS location and records in ambulance_locations
router.put('/:id/location', authRequired, requireRole('AMBULANCE', 'ADMIN'), (req, res) => {
  const ambulanceId = Number(req.params.id);
  if (req.user.role === 'AMBULANCE' && req.user.ambulance_id !== ambulanceId) {
    return res.status(403).json({ error: 'You can only update your own ambulance location' });
  }

  const { latitude, longitude } = req.body;
  if (!isValidCoordinate(latitude, longitude)) {
    return res.status(400).json({ error: 'Valid latitude (-90 to 90) and longitude (-180 to 180) are required' });
  }

  const nLat = Number(latitude);
  const nLng = Number(longitude);

  const locTx = db.transaction(() => {
    // Update current location in ambulances table
    db.prepare('UPDATE ambulances SET latitude = ?, longitude = ? WHERE ambulance_id = ?').run(nLat, nLng, ambulanceId);

    // Insert history row
    db.prepare('INSERT INTO ambulance_locations (ambulance_id, latitude, longitude) VALUES (?, ?, ?)')
      .run(ambulanceId, nLat, nLng);

    // Retain only latest 200 location rows for this ambulance
    db.prepare(`
      DELETE FROM ambulance_locations
      WHERE ambulance_id = ?
      AND tracking_id NOT IN (
        SELECT tracking_id FROM ambulance_locations
        WHERE ambulance_id = ?
        ORDER BY recorded_at DESC, tracking_id DESC
        LIMIT 200
      )
    `).run(ambulanceId, ambulanceId);
  });

  locTx();

  res.json(db.prepare('SELECT * FROM ambulances WHERE ambulance_id = ?').get(ambulanceId));
});

// Update ambulance profile details
router.put('/:id/profile', authRequired, requireRole('AMBULANCE', 'ADMIN'), (req, res) => {
  const ambulanceId = Number(req.params.id);
  if (req.user.role === 'AMBULANCE' && req.user.ambulance_id !== ambulanceId) {
    return res.status(403).json({ error: 'You can only update your own ambulance details' });
  }

  const ambulance = db.prepare('SELECT * FROM ambulances WHERE ambulance_id = ?').get(ambulanceId);
  if (!ambulance) return res.status(404).json({ error: 'Ambulance not found' });

  const { vehicle_no, driver_name, driver_phone, status, latitude, longitude } = req.body;
  const allowedStatuses = ['AVAILABLE', 'ON_TRIP', 'OFFLINE'];
  if (status !== undefined && !allowedStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid ambulance status' });
  }
  if (vehicle_no !== undefined && !String(vehicle_no).trim()) {
    return res.status(400).json({ error: 'vehicle_no cannot be empty' });
  }

  db.prepare(`
    UPDATE ambulances
    SET vehicle_no = COALESCE(?, vehicle_no),
        driver_name = COALESCE(?, driver_name),
        driver_phone = COALESCE(?, driver_phone),
        status = COALESCE(?, status),
        latitude = COALESCE(?, latitude),
        longitude = COALESCE(?, longitude)
    WHERE ambulance_id = ?
  `).run(
    vehicle_no?.trim() || null,
    driver_name?.trim() || null,
    driver_phone?.trim() || null,
    status ?? null,
    latitude ?? null,
    longitude ?? null,
    ambulanceId
  );

  logAudit(db, {
    user_id: req.user.user_id,
    action: 'UPDATE_PROFILE',
    entity: 'ambulances',
    entity_id: ambulanceId,
  });

  res.json(db.prepare('SELECT * FROM ambulances WHERE ambulance_id = ?').get(ambulanceId));
});

module.exports = router;

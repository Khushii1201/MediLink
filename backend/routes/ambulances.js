const express = require('express');
const db = require('../db');
const { authRequired, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', authRequired, (req, res) => {
  res.json(db.prepare('SELECT * FROM ambulances').all());
});

router.post('/', authRequired, requireRole('ADMIN'), (req, res) => {
  const { vehicle_no, status = 'AVAILABLE', latitude = null, longitude = null } = req.body;
  if (!vehicle_no?.trim()) return res.status(400).json({ error: 'vehicle_no is required' });
  if (!['AVAILABLE', 'ON_TRIP', 'OFFLINE'].includes(status)) return res.status(400).json({ error: 'Invalid ambulance status' });
  const info = db.prepare('INSERT INTO ambulances (vehicle_no, status, latitude, longitude) VALUES (?,?,?,?)')
    .run(vehicle_no.trim(), status, latitude, longitude);
  res.status(201).json(db.prepare('SELECT * FROM ambulances WHERE ambulance_id = ?').get(info.lastInsertRowid));
});

// Patient requests an ambulance - auto-assigns nearest available one
router.post('/requests', authRequired, requireRole('PATIENT'), (req, res) => {
  const { pickup_location } = req.body;
  if (!pickup_location) return res.status(400).json({ error: 'pickup_location is required' });

  const available = db.prepare(`SELECT * FROM ambulances WHERE status = 'AVAILABLE' LIMIT 1`).get();
  const info = db.prepare('INSERT INTO ambulance_requests (patient_id, ambulance_id, pickup_location, status) VALUES (?,?,?,?)')
    .run(req.user.user_id, available ? available.ambulance_id : null, pickup_location, available ? 'ACCEPTED' : 'REQUESTED');

  if (available) db.prepare(`UPDATE ambulances SET status = 'ON_TRIP' WHERE ambulance_id = ?`).run(available.ambulance_id);

  res.status(201).json(db.prepare('SELECT * FROM ambulance_requests WHERE request_id = ?').get(info.lastInsertRowid));
});

router.get('/requests', authRequired, (req, res) => {
  let rows;
  if (req.user.role === 'PATIENT') {
    rows = db.prepare('SELECT * FROM ambulance_requests WHERE patient_id = ? ORDER BY created_at DESC').all(req.user.user_id);
  } else if (req.user.role === 'AMBULANCE') {
    rows = db.prepare('SELECT * FROM ambulance_requests WHERE ambulance_id = ? ORDER BY created_at DESC').all(req.user.ambulance_id);
  } else if (req.user.role === 'ADMIN') {
    rows = db.prepare('SELECT * FROM ambulance_requests ORDER BY created_at DESC').all();
  } else {
    return res.status(403).json({ error: 'Not permitted' });
  }
  // attach ambulance live location
  rows = rows.map(r => {
    if (r.ambulance_id) r.ambulance = db.prepare('SELECT ambulance_id, vehicle_no, status, latitude, longitude FROM ambulances WHERE ambulance_id = ?').get(r.ambulance_id);
    return r;
  });
  res.json(rows);
});

// Operator updates trip status and/or location
router.put('/requests/:id', authRequired, requireRole('AMBULANCE', 'ADMIN'), (req, res) => {
  const { status } = req.body;
  const request = db.prepare('SELECT * FROM ambulance_requests WHERE request_id = ?').get(req.params.id);
  if (!request) return res.status(404).json({ error: 'Request not found' });
  if (req.user.role === 'AMBULANCE' && req.user.ambulance_id !== request.ambulance_id) {
    return res.status(403).json({ error: 'Not your assigned request' });
  }
  const allowed = ['ACCEPTED', 'EN_ROUTE', 'COMPLETED', 'CANCELLED'];
  if (status && allowed.includes(status)) {
    if (status === 'ACCEPTED' && !request.ambulance_id) {
      const available = db.prepare(`SELECT * FROM ambulances WHERE status = 'AVAILABLE' ORDER BY ambulance_id LIMIT 1`).get();
      if (!available) return res.status(409).json({ error: 'No available ambulance to assign' });
      db.prepare(`UPDATE ambulances SET status = 'ON_TRIP' WHERE ambulance_id = ?`).run(available.ambulance_id);
      db.prepare('UPDATE ambulance_requests SET ambulance_id = ?, status = ? WHERE request_id = ?')
        .run(available.ambulance_id, status, req.params.id);
      return res.json(db.prepare('SELECT * FROM ambulance_requests WHERE request_id = ?').get(req.params.id));
    }
    db.prepare('UPDATE ambulance_requests SET status = ? WHERE request_id = ?').run(status, req.params.id);
    if (['COMPLETED', 'CANCELLED'].includes(status) && request.ambulance_id) {
      db.prepare(`UPDATE ambulances SET status = 'AVAILABLE' WHERE ambulance_id = ?`).run(request.ambulance_id);
    }
  }
  res.json(db.prepare('SELECT * FROM ambulance_requests WHERE request_id = ?').get(req.params.id));
});

// Operator updates live GPS location
router.put('/:id/location', authRequired, requireRole('AMBULANCE', 'ADMIN'), (req, res) => {
  const ambulanceId = Number(req.params.id);
  if (req.user.role === 'AMBULANCE' && req.user.ambulance_id !== ambulanceId) {
    return res.status(403).json({ error: 'You can only update your own ambulance location' });
  }
  const { latitude, longitude } = req.body;
  db.prepare('UPDATE ambulances SET latitude = ?, longitude = ? WHERE ambulance_id = ?').run(latitude, longitude, ambulanceId);
  res.json(db.prepare('SELECT * FROM ambulances WHERE ambulance_id = ?').get(ambulanceId));
});

router.put('/:id/profile', authRequired, requireRole('AMBULANCE', 'ADMIN'), (req, res) => {
  const ambulanceId = Number(req.params.id);
  if (req.user.role === 'AMBULANCE' && req.user.ambulance_id !== ambulanceId) {
    return res.status(403).json({ error: 'You can only update your own ambulance details' });
  }
  const ambulance = db.prepare('SELECT * FROM ambulances WHERE ambulance_id = ?').get(ambulanceId);
  if (!ambulance) return res.status(404).json({ error: 'Ambulance not found' });
  const { vehicle_no, status, latitude, longitude } = req.body;
  const allowedStatuses = ['AVAILABLE', 'ON_TRIP', 'OFFLINE'];
  if (status !== undefined && !allowedStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid ambulance status' });
  }
  if (vehicle_no !== undefined && !String(vehicle_no).trim()) {
    return res.status(400).json({ error: 'vehicle_no cannot be empty' });
  }
  db.prepare(`UPDATE ambulances SET vehicle_no = COALESCE(?, vehicle_no), status = COALESCE(?, status),
    latitude = COALESCE(?, latitude), longitude = COALESCE(?, longitude) WHERE ambulance_id = ?`)
    .run(vehicle_no?.trim() || null, status ?? null, latitude ?? null, longitude ?? null, ambulanceId);
  res.json(db.prepare('SELECT * FROM ambulances WHERE ambulance_id = ?').get(ambulanceId));
});

module.exports = router;

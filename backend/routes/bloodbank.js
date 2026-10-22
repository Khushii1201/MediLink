const express = require('express');
const db = require('../db');
const { authRequired, requireRole } = require('../middleware/auth');
const { distanceKm } = require('../services/geo');
const { logAudit } = require('../services/audit');
const { isValidCoordinate, isNonNegativeInt, isPositiveInt } = require('../middleware/validate');

const router = express.Router();
const VALID_BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

// Public search for blood units with optional blood_group filter and geo distance sorting
router.get('/units', (req, res) => {
  const { blood_group, lat, lng } = req.query;

  if (blood_group && !VALID_BLOOD_GROUPS.includes(blood_group)) {
    return res.status(400).json({ error: `Invalid blood group. Allowed: ${VALID_BLOOD_GROUPS.join(', ')}` });
  }

  let sql = `
    SELECT bu.*, bb.name AS bloodbank_name, bb.address, bb.latitude, bb.longitude, bb.phone
    FROM blood_units bu
    JOIN blood_banks bb ON bb.bloodbank_id = bu.bloodbank_id
  `;
  const params = [];
  if (blood_group) {
    sql += ' WHERE bu.blood_group = ?';
    params.push(blood_group);
  }

  let rows = db.prepare(sql).all(...params);

  const hasCoords = lat !== undefined && lng !== undefined && isValidCoordinate(lat, lng);
  const nLat = hasCoords ? parseFloat(lat) : null;
  const nLng = hasCoords ? parseFloat(lng) : null;

  rows = rows.map((unit) => {
    const dist = hasCoords ? distanceKm(nLat, nLng, unit.latitude, unit.longitude) : null;
    return {
      ...unit,
      distance_km: dist,
    };
  });

  if (hasCoords) {
    rows.sort((a, b) => (a.distance_km ?? Infinity) - (b.distance_km ?? Infinity));
  }

  res.json(rows);
});

// List all blood banks
router.get('/banks', (req, res) => {
  res.json(db.prepare('SELECT * FROM blood_banks').all());
});

// Update blood bank profile
router.put('/banks/:id', authRequired, requireRole('BLOODBANK', 'ADMIN'), (req, res) => {
  const bankId = Number(req.params.id);
  if (req.user.role === 'BLOODBANK' && req.user.bloodbank_id !== bankId) {
    return res.status(403).json({ error: 'You can only update your own blood bank details' });
  }
  const bank = db.prepare('SELECT * FROM blood_banks WHERE bloodbank_id = ?').get(bankId);
  if (!bank) return res.status(404).json({ error: 'Blood bank not found' });

  const { name, address, latitude, longitude, phone } = req.body;
  if (name !== undefined && !String(name).trim()) {
    return res.status(400).json({ error: 'name cannot be empty' });
  }
  if ((latitude !== undefined || longitude !== undefined) && !isValidCoordinate(latitude, longitude)) {
    return res.status(400).json({ error: 'Valid latitude (-90 to 90) and longitude (-180 to 180) are required' });
  }

  db.prepare(`
    UPDATE blood_banks
    SET name = COALESCE(?, name),
        address = COALESCE(?, address),
        latitude = COALESCE(?, latitude),
        longitude = COALESCE(?, longitude),
        phone = COALESCE(?, phone)
    WHERE bloodbank_id = ?
  `).run(name?.trim() || null, address ?? null, latitude ?? null, longitude ?? null, phone ?? null, bankId);

  logAudit(db, {
    user_id: req.user.user_id,
    action: 'UPDATE_PROFILE',
    entity: 'blood_banks',
    entity_id: bankId,
  });

  res.json(db.prepare('SELECT * FROM blood_banks WHERE bloodbank_id = ?').get(bankId));
});

// Admin creates blood bank
router.post('/banks', authRequired, requireRole('ADMIN'), (req, res) => {
  const { name, address, latitude, longitude, phone } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
  if ((latitude !== undefined || longitude !== undefined) && !isValidCoordinate(latitude, longitude)) {
    return res.status(400).json({ error: 'Valid latitude (-90 to 90) and longitude (-180 to 180) are required' });
  }

  const info = db.prepare(`
    INSERT INTO blood_banks (name, address, latitude, longitude, phone)
    VALUES (?, ?, ?, ?, ?)
  `).run(name.trim(), address || null, latitude ?? null, longitude ?? null, phone || null);

  logAudit(db, {
    user_id: req.user.user_id,
    action: 'CREATE',
    entity: 'blood_banks',
    entity_id: info.lastInsertRowid,
  });

  res.status(201).json(db.prepare('SELECT * FROM blood_banks WHERE bloodbank_id = ?').get(info.lastInsertRowid));
});

// Update blood unit inventory
router.put('/units/:id', authRequired, requireRole('BLOODBANK', 'ADMIN'), (req, res) => {
  const unit = db.prepare('SELECT * FROM blood_units WHERE unit_id = ?').get(req.params.id);
  if (!unit) return res.status(404).json({ error: 'Blood unit not found' });
  if (req.user.role === 'BLOODBANK' && req.user.bloodbank_id !== unit.bloodbank_id) {
    return res.status(403).json({ error: 'You can only manage your own blood bank inventory' });
  }

  const { quantity, available } = req.body;
  const newQuantity = quantity !== undefined ? Number(quantity) : unit.quantity;
  const newAvailable = available !== undefined ? Number(available) : unit.available;

  if (!isNonNegativeInt(newQuantity) || !isNonNegativeInt(newAvailable)) {
    return res.status(400).json({ error: 'quantity and available must be non-negative integers' });
  }
  if (newAvailable > newQuantity) {
    return res.status(400).json({ error: 'available units cannot exceed total quantity' });
  }

  db.prepare(`
    UPDATE blood_units
    SET quantity = ?, available = ?
    WHERE unit_id = ?
  `).run(newQuantity, newAvailable, req.params.id);

  logAudit(db, {
    user_id: req.user.user_id,
    action: 'UPDATE_INVENTORY',
    entity: 'blood_units',
    entity_id: unit.unit_id,
    details: { quantity: newQuantity, available: newAvailable },
  });

  res.json(db.prepare('SELECT * FROM blood_units WHERE unit_id = ?').get(req.params.id));
});

// Add a blood group unit row
router.post('/units', authRequired, requireRole('BLOODBANK', 'ADMIN'), (req, res) => {
  const bloodbankId = req.user.role === 'ADMIN' ? req.body.bloodbank_id : req.user.bloodbank_id;
  const { blood_group, quantity = 0, available = 0 } = req.body;

  if (!bloodbankId) return res.status(400).json({ error: 'bloodbank_id is required' });
  if (!blood_group || !VALID_BLOOD_GROUPS.includes(blood_group)) {
    return res.status(400).json({ error: `blood_group must be one of: ${VALID_BLOOD_GROUPS.join(', ')}` });
  }

  if (!isNonNegativeInt(quantity) || !isNonNegativeInt(available)) {
    return res.status(400).json({ error: 'quantity and available must be non-negative integers' });
  }
  if (Number(available) > Number(quantity)) {
    return res.status(400).json({ error: 'available units cannot exceed total quantity' });
  }

  // Check if group already exists for this bank
  const existing = db.prepare('SELECT * FROM blood_units WHERE bloodbank_id = ? AND blood_group = ?').get(bloodbankId, blood_group);
  if (existing) {
    return res.status(409).json({ error: `Blood unit for group ${blood_group} already exists in this blood bank` });
  }

  const info = db.prepare(`
    INSERT INTO blood_units (bloodbank_id, blood_group, quantity, available)
    VALUES (?, ?, ?, ?)
  `).run(bloodbankId, blood_group, Number(quantity), Number(available));

  logAudit(db, {
    user_id: req.user.user_id,
    action: 'ADD_UNIT_GROUP',
    entity: 'blood_units',
    entity_id: info.lastInsertRowid,
    details: { bloodbankId, blood_group },
  });

  res.status(201).json(db.prepare('SELECT * FROM blood_units WHERE unit_id = ?').get(info.lastInsertRowid));
});

// Patient reservation creation
router.post('/reservations', authRequired, requireRole('PATIENT'), (req, res) => {
  const { unit_id, units_requested = 1 } = req.body;
  if (!unit_id) return res.status(400).json({ error: 'unit_id is required' });

  if (!isPositiveInt(units_requested)) {
    return res.status(400).json({ error: 'units_requested must be a positive integer' });
  }

  const requested = Number(units_requested);
  const unit = db.prepare('SELECT * FROM blood_units WHERE unit_id = ?').get(unit_id);
  if (!unit) return res.status(404).json({ error: 'Blood unit not found' });

  if (unit.available < requested) {
    return res.status(400).json({ error: `Not enough units available. Requested: ${requested}, Available: ${unit.available}` });
  }

  const info = db.prepare(`
    INSERT INTO reservations (patient_id, unit_id, units_requested, status)
    VALUES (?, ?, ?, 'PENDING')
  `).run(req.user.user_id, unit_id, requested);

  logAudit(db, {
    user_id: req.user.user_id,
    action: 'CREATE',
    entity: 'reservations',
    entity_id: info.lastInsertRowid,
    details: { unit_id, units_requested: requested },
  });

  res.status(201).json(db.prepare('SELECT * FROM reservations WHERE reservation_id = ?').get(info.lastInsertRowid));
});

// List reservations by role
router.get('/reservations', authRequired, (req, res) => {
  let rows;
  if (req.user.role === 'PATIENT') {
    rows = db.prepare(`
      SELECT r.*, bu.blood_group, bb.name AS bloodbank_name, bb.phone AS bloodbank_phone
      FROM reservations r
      JOIN blood_units bu ON bu.unit_id = r.unit_id
      JOIN blood_banks bb ON bb.bloodbank_id = bu.bloodbank_id
      WHERE r.patient_id = ?
      ORDER BY r.created_at DESC
    `).all(req.user.user_id);
  } else if (req.user.role === 'BLOODBANK') {
    if (!req.user.bloodbank_id) {
      return res.status(403).json({ error: 'No blood bank linked to this account' });
    }
    rows = db.prepare(`
      SELECT r.*, bu.blood_group, u.name AS patient_name, u.phone AS patient_phone
      FROM reservations r
      JOIN blood_units bu ON bu.unit_id = r.unit_id
      JOIN users u ON u.user_id = r.patient_id
      WHERE bu.bloodbank_id = ?
      ORDER BY r.created_at DESC
    `).all(req.user.bloodbank_id);
  } else if (req.user.role === 'ADMIN') {
    rows = db.prepare(`
      SELECT r.*, bu.blood_group, bb.name AS bloodbank_name, u.name AS patient_name, u.phone AS patient_phone
      FROM reservations r
      JOIN blood_units bu ON bu.unit_id = r.unit_id
      JOIN blood_banks bb ON bb.bloodbank_id = bu.bloodbank_id
      JOIN users u ON u.user_id = r.patient_id
      ORDER BY r.created_at DESC
    `).all();
  } else {
    return res.status(403).json({ error: 'Not permitted to view reservations' });
  }
  res.json(rows);
});

// Patient cancels own reservation
router.put('/reservations/:id/cancel', authRequired, requireRole('PATIENT'), (req, res) => {
  const reservation = db.prepare(`
    SELECT r.*, bu.bloodbank_id, bu.available AS unit_available, bu.quantity AS unit_quantity
    FROM reservations r
    JOIN blood_units bu ON bu.unit_id = r.unit_id
    WHERE r.reservation_id = ?
  `).get(req.params.id);

  if (!reservation) return res.status(404).json({ error: 'Reservation not found' });
  if (reservation.patient_id !== req.user.user_id) {
    return res.status(403).json({ error: 'You can only cancel your own reservation' });
  }

  const currentStatus = reservation.status;
  if (['REJECTED', 'FULFILLED', 'CANCELLED'].includes(currentStatus)) {
    return res.status(409).json({ error: `Cannot cancel a reservation that is already ${currentStatus}` });
  }

  const cancelTx = db.transaction(() => {
    // If it was APPROVED, stock was deducted, so restore it
    if (currentStatus === 'APPROVED') {
      db.prepare(`
        UPDATE blood_units
        SET available = MIN(available + ?, quantity)
        WHERE unit_id = ?
      `).run(reservation.units_requested, reservation.unit_id);
    }

    db.prepare(`
      UPDATE reservations
      SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP
      WHERE reservation_id = ?
    `).run(reservation.reservation_id);
  });

  cancelTx();

  logAudit(db, {
    user_id: req.user.user_id,
    action: 'CANCEL',
    entity: 'reservations',
    entity_id: reservation.reservation_id,
    details: { prev_status: currentStatus, new_status: 'CANCELLED' },
  });

  res.json(db.prepare('SELECT * FROM reservations WHERE reservation_id = ?').get(reservation.reservation_id));
});

// Blood bank staff processes a reservation (APPROVE, REJECT, FULFIL)
router.put('/reservations/:id', authRequired, requireRole('BLOODBANK', 'ADMIN'), (req, res) => {
  const { status } = req.body;
  const allowed = ['APPROVED', 'REJECTED', 'FULFILLED'];
  if (!status || !allowed.includes(status)) {
    return res.status(400).json({ error: 'status must be one of ' + allowed.join(', ') });
  }

  const reservation = db.prepare(`
    SELECT r.*, bu.bloodbank_id, bu.available AS unit_available, bu.quantity AS unit_quantity
    FROM reservations r
    JOIN blood_units bu ON bu.unit_id = r.unit_id
    WHERE r.reservation_id = ?
  `).get(req.params.id);

  if (!reservation) return res.status(404).json({ error: 'Reservation not found' });

  // Ownership verification: BLOODBANK staff can only process their own bank's reservations
  if (req.user.role === 'BLOODBANK' && req.user.bloodbank_id !== reservation.bloodbank_id) {
    return res.status(403).json({ error: 'You can only process reservations for your own blood bank' });
  }

  const currentStatus = reservation.status;

  // State machine:
  // PENDING -> APPROVED | REJECTED
  // APPROVED -> FULFILLED | REJECTED
  const validTransitions = {
    PENDING: ['APPROVED', 'REJECTED'],
    APPROVED: ['FULFILLED', 'REJECTED'],
  };

  if (!validTransitions[currentStatus] || !validTransitions[currentStatus].includes(status)) {
    return res.status(409).json({
      error: `Invalid status transition from ${currentStatus} to ${status}. Allowed: ${(validTransitions[currentStatus] || []).join(', ') || 'None'}`
    });
  }

  const processTx = db.transaction(() => {
    if (status === 'APPROVED') {
      // Check stock availability
      const latestUnit = db.prepare('SELECT available, quantity FROM blood_units WHERE unit_id = ?').get(reservation.unit_id);
      if (latestUnit.available < reservation.units_requested) {
        throw new Error('INSUFFICIENT_STOCK');
      }

      // Decrement stock exactly once at APPROVED
      db.prepare(`
        UPDATE blood_units
        SET available = available - ?
        WHERE unit_id = ?
      `).run(reservation.units_requested, reservation.unit_id);
    } else if (status === 'REJECTED' && currentStatus === 'APPROVED') {
      // Restore previously deducted stock if transitioning APPROVED -> REJECTED
      db.prepare(`
        UPDATE blood_units
        SET available = MIN(available + ?, quantity)
        WHERE unit_id = ?
      `).run(reservation.units_requested, reservation.unit_id);
    }
    // FULFILLED does NOT decrement again; stock was already reserved and decremented at APPROVED.

    db.prepare(`
      UPDATE reservations
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE reservation_id = ?
    `).run(status, req.params.id);
  });

  try {
    processTx();
  } catch (err) {
    if (err.message === 'INSUFFICIENT_STOCK') {
      return res.status(409).json({ error: 'Insufficient blood units available to approve this reservation' });
    }
    return res.status(500).json({ error: 'Failed to update reservation status' });
  }

  logAudit(db, {
    user_id: req.user.user_id,
    action: `STATUS_${status}`,
    entity: 'reservations',
    entity_id: reservation.reservation_id,
    details: { prev_status: currentStatus, new_status: status },
  });

  res.json(db.prepare('SELECT * FROM reservations WHERE reservation_id = ?').get(req.params.id));
});

module.exports = router;

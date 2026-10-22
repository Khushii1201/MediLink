const express = require('express');
const db = require('../db');
const { authRequired, requireRole } = require('../middleware/auth');

const router = express.Router();

// Public search by blood group
router.get('/units', (req, res) => {
  const { blood_group } = req.query;
  let sql = `SELECT bu.*, bb.name AS bloodbank_name, bb.address FROM blood_units bu
             JOIN blood_banks bb ON bb.bloodbank_id = bu.bloodbank_id`;
  const params = [];
  if (blood_group) { sql += ' WHERE bu.blood_group = ?'; params.push(blood_group); }
  res.json(db.prepare(sql).all(...params));
});

router.get('/banks', (req, res) => {
  res.json(db.prepare('SELECT * FROM blood_banks').all());
});

router.put('/banks/:id', authRequired, requireRole('BLOODBANK', 'ADMIN'), (req, res) => {
  const bankId = Number(req.params.id);
  if (req.user.role === 'BLOODBANK' && req.user.bloodbank_id !== bankId) {
    return res.status(403).json({ error: 'You can only update your own blood bank details' });
  }
  const bank = db.prepare('SELECT * FROM blood_banks WHERE bloodbank_id = ?').get(bankId);
  if (!bank) return res.status(404).json({ error: 'Blood bank not found' });
  const { name, address } = req.body;
  if (name !== undefined && !String(name).trim()) return res.status(400).json({ error: 'name cannot be empty' });
  db.prepare('UPDATE blood_banks SET name = COALESCE(?, name), address = COALESCE(?, address) WHERE bloodbank_id = ?')
    .run(name?.trim() || null, address ?? null, bankId);
  res.json(db.prepare('SELECT * FROM blood_banks WHERE bloodbank_id = ?').get(bankId));
});

router.post('/banks', authRequired, requireRole('ADMIN'), (req, res) => {
  const { name, address } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
  const info = db.prepare('INSERT INTO blood_banks (name, address) VALUES (?,?)').run(name.trim(), address || null);
  res.status(201).json(db.prepare('SELECT * FROM blood_banks WHERE bloodbank_id = ?').get(info.lastInsertRowid));
});

router.put('/units/:id', authRequired, requireRole('BLOODBANK', 'ADMIN'), (req, res) => {
  const unit = db.prepare('SELECT * FROM blood_units WHERE unit_id = ?').get(req.params.id);
  if (!unit) return res.status(404).json({ error: 'Blood unit not found' });
  if (req.user.role === 'BLOODBANK' && req.user.bloodbank_id !== unit.bloodbank_id) {
    return res.status(403).json({ error: 'You can only manage your own blood bank inventory' });
  }
  const { quantity, available } = req.body;
  db.prepare('UPDATE blood_units SET quantity = COALESCE(?, quantity), available = COALESCE(?, available) WHERE unit_id = ?')
    .run(quantity ?? null, available ?? null, req.params.id);
  res.json(db.prepare('SELECT * FROM blood_units WHERE unit_id = ?').get(req.params.id));
});

router.post('/units', authRequired, requireRole('BLOODBANK', 'ADMIN'), (req, res) => {
  const bloodbankId = req.user.role === 'ADMIN' ? req.body.bloodbank_id : req.user.bloodbank_id;
  const { blood_group, quantity, available } = req.body;
  if (!bloodbankId || !blood_group) return res.status(400).json({ error: 'bloodbank_id and blood_group are required' });
  const info = db.prepare('INSERT INTO blood_units (bloodbank_id, blood_group, quantity, available) VALUES (?,?,?,?)')
    .run(bloodbankId, blood_group, quantity || 0, available || 0);
  res.status(201).json(db.prepare('SELECT * FROM blood_units WHERE unit_id = ?').get(info.lastInsertRowid));
});

// Patient reservation
router.post('/reservations', authRequired, requireRole('PATIENT'), (req, res) => {
  const { unit_id, units_requested } = req.body;
  const unit = db.prepare('SELECT * FROM blood_units WHERE unit_id = ?').get(unit_id);
  if (!unit) return res.status(404).json({ error: 'Blood unit not found' });
  const requested = units_requested || 1;
  if (unit.available < requested) return res.status(400).json({ error: 'Not enough units available' });

  const info = db.prepare('INSERT INTO reservations (patient_id, unit_id, units_requested) VALUES (?,?,?)')
    .run(req.user.user_id, unit_id, requested);
  res.status(201).json(db.prepare('SELECT * FROM reservations WHERE reservation_id = ?').get(info.lastInsertRowid));
});

router.get('/reservations', authRequired, (req, res) => {
  let rows;
  if (req.user.role === 'PATIENT') {
    rows = db.prepare(`SELECT r.*, bu.blood_group, bb.name AS bloodbank_name FROM reservations r
      JOIN blood_units bu ON bu.unit_id = r.unit_id JOIN blood_banks bb ON bb.bloodbank_id = bu.bloodbank_id
      WHERE r.patient_id = ? ORDER BY r.created_at DESC`).all(req.user.user_id);
  } else if (req.user.role === 'BLOODBANK') {
    rows = db.prepare(`SELECT r.*, bu.blood_group, u.name AS patient_name FROM reservations r
      JOIN blood_units bu ON bu.unit_id = r.unit_id JOIN users u ON u.user_id = r.patient_id
      WHERE bu.bloodbank_id = ? ORDER BY r.created_at DESC`).all(req.user.bloodbank_id);
  } else if (req.user.role === 'ADMIN') {
    rows = db.prepare(`SELECT r.*, bu.blood_group, u.name AS patient_name FROM reservations r
      JOIN blood_units bu ON bu.unit_id = r.unit_id JOIN users u ON u.user_id = r.patient_id ORDER BY r.created_at DESC`).all();
  } else {
    return res.status(403).json({ error: 'Not permitted' });
  }
  res.json(rows);
});

router.put('/reservations/:id', authRequired, requireRole('BLOODBANK', 'ADMIN'), (req, res) => {
  const { status } = req.body;
  const allowed = ['APPROVED', 'REJECTED', 'FULFILLED'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'status must be one of ' + allowed.join(', ') });

  const reservation = db.prepare('SELECT * FROM reservations WHERE reservation_id = ?').get(req.params.id);
  if (!reservation) return res.status(404).json({ error: 'Reservation not found' });

  db.prepare('UPDATE reservations SET status = ? WHERE reservation_id = ?').run(status, req.params.id);
  if (status === 'APPROVED' || status === 'FULFILLED') {
    db.prepare('UPDATE blood_units SET available = MAX(available - ?, 0) WHERE unit_id = ?')
      .run(reservation.units_requested, reservation.unit_id);
  }
  res.json(db.prepare('SELECT * FROM reservations WHERE reservation_id = ?').get(req.params.id));
});

module.exports = router;

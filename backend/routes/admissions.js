const express = require('express');
const db = require('../db');
const { authRequired, requireRole } = require('../middleware/auth');

const router = express.Router();

// Patient creates admission request
router.post('/', authRequired, requireRole('PATIENT'), (req, res) => {
  const { hospital_id, reason } = req.body;
  if (!hospital_id) return res.status(400).json({ error: 'hospital_id is required' });
  const hospital = db.prepare('SELECT * FROM hospitals WHERE hospital_id = ?').get(hospital_id);
  if (!hospital) return res.status(404).json({ error: 'Hospital not found' });

  const info = db.prepare('INSERT INTO admissions (patient_id, hospital_id, reason) VALUES (?,?,?)')
    .run(req.user.user_id, hospital_id, reason || null);
  res.status(201).json(db.prepare('SELECT * FROM admissions WHERE admission_id = ?').get(info.lastInsertRowid));
});

// Patient views own requests; hospital views requests for its hospital; admin sees all
router.get('/', authRequired, (req, res) => {
  let rows;
  if (req.user.role === 'PATIENT') {
    rows = db.prepare(`SELECT a.*, h.name AS hospital_name FROM admissions a
      JOIN hospitals h ON h.hospital_id = a.hospital_id WHERE a.patient_id = ? ORDER BY a.created_at DESC`).all(req.user.user_id);
  } else if (req.user.role === 'HOSPITAL') {
    rows = db.prepare(`SELECT a.*, u.name AS patient_name, u.phone AS patient_phone FROM admissions a
      JOIN users u ON u.user_id = a.patient_id WHERE a.hospital_id = ? ORDER BY a.created_at DESC`).all(req.user.hospital_id);
  } else if (req.user.role === 'ADMIN') {
    rows = db.prepare(`SELECT a.*, h.name AS hospital_name, u.name AS patient_name FROM admissions a
      JOIN hospitals h ON h.hospital_id = a.hospital_id JOIN users u ON u.user_id = a.patient_id ORDER BY a.created_at DESC`).all();
  } else {
    return res.status(403).json({ error: 'Not permitted to view admissions' });
  }
  res.json(rows);
});

// Hospital staff processes a request (accept/reject/complete)
router.put('/:id/status', authRequired, requireRole('HOSPITAL', 'ADMIN'), (req, res) => {
  const { status } = req.body;
  const allowed = ['ACCEPTED', 'REJECTED', 'COMPLETED'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'status must be one of ' + allowed.join(', ') });

  const admission = db.prepare('SELECT * FROM admissions WHERE admission_id = ?').get(req.params.id);
  if (!admission) return res.status(404).json({ error: 'Admission request not found' });
  if (req.user.role === 'HOSPITAL' && req.user.hospital_id !== admission.hospital_id) {
    return res.status(403).json({ error: 'You can only process requests for your own hospital' });
  }

  db.prepare('UPDATE admissions SET status = ? WHERE admission_id = ?').run(status, req.params.id);

  // Decrement available beds when accepted
  if (status === 'ACCEPTED') {
    db.prepare(`UPDATE resources SET available = MAX(available - 1, 0) WHERE hospital_id = ? AND type = 'BED'`).run(admission.hospital_id);
  }
  res.json(db.prepare('SELECT * FROM admissions WHERE admission_id = ?').get(req.params.id));
});

module.exports = router;

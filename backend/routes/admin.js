const express = require('express');
const db = require('../db');
const { authRequired, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired, requireRole('ADMIN'));

router.get('/users', (req, res) => {
  res.json(db.prepare('SELECT user_id, name, email, phone, role, hospital_id, ambulance_id, bloodbank_id, created_at FROM users ORDER BY created_at DESC').all());
});

router.delete('/users/:id', (req, res) => {
  db.prepare('DELETE FROM users WHERE user_id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.get('/analytics', (req, res) => {
  const totals = {
    users: db.prepare('SELECT COUNT(*) c FROM users').get().c,
    hospitals: db.prepare('SELECT COUNT(*) c FROM hospitals').get().c,
    ambulances: db.prepare('SELECT COUNT(*) c FROM ambulances').get().c,
    blood_banks: db.prepare('SELECT COUNT(*) c FROM blood_banks').get().c,
  };

  const admissionsByStatus = db.prepare('SELECT status, COUNT(*) AS count FROM admissions GROUP BY status').all();
  const ambulanceRequestsByStatus = db.prepare('SELECT status, COUNT(*) AS count FROM ambulance_requests GROUP BY status').all();
  const reservationsByStatus = db.prepare('SELECT status, COUNT(*) AS count FROM reservations GROUP BY status').all();

  const bedOccupancy = db.prepare(`
    SELECT h.name AS hospital_name, r.type, r.total, r.available,
           ROUND(100.0 * (r.total - r.available) / NULLIF(r.total,0), 1) AS occupancy_pct
    FROM resources r JOIN hospitals h ON h.hospital_id = r.hospital_id
    ORDER BY h.name, r.type
  `).all();

  const avgWaitByHospital = db.prepare(`
    SELECT h.name AS hospital_name, ROUND(AVG(wt.minutes),1) AS avg_minutes
    FROM waiting_times wt JOIN hospitals h ON h.hospital_id = wt.hospital_id
    GROUP BY h.hospital_id
  `).all();

  const usersByRole = db.prepare('SELECT role, COUNT(*) AS count FROM users GROUP BY role').all();

  res.json({ totals, admissionsByStatus, ambulanceRequestsByStatus, reservationsByStatus, bedOccupancy, avgWaitByHospital, usersByRole });
});

module.exports = router;

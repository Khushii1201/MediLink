const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { authRequired, requireRole } = require('../middleware/auth');
const { isValidEmail, isValidPhone } = require('../middleware/validate');
const { logAudit } = require('../services/audit');
const { detectAnomalies } = require('../services/anomalyDetector');

const router = express.Router();
router.use(authRequired, requireRole('ADMIN'));

// List all users
router.get('/users', (req, res) => {
  const users = db.prepare(`
    SELECT user_id, name, email, phone, role, hospital_id, ambulance_id, bloodbank_id, active, created_at
    FROM users
    ORDER BY created_at DESC
  `).all();
  res.json(users);
});

// Admin creates staff or user accounts with linked entities
router.post('/users', (req, res) => {
  const { name, email, password, phone, role, hospital_id, ambulance_id, bloodbank_id } = req.body;

  if (!name || !String(name).trim()) return res.status(400).json({ error: 'Name is required' });

  const cleanEmail = (email || '').trim().toLowerCase();
  if (!isValidEmail(cleanEmail)) return res.status(400).json({ error: 'A valid email address is required' });

  if (!password || typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long' });
  }

  const allowedRoles = ['PATIENT', 'HOSPITAL', 'AMBULANCE', 'BLOODBANK', 'ADMIN'];
  if (!role || !allowedRoles.includes(role)) {
    return res.status(400).json({ error: `Invalid role. Allowed: ${allowedRoles.join(', ')}` });
  }

  const cleanPhone = phone ? String(phone).trim() : null;
  if (cleanPhone && !isValidPhone(cleanPhone)) {
    return res.status(400).json({ error: 'Invalid phone format' });
  }

  let finalHospitalId = null;
  let finalAmbulanceId = null;
  let finalBloodbankId = null;

  // Validate linked entities based on role
  if (role === 'HOSPITAL') {
    if (!hospital_id) return res.status(400).json({ error: 'hospital_id is required for HOSPITAL staff accounts' });
    const hospital = db.prepare('SELECT hospital_id FROM hospitals WHERE hospital_id = ?').get(hospital_id);
    if (!hospital) return res.status(404).json({ error: 'Assigned hospital does not exist' });
    finalHospitalId = Number(hospital_id);
  } else if (role === 'AMBULANCE') {
    if (!ambulance_id) return res.status(400).json({ error: 'ambulance_id is required for AMBULANCE operator accounts' });
    const ambulance = db.prepare('SELECT ambulance_id FROM ambulances WHERE ambulance_id = ?').get(ambulance_id);
    if (!ambulance) return res.status(404).json({ error: 'Assigned ambulance does not exist' });
    finalAmbulanceId = Number(ambulance_id);
  } else if (role === 'BLOODBANK') {
    if (!bloodbank_id) return res.status(400).json({ error: 'bloodbank_id is required for BLOODBANK staff accounts' });
    const bank = db.prepare('SELECT bloodbank_id FROM blood_banks WHERE bloodbank_id = ?').get(bloodbank_id);
    if (!bank) return res.status(404).json({ error: 'Assigned blood bank does not exist' });
    finalBloodbankId = Number(bloodbank_id);
  }

  const existing = db.prepare('SELECT user_id FROM users WHERE LOWER(email) = ?').get(cleanEmail);
  if (existing) {
    return res.status(409).json({ error: 'An account with this email already exists' });
  }

  const password_hash = bcrypt.hashSync(password, 10);
  const info = db.prepare(`
    INSERT INTO users (name, email, password_hash, phone, role, hospital_id, ambulance_id, bloodbank_id, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
  `).run(name.trim(), cleanEmail, password_hash, cleanPhone, role, finalHospitalId, finalAmbulanceId, finalBloodbankId);

  const newUserId = info.lastInsertRowid;

  logAudit(db, {
    user_id: req.user.user_id,
    action: 'CREATE_STAFF_USER',
    entity: 'users',
    entity_id: newUserId,
    details: { role, email: cleanEmail },
  });

  const createdUser = db.prepare(`
    SELECT user_id, name, email, phone, role, hospital_id, ambulance_id, bloodbank_id, active, created_at
    FROM users WHERE user_id = ?
  `).get(newUserId);

  res.status(201).json(createdUser);
});

// Update user details
router.put('/users/:id', (req, res) => {
  const targetId = Number(req.params.id);
  const targetUser = db.prepare('SELECT * FROM users WHERE user_id = ?').get(targetId);
  if (!targetUser) return res.status(404).json({ error: 'User not found' });

  const { name, phone, role, hospital_id, ambulance_id, bloodbank_id } = req.body;
  if (name !== undefined && !String(name).trim()) {
    return res.status(400).json({ error: 'Name cannot be empty' });
  }

  const cleanPhone = phone !== undefined ? (phone ? String(phone).trim() : null) : targetUser.phone;
  if (cleanPhone && !isValidPhone(cleanPhone)) {
    return res.status(400).json({ error: 'Invalid phone format' });
  }

  const updatedRole = role || targetUser.role;

  db.prepare(`
    UPDATE users
    SET name = COALESCE(?, name),
        phone = ?,
        role = COALESCE(?, role),
        hospital_id = ?,
        ambulance_id = ?,
        bloodbank_id = ?
    WHERE user_id = ?
  `).run(
    name?.trim() || null,
    cleanPhone,
    role || null,
    hospital_id !== undefined ? (hospital_id ? Number(hospital_id) : null) : targetUser.hospital_id,
    ambulance_id !== undefined ? (ambulance_id ? Number(ambulance_id) : null) : targetUser.ambulance_id,
    bloodbank_id !== undefined ? (bloodbank_id ? Number(bloodbank_id) : null) : targetUser.bloodbank_id,
    targetId
  );

  logAudit(db, {
    user_id: req.user.user_id,
    action: 'UPDATE_USER',
    entity: 'users',
    entity_id: targetId,
    details: { role: updatedRole },
  });

  const updated = db.prepare(`
    SELECT user_id, name, email, phone, role, hospital_id, ambulance_id, bloodbank_id, active, created_at
    FROM users WHERE user_id = ?
  `).get(targetId);

  res.json(updated);
});

// Deactivate user (soft delete) - an admin cannot deactivate themselves
router.delete('/users/:id', (req, res) => {
  const targetId = Number(req.params.id);
  if (req.user.user_id === targetId) {
    return res.status(400).json({ error: 'You cannot deactivate your own administrative account' });
  }

  const user = db.prepare('SELECT user_id, active FROM users WHERE user_id = ?').get(targetId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  db.prepare('UPDATE users SET active = 0 WHERE user_id = ?').run(targetId);

  logAudit(db, {
    user_id: req.user.user_id,
    action: 'DEACTIVATE_USER',
    entity: 'users',
    entity_id: targetId,
  });

  res.json({ ok: true, message: 'User deactivated successfully' });
});

// Reactivate user
router.put('/users/:id/reactivate', (req, res) => {
  const targetId = Number(req.params.id);
  const user = db.prepare('SELECT user_id FROM users WHERE user_id = ?').get(targetId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  db.prepare('UPDATE users SET active = 1 WHERE user_id = ?').run(targetId);

  logAudit(db, {
    user_id: req.user.user_id,
    action: 'REACTIVATE_USER',
    entity: 'users',
    entity_id: targetId,
  });

  res.json({ ok: true, message: 'User reactivated successfully' });
});

// Admin deletes ambulance (guard: cannot delete if active trip or requests)
router.delete('/ambulances/:id', (req, res) => {
  const ambId = Number(req.params.id);
  const ambulance = db.prepare('SELECT * FROM ambulances WHERE ambulance_id = ?').get(ambId);
  if (!ambulance) return res.status(404).json({ error: 'Ambulance not found' });

  if (ambulance.status === 'ON_TRIP') {
    return res.status(409).json({ error: 'Cannot delete an ambulance that is currently on an active trip' });
  }

  const activeReq = db.prepare(`
    SELECT COUNT(*) AS count FROM ambulance_requests
    WHERE ambulance_id = ? AND status IN ('REQUESTED', 'ACCEPTED', 'EN_ROUTE')
  `).get(ambId).count;

  if (activeReq > 0) {
    return res.status(409).json({ error: 'Cannot delete ambulance with active requests' });
  }

  const delTx = db.transaction(() => {
    db.prepare('DELETE FROM ambulance_locations WHERE ambulance_id = ?').run(ambId);
    db.prepare('UPDATE users SET ambulance_id = NULL WHERE ambulance_id = ?').run(ambId);
    db.prepare('DELETE FROM ambulances WHERE ambulance_id = ?').run(ambId);
  });
  delTx();

  logAudit(db, {
    user_id: req.user.user_id,
    action: 'DELETE',
    entity: 'ambulances',
    entity_id: ambId,
  });

  res.json({ ok: true, message: 'Ambulance deleted successfully' });
});

// Admin deletes blood bank (guard: cannot delete if active reservations)
router.delete('/blood-banks/:id', (req, res) => {
  const bankId = Number(req.params.id);
  const bank = db.prepare('SELECT * FROM blood_banks WHERE bloodbank_id = ?').get(bankId);
  if (!bank) return res.status(404).json({ error: 'Blood bank not found' });

  const activeRes = db.prepare(`
    SELECT COUNT(*) AS count FROM reservations r
    JOIN blood_units bu ON bu.unit_id = r.unit_id
    WHERE bu.bloodbank_id = ? AND r.status IN ('PENDING', 'APPROVED')
  `).get(bankId).count;

  if (activeRes > 0) {
    return res.status(409).json({ error: 'Cannot delete blood bank with active reservations' });
  }

  const delTx = db.transaction(() => {
    db.prepare('DELETE FROM blood_units WHERE bloodbank_id = ?').run(bankId);
    db.prepare('UPDATE users SET bloodbank_id = NULL WHERE bloodbank_id = ?').run(bankId);
    db.prepare('DELETE FROM blood_banks WHERE bloodbank_id = ?').run(bankId);
  });
  delTx();

  logAudit(db, {
    user_id: req.user.user_id,
    action: 'DELETE',
    entity: 'blood_banks',
    entity_id: bankId,
  });

  res.json({ ok: true, message: 'Blood bank deleted successfully' });
});

// Audit log view
router.get('/audit', (req, res) => {
  const { limit = 100, entity } = req.query;
  const nLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);

  let sql = `
    SELECT al.*, u.name AS user_name, u.email AS user_email
    FROM audit_logs al
    LEFT JOIN users u ON u.user_id = al.user_id
  `;
  const params = [];
  if (entity) {
    sql += ' WHERE al.entity = ?';
    params.push(entity.trim());
  }
  sql += ' ORDER BY al.created_at DESC LIMIT ?';
  params.push(nLimit);

  res.json(db.prepare(sql).all(...params));
});

// Admin comprehensive analytics
router.get('/analytics', (req, res) => {
  const totals = {
    users: db.prepare('SELECT COUNT(*) c FROM users').get().c,
    hospitals: db.prepare('SELECT COUNT(*) c FROM hospitals').get().c,
    ambulances: db.prepare('SELECT COUNT(*) c FROM ambulances').get().c,
    blood_banks: db.prepare('SELECT COUNT(*) c FROM blood_banks').get().c,
    open_admissions: db.prepare("SELECT COUNT(*) c FROM admissions WHERE status IN ('PENDING', 'ACCEPTED')").get().c,
    open_ambulance_requests: db.prepare("SELECT COUNT(*) c FROM ambulance_requests WHERE status IN ('REQUESTED', 'ACCEPTED', 'EN_ROUTE')").get().c,
    open_blood_reservations: db.prepare("SELECT COUNT(*) c FROM reservations WHERE status IN ('PENDING', 'APPROVED')").get().c,
  };

  const admissionsByStatus = db.prepare('SELECT status, COUNT(*) AS count FROM admissions GROUP BY status').all();
  const ambulanceRequestsByStatus = db.prepare('SELECT status, COUNT(*) AS count FROM ambulance_requests GROUP BY status').all();
  const reservationsByStatus = db.prepare('SELECT status, COUNT(*) AS count FROM reservations GROUP BY status').all();

  // Resource occupancy
  const bedOccupancy = db.prepare(`
    SELECT h.name AS hospital_name, r.type, r.total, r.available,
           ROUND(100.0 * (r.total - r.available) / NULLIF(r.total, 0), 1) AS occupancy_pct
    FROM resources r
    JOIN hospitals h ON h.hospital_id = r.hospital_id
    ORDER BY h.name, r.type
  `).all();

  // Average wait by hospital
  const avgWaitByHospital = db.prepare(`
    SELECT h.name AS hospital_name, ROUND(AVG(wt.minutes), 1) AS avg_minutes
    FROM waiting_times wt
    JOIN hospitals h ON h.hospital_id = wt.hospital_id
    GROUP BY h.hospital_id
  `).all();

  const usersByRole = db.prepare('SELECT role, COUNT(*) AS count FROM users GROUP BY role').all();

  // Ambulance utilisation: ON_TRIP / total
  const ambTotal = totals.ambulances || 1;
  const ambOnTrip = db.prepare("SELECT COUNT(*) c FROM ambulances WHERE status = 'ON_TRIP'").get().c;
  const ambulanceUtilisationPct = Math.round((ambOnTrip / ambTotal) * 1000) / 10;

  // Low-stock blood units (< 5 units available)
  const lowStockBlood = db.prepare(`
    SELECT bu.unit_id, bu.blood_group, bu.available, bu.quantity, bb.name AS bloodbank_name
    FROM blood_units bu
    JOIN blood_banks bb ON bb.bloodbank_id = bu.bloodbank_id
    WHERE bu.available < 5
    ORDER BY bu.available ASC
  `).all();

  // Average admission processing duration for completed admissions (in minutes)
  const avgProcessingRow = db.prepare(`
    SELECT ROUND(AVG((julianday(updated_at) - julianday(created_at)) * 1440), 1) AS avg_minutes
    FROM admissions
    WHERE status = 'COMPLETED'
  `).get();
  const avgAdmissionProcessingMinutes = avgProcessingRow?.avg_minutes || 0;
  const anomalies = detectAnomalies(db);

  res.json({
    totals,
    admissionsByStatus,
    ambulanceRequestsByStatus,
    reservationsByStatus,
    bedOccupancy,
    avgWaitByHospital,
    usersByRole,
    ambulanceUtilisation: {
      on_trip: ambOnTrip,
      total: totals.ambulances,
      utilisation_pct: ambulanceUtilisationPct,
    },
    lowStockBlood,
    avgAdmissionProcessingMinutes,
    anomalies,
  });
});

// Anomaly and operational health alerts
router.get('/anomalies', (req, res) => {
  res.json(detectAnomalies(db));
});

module.exports = router;

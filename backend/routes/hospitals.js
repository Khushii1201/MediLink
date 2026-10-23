const express = require('express');
const db = require('../db');
const { authRequired, requireRole } = require('../middleware/auth');
const { distanceKm } = require('../services/geo');
const { calculateEstimatedWait } = require('../services/waitingEstimate');
const { logAudit } = require('../services/audit');
const { isValidCoordinate, isNonNegativeInt } = require('../middleware/validate');

const router = express.Router();

// Public endpoint for filter dropdowns: distinct specialties and insurers
router.get('/filters', (req, res) => {
  const rows = db.prepare('SELECT specialties, insurance_info FROM hospitals').all();
  const specialtiesSet = new Set();
  const insurersSet = new Set();

  for (const row of rows) {
    if (row.specialties) {
      row.specialties.split(',').map(s => s.trim()).filter(Boolean).forEach(s => specialtiesSet.add(s));
    }
    if (row.insurance_info) {
      row.insurance_info.split(',').map(i => i.trim()).filter(Boolean).forEach(i => insurersSet.add(i));
    }
  }

  res.json({
    specialties: Array.from(specialtiesSet).sort(),
    insurers: Array.from(insurersSet).sort(),
  });
});

// Search & list hospitals with comprehensive filters and sorting
router.get('/', (req, res) => {
  const { q, specialty, insurance, min_beds, has_icu, has_ventilator, lat, lng, sort } = req.query;

  let hospitals = db.prepare('SELECT * FROM hospitals').all();

  // Basic keyword search
  if (q && q.trim()) {
    const needle = q.trim().toLowerCase();
    hospitals = hospitals.filter(h =>
      (h.name || '').toLowerCase().includes(needle) ||
      (h.address || '').toLowerCase().includes(needle) ||
      (h.description || '').toLowerCase().includes(needle)
    );
  }

  // Specialty filter
  if (specialty && specialty.trim()) {
    const needle = specialty.trim().toLowerCase();
    hospitals = hospitals.filter(h => (h.specialties || '').toLowerCase().includes(needle));
  }

  // Insurance filter
  if (insurance && insurance.trim()) {
    const needle = insurance.trim().toLowerCase();
    hospitals = hospitals.filter(h => (h.insurance_info || '').toLowerCase().includes(needle));
  }

  const resourceStmt = db.prepare('SELECT type, total, available FROM resources WHERE hospital_id = ?');
  const doctorStmt = db.prepare('SELECT COUNT(*) AS count FROM doctors WHERE hospital_id = ? AND available = 1');
  const waitStmt = db.prepare('SELECT minutes FROM waiting_times WHERE hospital_id = ?');
  const pendingStmt = db.prepare("SELECT COUNT(*) AS count FROM admissions WHERE hospital_id = ? AND status = 'PENDING'");

  const hasCoords = lat !== undefined && lng !== undefined && isValidCoordinate(lat, lng);
  const userLat = hasCoords ? Number(lat) : null;
  const userLng = hasCoords ? Number(lng) : null;

  hospitals = hospitals.map(h => {
    const resources = resourceStmt.all(h.hospital_id);
    const doctorsAvailable = doctorStmt.get(h.hospital_id)?.count || 0;
    const pendingAdmissions = pendingStmt.get(h.hospital_id)?.count || 0;

    const bedRes = resources.find(r => r.type === 'BED') || { total: 0, available: 0 };
    const icuRes = resources.find(r => r.type === 'ICU') || { total: 0, available: 0 };
    const ventRes = resources.find(r => r.type === 'VENTILATOR') || { total: 0, available: 0 };

    // Compute average estimated waiting time across departments
    const rawWaits = waitStmt.all(h.hospital_id);
    let avgWaitMinutes = 45;
    if (rawWaits.length > 0) {
      const estimatedWaits = rawWaits.map(w =>
        calculateEstimatedWait(w.minutes, bedRes.total, bedRes.available, pendingAdmissions).estimated_minutes
      );
      avgWaitMinutes = Math.round(estimatedWaits.reduce((acc, v) => acc + v, 0) / estimatedWaits.length);
    }

    const dist = hasCoords ? distanceKm(userLat, userLng, h.latitude, h.longitude) : null;

    return {
      ...h,
      resources,
      available_beds: bedRes.available,
      available_icu: icuRes.available,
      available_ventilators: ventRes.available,
      doctors_available: doctorsAvailable,
      avg_wait_minutes: avgWaitMinutes,
      distance_km: dist,
    };
  });

  // Resource capacity filters
  if (min_beds) {
    const threshold = Number(min_beds);
    if (!isNaN(threshold)) {
      hospitals = hospitals.filter(h => h.available_beds >= threshold);
    }
  }
  if (has_icu === 'true' || has_icu === '1') {
    hospitals = hospitals.filter(h => h.available_icu > 0);
  }
  if (has_ventilator === 'true' || has_ventilator === '1') {
    hospitals = hospitals.filter(h => h.available_ventilators > 0);
  }

  // Sorting
  if (sort === 'distance' && hasCoords) {
    hospitals.sort((a, b) => (a.distance_km ?? Infinity) - (b.distance_km ?? Infinity));
  } else if (sort === 'beds') {
    hospitals.sort((a, b) => b.available_beds - a.available_beds);
  } else if (sort === 'wait') {
    hospitals.sort((a, b) => a.avg_wait_minutes - b.avg_wait_minutes);
  } else if (hasCoords) {
    // Default sort by distance if location provided
    hospitals.sort((a, b) => (a.distance_km ?? Infinity) - (b.distance_km ?? Infinity));
  }

  res.json(hospitals);
});

// Hospital details by ID
router.get('/:id', (req, res) => {
  const hospital = db.prepare('SELECT * FROM hospitals WHERE hospital_id = ?').get(req.params.id);
  if (!hospital) return res.status(404).json({ error: 'Hospital not found' });

  const resources = db.prepare('SELECT * FROM resources WHERE hospital_id = ?').all(req.params.id);
  const doctors = db.prepare('SELECT * FROM doctors WHERE hospital_id = ?').all(req.params.id);
  const rawWaitTimes = db.prepare('SELECT * FROM waiting_times WHERE hospital_id = ?').all(req.params.id);
  const pendingCount = db.prepare("SELECT COUNT(*) AS count FROM admissions WHERE hospital_id = ? AND status = 'PENDING'").get(req.params.id)?.count || 0;

  const bedRes = resources.find(r => r.type === 'BED') || { total: 0, available: 0 };

  const waitingTimes = rawWaitTimes.map(w => {
    const calc = calculateEstimatedWait(w.minutes, bedRes.total, bedRes.available, pendingCount);
    return {
      estimate_id: w.estimate_id,
      department: w.department,
      reported_minutes: calc.reported_minutes,
      estimated_minutes: calc.estimated_minutes,
      factors: calc.factors,
      note: calc.note,
      updated_at: w.updated_at,
    };
  });

  hospital.resources = resources;
  hospital.doctors = doctors;
  hospital.waiting_times = waitingTimes;

  res.json(hospital);
});

// Admin creates hospital
router.post('/', authRequired, requireRole('ADMIN'), (req, res) => {
  const { name, address, latitude, longitude, specialties, insurance_info, phone, email, description } = req.body;
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'name is required' });

  if ((latitude !== undefined || longitude !== undefined) && !isValidCoordinate(latitude, longitude)) {
    return res.status(400).json({ error: 'Valid latitude (-90 to 90) and longitude (-180 to 180) are required' });
  }

  const info = db.prepare(`
    INSERT INTO hospitals (name, address, latitude, longitude, specialties, insurance_info, phone, email, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    name.trim(),
    address || null,
    latitude ?? null,
    longitude ?? null,
    specialties || null,
    insurance_info || null,
    phone || null,
    email || null,
    description || null
  );

  const hospitalId = info.lastInsertRowid;

  // Initialize default resources for the hospital
  const insertResource = db.prepare('INSERT INTO resources (hospital_id, type, total, available) VALUES (?, ?, ?, ?)');
  insertResource.run(hospitalId, 'BED', 50, 20);
  insertResource.run(hospitalId, 'ICU', 10, 3);
  insertResource.run(hospitalId, 'VENTILATOR', 5, 2);

  logAudit(db, {
    user_id: req.user.user_id,
    action: 'CREATE',
    entity: 'hospitals',
    entity_id: hospitalId,
  });

  res.status(201).json({ hospital_id: hospitalId });
});

// Admin deletes a hospital (guarded: cannot delete if admissions exist)
router.delete('/:id', authRequired, requireRole('ADMIN'), (req, res) => {
  const hospitalId = Number(req.params.id);
  const hospital = db.prepare('SELECT * FROM hospitals WHERE hospital_id = ?').get(hospitalId);
  if (!hospital) return res.status(404).json({ error: 'Hospital not found' });

  const admissionCount = db.prepare('SELECT COUNT(*) AS count FROM admissions WHERE hospital_id = ?').get(hospitalId).count;
  if (admissionCount > 0) {
    return res.status(409).json({ error: 'Cannot delete hospital with existing admissions' });
  }

  const deleteTx = db.transaction(() => {
    db.prepare('DELETE FROM doctors WHERE hospital_id = ?').run(hospitalId);
    db.prepare('DELETE FROM resources WHERE hospital_id = ?').run(hospitalId);
    db.prepare('DELETE FROM waiting_times WHERE hospital_id = ?').run(hospitalId);
    db.prepare('DELETE FROM ai_recommendations WHERE hospital_id = ?').run(hospitalId);
    db.prepare('UPDATE users SET hospital_id = NULL WHERE hospital_id = ?').run(hospitalId);
    db.prepare('DELETE FROM hospitals WHERE hospital_id = ?').run(hospitalId);
  });

  deleteTx();

  logAudit(db, {
    user_id: req.user.user_id,
    action: 'DELETE',
    entity: 'hospitals',
    entity_id: hospitalId,
  });

  res.json({ ok: true, message: 'Hospital deleted successfully' });
});

// Update hospital profile (Hospital resource manager or Admin)
router.put('/:id/profile', authRequired, requireRole('HOSPITAL', 'ADMIN'), (req, res) => {
  const hospitalId = Number(req.params.id);
  if (req.user.role === 'HOSPITAL' && req.user.hospital_id !== hospitalId) {
    return res.status(403).json({ error: 'You can only update your own hospital profile' });
  }

  const hospital = db.prepare('SELECT * FROM hospitals WHERE hospital_id = ?').get(hospitalId);
  if (!hospital) return res.status(404).json({ error: 'Hospital not found' });

  const { name, address, latitude, longitude, specialties, insurance_info, phone, email, description } = req.body;
  if (name !== undefined && !String(name).trim()) return res.status(400).json({ error: 'name cannot be empty' });

  if ((latitude !== undefined || longitude !== undefined) && !isValidCoordinate(latitude, longitude)) {
    return res.status(400).json({ error: 'Valid latitude (-90 to 90) and longitude (-180 to 180) are required' });
  }

  db.prepare(`
    UPDATE hospitals
    SET name = COALESCE(?, name),
        address = COALESCE(?, address),
        latitude = COALESCE(?, latitude),
        longitude = COALESCE(?, longitude),
        specialties = COALESCE(?, specialties),
        insurance_info = COALESCE(?, insurance_info),
        phone = COALESCE(?, phone),
        email = COALESCE(?, email),
        description = COALESCE(?, description)
    WHERE hospital_id = ?
  `).run(
    name?.trim() || null,
    address ?? null,
    latitude ?? null,
    longitude ?? null,
    specialties ?? null,
    insurance_info ?? null,
    phone ?? null,
    email ?? null,
    description ?? null,
    hospitalId
  );

  logAudit(db, {
    user_id: req.user.user_id,
    action: 'UPDATE_PROFILE',
    entity: 'hospitals',
    entity_id: hospitalId,
  });

  res.json(db.prepare('SELECT * FROM hospitals WHERE hospital_id = ?').get(hospitalId));
});

// Resource creation if a hospital lacks a BED/ICU/VENTILATOR row
router.post('/:id/resources', authRequired, requireRole('HOSPITAL', 'ADMIN'), (req, res) => {
  const hospitalId = Number(req.params.id);
  if (req.user.role === 'HOSPITAL' && req.user.hospital_id !== hospitalId) {
    return res.status(403).json({ error: 'You can only create resources for your own hospital' });
  }
  if (req.user.role === 'HOSPITAL' && req.user.staff_role !== 'RESOURCE_MANAGER') {
    return res.status(403).json({
      error: 'Access Denied: Only authorized hospital resource managers or administrators can create facility resources.',
    });
  }

  const { type, total, available } = req.body;
  const validTypes = ['BED', 'ICU', 'VENTILATOR'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: `type must be one of: ${validTypes.join(', ')}` });
  }

  if (!isNonNegativeInt(total) || !isNonNegativeInt(available)) {
    return res.status(400).json({ error: 'total and available must be non-negative integers' });
  }
  if (Number(available) > Number(total)) {
    return res.status(400).json({ error: 'available cannot exceed total capacity' });
  }

  const existing = db.prepare('SELECT * FROM resources WHERE hospital_id = ? AND type = ?').get(hospitalId, type);
  if (existing) {
    return res.status(409).json({ error: `Resource of type ${type} already exists for this hospital. Use PUT to update.` });
  }

  const info = db.prepare('INSERT INTO resources (hospital_id, type, total, available) VALUES (?, ?, ?, ?)')
    .run(hospitalId, type, Number(total), Number(available));

  logAudit(db, {
    user_id: req.user.user_id,
    action: 'CREATE_RESOURCE',
    entity: 'resources',
    entity_id: info.lastInsertRowid,
  });

  res.status(201).json(db.prepare('SELECT * FROM resources WHERE resource_id = ?').get(info.lastInsertRowid));
});

// Update hospital resource count (Restricted to Hospital Resource Managers and Admins)
router.put('/:id/resources/:resourceId', authRequired, requireRole('HOSPITAL', 'ADMIN'), (req, res) => {
  const hospitalId = Number(req.params.id);
  if (req.user.role === 'HOSPITAL' && req.user.hospital_id !== hospitalId) {
    return res.status(403).json({ error: 'You can only update your own hospital resources' });
  }

  if (req.user.role === 'HOSPITAL' && req.user.staff_role !== 'RESOURCE_MANAGER') {
    return res.status(403).json({
      error: 'Access Denied: Doctors and clinical staff are not authorized to modify hospital resource capacity or availability. Contact your hospital resource manager.',
    });
  }

  const resource = db.prepare('SELECT * FROM resources WHERE resource_id = ? AND hospital_id = ?').get(req.params.resourceId, hospitalId);
  if (!resource) return res.status(404).json({ error: 'Resource not found' });

  const { total, available } = req.body;
  const newTotal = total !== undefined ? Number(total) : resource.total;
  const newAvailable = available !== undefined ? Number(available) : resource.available;

  if (!isNonNegativeInt(newTotal) || !isNonNegativeInt(newAvailable)) {
    return res.status(400).json({ error: 'total and available must be non-negative integers' });
  }
  if (newAvailable > newTotal) {
    return res.status(400).json({ error: 'available cannot exceed total capacity' });
  }

  // Handle capacity correctly: cannot reduce total capacity below currently occupied beds
  const currentlyOccupied = Math.max(0, resource.total - resource.available);
  if (total !== undefined && newTotal < currentlyOccupied) {
    return res.status(409).json({
      error: `Cannot reduce total capacity to ${newTotal}. There are currently ${currentlyOccupied} occupied ${resource.type.toLowerCase()} units in use.`,
    });
  }

  db.prepare('UPDATE resources SET total = ?, available = ? WHERE resource_id = ?')
    .run(newTotal, newAvailable, req.params.resourceId);

  logAudit(db, {
    user_id: req.user.user_id,
    action: 'UPDATE_RESOURCE',
    entity: 'resources',
    entity_id: resource.resource_id,
    details: { total: newTotal, available: newAvailable },
  });

  res.json(db.prepare('SELECT * FROM resources WHERE resource_id = ?').get(req.params.resourceId));
});

// Add doctor
router.post('/:id/doctors', authRequired, requireRole('HOSPITAL', 'ADMIN'), (req, res) => {
  const hospitalId = Number(req.params.id);
  if (req.user.role === 'HOSPITAL' && req.user.hospital_id !== hospitalId) {
    return res.status(403).json({ error: 'You can only manage your own hospital doctors' });
  }

  const { name, specialization, qualification, available } = req.body;
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'name is required' });

  const info = db.prepare(`
    INSERT INTO doctors (hospital_id, name, specialization, qualification, available)
    VALUES (?, ?, ?, ?, ?)
  `).run(hospitalId, name.trim(), specialization || null, qualification || null, available ? 1 : 0);

  logAudit(db, {
    user_id: req.user.user_id,
    action: 'ADD_DOCTOR',
    entity: 'doctors',
    entity_id: info.lastInsertRowid,
  });

  res.status(201).json(db.prepare('SELECT * FROM doctors WHERE doctor_id = ?').get(info.lastInsertRowid));
});

// Edit doctor
router.put('/:id/doctors/:doctorId', authRequired, requireRole('HOSPITAL', 'ADMIN'), (req, res) => {
  const hospitalId = Number(req.params.id);
  if (req.user.role === 'HOSPITAL' && req.user.hospital_id !== hospitalId) {
    return res.status(403).json({ error: 'You can only manage your own hospital doctors' });
  }

  const doctor = db.prepare('SELECT * FROM doctors WHERE doctor_id = ? AND hospital_id = ?').get(req.params.doctorId, hospitalId);
  if (!doctor) return res.status(404).json({ error: 'Doctor not found' });

  const { name, specialization, qualification, available } = req.body;
  if (name !== undefined && !String(name).trim()) return res.status(400).json({ error: 'name cannot be empty' });

  db.prepare(`
    UPDATE doctors
    SET name = COALESCE(?, name),
        specialization = COALESCE(?, specialization),
        qualification = COALESCE(?, qualification),
        available = COALESCE(?, available)
    WHERE doctor_id = ? AND hospital_id = ?
  `).run(
    name?.trim() || null,
    specialization ?? null,
    qualification ?? null,
    available !== undefined ? (available ? 1 : 0) : null,
    req.params.doctorId,
    hospitalId
  );

  res.json(db.prepare('SELECT * FROM doctors WHERE doctor_id = ?').get(req.params.doctorId));
});

// Delete doctor
router.delete('/:id/doctors/:doctorId', authRequired, requireRole('HOSPITAL', 'ADMIN'), (req, res) => {
  const hospitalId = Number(req.params.id);
  if (req.user.role === 'HOSPITAL' && req.user.hospital_id !== hospitalId) {
    return res.status(403).json({ error: 'You can only manage your own hospital doctors' });
  }

  const doctor = db.prepare('SELECT * FROM doctors WHERE doctor_id = ? AND hospital_id = ?').get(req.params.doctorId, hospitalId);
  if (!doctor) return res.status(404).json({ error: 'Doctor not found' });

  db.prepare('DELETE FROM doctors WHERE doctor_id = ? AND hospital_id = ?').run(req.params.doctorId, hospitalId);

  logAudit(db, {
    user_id: req.user.user_id,
    action: 'DELETE_DOCTOR',
    entity: 'doctors',
    entity_id: req.params.doctorId,
  });

  res.json({ ok: true, message: 'Doctor deleted' });
});

// Waiting time update by hospital staff
router.put('/:id/waiting-time', authRequired, requireRole('HOSPITAL', 'ADMIN'), (req, res) => {
  const hospitalId = Number(req.params.id);
  if (req.user.role === 'HOSPITAL' && req.user.hospital_id !== hospitalId) {
    return res.status(403).json({ error: 'You can only update your own hospital waiting times' });
  }

  const { department, minutes } = req.body;
  if (!department || minutes === undefined) {
    return res.status(400).json({ error: 'department and minutes are required' });
  }
  if (!isNonNegativeInt(minutes)) {
    return res.status(400).json({ error: 'minutes must be a non-negative integer' });
  }

  const existing = db.prepare('SELECT * FROM waiting_times WHERE hospital_id = ? AND department = ?').get(hospitalId, department.trim());
  if (existing) {
    db.prepare('UPDATE waiting_times SET minutes = ?, updated_at = CURRENT_TIMESTAMP WHERE estimate_id = ?')
      .run(Number(minutes), existing.estimate_id);
  } else {
    db.prepare('INSERT INTO waiting_times (hospital_id, department, minutes) VALUES (?, ?, ?)')
      .run(hospitalId, department.trim(), Number(minutes));
  }

  logAudit(db, {
    user_id: req.user.user_id,
    action: 'UPDATE_WAITING_TIME',
    entity: 'waiting_times',
    details: { department, minutes },
  });

  res.json(db.prepare('SELECT * FROM waiting_times WHERE hospital_id = ?').all(hospitalId));
});

module.exports = router;

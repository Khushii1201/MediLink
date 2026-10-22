const express = require('express');
const db = require('../db');
const { authRequired, requireRole } = require('../middleware/auth');

const router = express.Router();

// Haversine distance in km
function distanceKm(lat1, lon1, lat2, lon2) {
  if ([lat1, lon1, lat2, lon2].some(v => v === null || v === undefined)) return null;
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Public search: ?q=name&specialty=Cardiology&lat=..&lng=..
router.get('/', (req, res) => {
  const { q, specialty, lat, lng } = req.query;
  let hospitals = db.prepare('SELECT * FROM hospitals').all();

  if (q) {
    const needle = q.toLowerCase();
    hospitals = hospitals.filter(h => h.name.toLowerCase().includes(needle) || (h.address || '').toLowerCase().includes(needle));
  }
  if (specialty) {
    const needle = specialty.toLowerCase();
    hospitals = hospitals.filter(h => (h.specialties || '').toLowerCase().includes(needle));
  }

  const resourceStmt = db.prepare('SELECT type, total, available FROM resources WHERE hospital_id = ?');
  hospitals = hospitals.map(h => {
    const resources = resourceStmt.all(h.hospital_id);
    const distance_km = lat && lng ? distanceKm(parseFloat(lat), parseFloat(lng), h.latitude, h.longitude) : null;
    return { ...h, resources, distance_km: distance_km !== null ? Math.round(distance_km * 10) / 10 : null };
  });

  if (lat && lng) hospitals.sort((a, b) => (a.distance_km ?? Infinity) - (b.distance_km ?? Infinity));

  res.json(hospitals);
});

router.get('/:id', (req, res) => {
  const hospital = db.prepare('SELECT * FROM hospitals WHERE hospital_id = ?').get(req.params.id);
  if (!hospital) return res.status(404).json({ error: 'Hospital not found' });
  hospital.resources = db.prepare('SELECT * FROM resources WHERE hospital_id = ?').all(req.params.id);
  hospital.doctors = db.prepare('SELECT * FROM doctors WHERE hospital_id = ?').all(req.params.id);
  hospital.waiting_times = db.prepare('SELECT * FROM waiting_times WHERE hospital_id = ?').all(req.params.id);
  res.json(hospital);
});

router.post('/', authRequired, requireRole('ADMIN'), (req, res) => {
  const { name, address, latitude, longitude, specialties, insurance_info } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const info = db.prepare(`INSERT INTO hospitals (name, address, latitude, longitude, specialties, insurance_info) VALUES (?,?,?,?,?,?)`)
    .run(name, address || null, latitude || null, longitude || null, specialties || null, insurance_info || null);
  res.status(201).json({ hospital_id: info.lastInsertRowid });
});

router.put('/:id/profile', authRequired, requireRole('HOSPITAL', 'ADMIN'), (req, res) => {
  const hospitalId = Number(req.params.id);
  if (req.user.role === 'HOSPITAL' && req.user.hospital_id !== hospitalId) {
    return res.status(403).json({ error: 'You can only update your own hospital profile' });
  }
  const hospital = db.prepare('SELECT * FROM hospitals WHERE hospital_id = ?').get(hospitalId);
  if (!hospital) return res.status(404).json({ error: 'Hospital not found' });
  const { name, address, latitude, longitude, specialties, insurance_info } = req.body;
  if (name !== undefined && !String(name).trim()) return res.status(400).json({ error: 'name cannot be empty' });
  db.prepare(`UPDATE hospitals SET name = COALESCE(?, name), address = COALESCE(?, address),
    latitude = COALESCE(?, latitude), longitude = COALESCE(?, longitude),
    specialties = COALESCE(?, specialties), insurance_info = COALESCE(?, insurance_info)
    WHERE hospital_id = ?`).run(name?.trim() || null, address ?? null, latitude ?? null, longitude ?? null,
    specialties ?? null, insurance_info ?? null, hospitalId);
  res.json(db.prepare('SELECT * FROM hospitals WHERE hospital_id = ?').get(hospitalId));
});

// Resources: hospital staff updates own hospital's resources
router.put('/:id/resources/:resourceId', authRequired, requireRole('HOSPITAL', 'ADMIN'), (req, res) => {
  const hospitalId = Number(req.params.id);
  if (req.user.role === 'HOSPITAL' && req.user.hospital_id !== hospitalId) {
    return res.status(403).json({ error: 'You can only update your own hospital resources' });
  }
  const { total, available } = req.body;
  const resource = db.prepare('SELECT * FROM resources WHERE resource_id = ? AND hospital_id = ?').get(req.params.resourceId, hospitalId);
  if (!resource) return res.status(404).json({ error: 'Resource not found' });
  db.prepare('UPDATE resources SET total = COALESCE(?, total), available = COALESCE(?, available) WHERE resource_id = ?')
    .run(total ?? null, available ?? null, req.params.resourceId);
  res.json(db.prepare('SELECT * FROM resources WHERE resource_id = ?').get(req.params.resourceId));
});

router.post('/:id/doctors', authRequired, requireRole('HOSPITAL', 'ADMIN'), (req, res) => {
  const hospitalId = Number(req.params.id);
  if (req.user.role === 'HOSPITAL' && req.user.hospital_id !== hospitalId) {
    return res.status(403).json({ error: 'You can only manage your own hospital doctors' });
  }
  const { name, specialization, available } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const info = db.prepare('INSERT INTO doctors (hospital_id, name, specialization, available) VALUES (?,?,?,?)')
    .run(hospitalId, name, specialization || null, available ? 1 : 0);
  res.status(201).json({ doctor_id: info.lastInsertRowid });
});

router.put('/:id/doctors/:doctorId', authRequired, requireRole('HOSPITAL', 'ADMIN'), (req, res) => {
  const hospitalId = Number(req.params.id);
  if (req.user.role === 'HOSPITAL' && req.user.hospital_id !== hospitalId) {
    return res.status(403).json({ error: 'You can only manage your own hospital doctors' });
  }
  const { available } = req.body;
  db.prepare('UPDATE doctors SET available = ? WHERE doctor_id = ? AND hospital_id = ?')
    .run(available ? 1 : 0, req.params.doctorId, hospitalId);
  res.json(db.prepare('SELECT * FROM doctors WHERE doctor_id = ?').get(req.params.doctorId));
});

router.put('/:id/waiting-time', authRequired, requireRole('HOSPITAL', 'ADMIN'), (req, res) => {
  const hospitalId = Number(req.params.id);
  if (req.user.role === 'HOSPITAL' && req.user.hospital_id !== hospitalId) {
    return res.status(403).json({ error: 'You can only update your own hospital waiting times' });
  }
  const { department, minutes } = req.body;
  if (!department || minutes === undefined) return res.status(400).json({ error: 'department and minutes are required' });
  const existing = db.prepare('SELECT * FROM waiting_times WHERE hospital_id = ? AND department = ?').get(hospitalId, department);
  if (existing) {
    db.prepare('UPDATE waiting_times SET minutes = ?, updated_at = CURRENT_TIMESTAMP WHERE estimate_id = ?').run(minutes, existing.estimate_id);
  } else {
    db.prepare('INSERT INTO waiting_times (hospital_id, department, minutes) VALUES (?,?,?)').run(hospitalId, department, minutes);
  }
  res.json(db.prepare('SELECT * FROM waiting_times WHERE hospital_id = ?').all(hospitalId));
});

module.exports = router;

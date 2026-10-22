const express = require('express');
const db = require('../db');
const { authRequired, requireRole } = require('../middleware/auth');

const router = express.Router();

function distanceKm(lat1, lon1, lat2, lon2) {
  if ([lat1, lon1, lat2, lon2].some(v => v === null || v === undefined || isNaN(v))) return null;
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Rule-based scoring model (documented stand-in for the ML/Ollama component described in the SRS):
// score = weighted combination of normalized distance, bed availability ratio, and waiting time.
router.get('/', authRequired, requireRole('PATIENT'), (req, res) => {
  const { lat, lng, specialty } = req.query;
  const hospitals = db.prepare('SELECT * FROM hospitals').all();

  const scored = hospitals
    .filter(h => !specialty || (h.specialties || '').toLowerCase().includes(specialty.toLowerCase()))
    .map(h => {
      const resources = db.prepare('SELECT * FROM resources WHERE hospital_id = ?').all(h.hospital_id);
      const beds = resources.find(r => r.type === 'BED') || { total: 1, available: 0 };
      const availabilityRatio = beds.total ? beds.available / beds.total : 0;

      const waitRow = db.prepare(`SELECT AVG(minutes) AS avg_min FROM waiting_times WHERE hospital_id = ?`).get(h.hospital_id);
      const avgWait = waitRow.avg_min || 45;
      const waitScore = Math.max(0, 1 - avgWait / 120); // lower wait -> higher score

      const dist = lat && lng ? distanceKm(parseFloat(lat), parseFloat(lng), h.latitude, h.longitude) : null;
      const distScore = dist !== null ? Math.max(0, 1 - dist / 25) : 0.5; // closer -> higher score, default neutral

      const score = (0.4 * distScore) + (0.35 * availabilityRatio) + (0.25 * waitScore);

      return {
        hospital_id: h.hospital_id,
        name: h.name,
        distance_km: dist !== null ? Math.round(dist * 10) / 10 : null,
        bed_availability: `${beds.available}/${beds.total}`,
        avg_waiting_minutes: Math.round(avgWait),
        score: Math.round(score * 100) / 100,
      };
    })
    .sort((a, b) => b.score - a.score);

  // Persist top recommendation for audit/history
  if (scored.length) {
    db.prepare('INSERT INTO ai_recommendations (patient_id, hospital_id, score, reason) VALUES (?,?,?,?)')
      .run(req.user.user_id, scored[0].hospital_id, scored[0].score, 'distance, bed availability, waiting time');
  }

  res.json({
    note: 'Estimates only — informational, not a clinical or triage decision.',
    recommendations: scored,
  });
});

router.get('/history', authRequired, requireRole('PATIENT', 'ADMIN'), (req, res) => {
  const rows = req.user.role === 'ADMIN'
    ? db.prepare(`SELECT ar.*, h.name AS hospital_name FROM ai_recommendations ar JOIN hospitals h ON h.hospital_id = ar.hospital_id ORDER BY ar.created_at DESC LIMIT 100`).all()
    : db.prepare(`SELECT ar.*, h.name AS hospital_name FROM ai_recommendations ar JOIN hospitals h ON h.hospital_id = ar.hospital_id WHERE ar.patient_id = ? ORDER BY ar.created_at DESC`).all(req.user.user_id);
  res.json(rows);
});

module.exports = router;

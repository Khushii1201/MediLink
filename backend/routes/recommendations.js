const express = require('express');
const db = require('../db');
const { authRequired, requireRole } = require('../middleware/auth');
const { distanceKm } = require('../services/geo');
const { calculateEstimatedWait } = require('../services/waitingEstimate');
const { isValidCoordinate } = require('../middleware/validate');

const router = express.Router();

const BASE_WEIGHTS = {
  DISTANCE: 0.35,
  AVAILABILITY: 0.30,
  WAIT: 0.20,
  SPECIALTY: 0.15,
};

router.get('/', authRequired, requireRole('PATIENT'), (req, res) => {
  const { lat, lng, specialty, need = 'GENERAL' } = req.query;

  const validNeeds = ['GENERAL', 'ICU', 'VENTILATOR'];
  const targetNeed = validNeeds.includes(String(need).toUpperCase()) ? String(need).toUpperCase() : 'GENERAL';
  const resourceType = targetNeed === 'ICU' ? 'ICU' : (targetNeed === 'VENTILATOR' ? 'VENTILATOR' : 'BED');

  const DEFAULT_JAIPUR_LAT = 26.9124;
  const DEFAULT_JAIPUR_LNG = 75.7873;
  const hasCoords = lat !== undefined && lng !== undefined && isValidCoordinate(lat, lng);
  const userLat = hasCoords ? Number(lat) : DEFAULT_JAIPUR_LAT;
  const userLng = hasCoords ? Number(lng) : DEFAULT_JAIPUR_LNG;

  const hasSpecialty = Boolean(specialty && String(specialty).trim());
  const specialtyNeedle = hasSpecialty ? String(specialty).trim().toLowerCase() : null;

  // Determine active weights: if no specialty requested, redistribute specialty weight across the other three
  let wDist = BASE_WEIGHTS.DISTANCE;
  let wAvail = BASE_WEIGHTS.AVAILABILITY;
  let wWait = BASE_WEIGHTS.WAIT;
  let wSpec = BASE_WEIGHTS.SPECIALTY;

  if (!hasSpecialty) {
    const baseSum = BASE_WEIGHTS.DISTANCE + BASE_WEIGHTS.AVAILABILITY + BASE_WEIGHTS.WAIT;
    wDist = BASE_WEIGHTS.DISTANCE / baseSum;
    wAvail = BASE_WEIGHTS.AVAILABILITY / baseSum;
    wWait = BASE_WEIGHTS.WAIT / baseSum;
    wSpec = 0;
  }

  const hospitals = db.prepare('SELECT * FROM hospitals').all();

  const resourceStmt = db.prepare('SELECT type, total, available FROM resources WHERE hospital_id = ?');
  const waitStmt = db.prepare('SELECT minutes FROM waiting_times WHERE hospital_id = ?');
  const pendingStmt = db.prepare("SELECT COUNT(*) AS count FROM admissions WHERE hospital_id = ? AND status = 'PENDING'");

  const scored = hospitals.map(h => {
    const resources = resourceStmt.all(h.hospital_id);
    const bedRes = resources.find(r => r.type === 'BED') || { total: 0, available: 0 };
    const targetRes = resources.find(r => r.type === resourceType) || { total: 0, available: 0 };
    const pendingCount = pendingStmt.get(h.hospital_id)?.count || 0;

    // 1. Availability score (0 to 1)
    const availRatio = targetRes.total > 0 ? targetRes.available / targetRes.total : 0;
    const availScore = Math.max(0, Math.min(1, availRatio));

    // 2. Waiting time score (0 to 1)
    const rawWaits = waitStmt.all(h.hospital_id);
    let avgWaitMinutes = 45;
    if (rawWaits.length > 0) {
      const estimatedList = rawWaits.map(w =>
        calculateEstimatedWait(w.minutes, bedRes.total, bedRes.available, pendingCount).estimated_minutes
      );
      avgWaitMinutes = Math.round(estimatedList.reduce((a, b) => a + b, 0) / estimatedList.length);
    }
    const waitScore = Math.max(0, Math.min(1, 1 - avgWaitMinutes / 120));

    // 3. Distance score (0 to 1, max 25km range, default 0.5 neutral)
    const dist = distanceKm(userLat, userLng, h.latitude, h.longitude);
    const distScore = dist !== null ? Math.max(0, Math.min(1, 1 - dist / 25)) : 0.5;

    // 4. Specialty score
    let specScore = 0;
    let specMatched = false;
    if (hasSpecialty) {
      specMatched = (h.specialties || '').toLowerCase().includes(specialtyNeedle);
      specScore = specMatched ? 1 : 0;
    }

    // 5. Eligibility verification
    const hasTargetUnit = targetRes.total > 0;
    const hasAvailableCapacity = targetRes.available > 0;
    const eligible = hasAvailableCapacity;
    const ineligibilityReasons = [];
    if (!hasTargetUnit) {
      ineligibilityReasons.push(`Facility does not maintain a ${resourceType} department.`);
    } else if (!hasAvailableCapacity) {
      ineligibilityReasons.push(`0 of ${targetRes.total} ${resourceType} units currently available.`);
    }

    // 6. Transparent "Why Recommended?" generation
    const positiveFactors = [];
    if (dist !== null) {
      if (dist <= 5) positiveFactors.push(`Near proximity (${dist} km)`);
      else if (dist <= 15) positiveFactors.push(`Within standard transit range (${dist} km)`);
    }
    if (availScore >= 0.25) positiveFactors.push(`${targetRes.available} ${resourceType} units available`);
    if (avgWaitMinutes <= 30) positiveFactors.push(`Short estimated wait time (~${avgWaitMinutes}m)`);
    if (specMatched) positiveFactors.push(`Verified specialty department for "${specialty}"`);

    const whyRecommended = eligible
      ? (positiveFactors.length > 0 ? positiveFactors.join(' · ') : `Verified facility with ${targetRes.available} ${resourceType} available.`)
      : `Ineligible: ${ineligibilityReasons.join(' ')}`;

    // Weighted composite score (0 to 1). Ineligible hospitals receive a score penalty so eligible facilities always rank first
    const rawScore = (distScore * wDist) + (availScore * wAvail) + (waitScore * wWait) + (specScore * wSpec);
    const finalScore = eligible ? rawScore : rawScore * 0.2;

    return {
      hospital_id: h.hospital_id,
      name: h.name,
      address: h.address,
      specialties: h.specialties,
      distance_km: dist,
      distance_calculation_method: 'haversine_great_circle',
      eligible,
      ineligibility_reasons: ineligibilityReasons,
      why_recommended: whyRecommended,
      target_resource: {
        type: resourceType,
        total: targetRes.total,
        available: targetRes.available,
      },
      avg_waiting_minutes: avgWaitMinutes,
      score: Math.round(finalScore * 100) / 100,
      breakdown: {
        distance: {
          score: Math.round(distScore * 100) / 100,
          weight: Math.round(wDist * 100) / 100,
          distance_km: dist,
        },
        availability: {
          score: Math.round(availScore * 100) / 100,
          weight: Math.round(wAvail * 100) / 100,
          available: targetRes.available,
          total: targetRes.total,
        },
        wait: {
          score: Math.round(waitScore * 100) / 100,
          weight: Math.round(wWait * 100) / 100,
          estimated_minutes: avgWaitMinutes,
        },
        specialty: {
          score: Math.round(specScore * 100) / 100,
          weight: Math.round(wSpec * 100) / 100,
          matched: specMatched,
        },
      },
    };
  }).sort((a, b) => {
    // 1. Eligible first
    if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
    // 2. Higher score first
    if (b.score !== a.score) return b.score - a.score;
    // 3. Deterministic tie breaker by hospital_id
    return a.hospital_id - b.hospital_id;
  });

  // Persist top recommendation only once per patient + hospital per 10 minutes
  if (scored.length > 0) {
    const top = scored[0];
    const recentLog = db.prepare(`
      SELECT recommendation_id FROM ai_recommendations
      WHERE patient_id = ? AND hospital_id = ?
        AND datetime(created_at, '+10 minutes') > datetime('now')
    `).get(req.user.user_id, top.hospital_id);

    if (!recentLog) {
      const reason = `Distance: ${top.distance_km ?? 'N/A'}km, ${top.target_resource.type}: ${top.target_resource.available}/${top.target_resource.total}, Est. wait: ${top.avg_waiting_minutes}m`;
      db.prepare(`
        INSERT INTO ai_recommendations (patient_id, hospital_id, score, reason)
        VALUES (?, ?, ?, ?)
      `).run(req.user.user_id, top.hospital_id, top.score, reason);
    }
  }

  res.json({
    note: 'Estimates only — informational, not a clinical or triage decision.',
    need: targetNeed,
    weights_applied: {
      distance: Math.round(wDist * 100) / 100,
      availability: Math.round(wAvail * 100) / 100,
      wait: Math.round(wWait * 100) / 100,
      specialty: Math.round(wSpec * 100) / 100,
    },
    recommendations: scored,
  });
});

router.get('/history', authRequired, requireRole('PATIENT', 'ADMIN'), (req, res) => {
  const rows = req.user.role === 'ADMIN'
    ? db.prepare(`
        SELECT ar.*, h.name AS hospital_name, u.name AS patient_name
        FROM ai_recommendations ar
        JOIN hospitals h ON h.hospital_id = ar.hospital_id
        JOIN users u ON u.user_id = ar.patient_id
        ORDER BY ar.created_at DESC LIMIT 100
      `).all()
    : db.prepare(`
        SELECT ar.*, h.name AS hospital_name
        FROM ai_recommendations ar
        JOIN hospitals h ON h.hospital_id = ar.hospital_id
        WHERE ar.patient_id = ?
        ORDER BY ar.created_at DESC LIMIT 100
      `).all(req.user.user_id);

  res.json(rows);
});

module.exports = router;

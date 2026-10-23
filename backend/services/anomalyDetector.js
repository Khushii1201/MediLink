/**
 * MediLink Operational Anomaly Detection & Resource Monitoring Engine
 *
 * Provides deterministic, explainable, rule-based detection of operational irregularities,
 * data integrity violations, and emergency coordination bottlenecks across Jaipur.
 */

function detectAnomalies(db, options = {}) {
  const {
    pendingAdmissionThresholdMinutes = 30,
    pendingAmbulanceThresholdMinutes = 15,
    criticalBloodThreshold = 2,
    staleGpsMinutes = 30,
  } = options;

  const anomalies = [];

  // 1. Data Integrity: Negative Resource Counts
  const negativeResources = db.prepare(`
    SELECT r.resource_id, r.hospital_id, h.name AS hospital_name, r.type, r.total, r.available
    FROM resources r
    JOIN hospitals h ON h.hospital_id = r.hospital_id
    WHERE r.available < 0 OR r.total < 0
  `).all();

  for (const r of negativeResources) {
    anomalies.push({
      id: `NEG_RES_${r.resource_id}`,
      alert_type: 'NEGATIVE_INVENTORY',
      severity: 'CRITICAL',
      entity: 'resources',
      entity_id: r.resource_id,
      timestamp: new Date().toISOString(),
      explanation: `${r.hospital_name} has invalid negative ${r.type} count: available=${r.available}, total=${r.total}.`,
      suggested_action: 'Perform emergency inventory count reconciliation.',
    });
  }

  // 2. Data Integrity: Available Exceeding Total Capacity
  const overCapacity = db.prepare(`
    SELECT r.resource_id, r.hospital_id, h.name AS hospital_name, r.type, r.total, r.available
    FROM resources r
    JOIN hospitals h ON h.hospital_id = r.hospital_id
    WHERE r.available > r.total
  `).all();

  for (const r of overCapacity) {
    anomalies.push({
      id: `OVER_CAP_${r.resource_id}`,
      alert_type: 'CAPACITY_EXCEEDED',
      severity: 'HIGH',
      entity: 'resources',
      entity_id: r.resource_id,
      timestamp: new Date().toISOString(),
      explanation: `${r.hospital_name} reported ${r.available} available ${r.type} beds, exceeding maximum physical capacity of ${r.total}.`,
      suggested_action: 'Audit ward bed allocations and update hospital total capacity.',
    });
  }

  // 3. Data Integrity: Negative or Inverted Blood Stock
  const invalidBlood = db.prepare(`
    SELECT bu.unit_id, bb.name AS bloodbank_name, bu.blood_group, bu.quantity, bu.available
    FROM blood_units bu
    JOIN blood_banks bb ON bb.bloodbank_id = bu.bloodbank_id
    WHERE bu.available < 0 OR bu.quantity < 0 OR bu.available > bu.quantity
  `).all();

  for (const b of invalidBlood) {
    anomalies.push({
      id: `INV_BLOOD_${b.unit_id}`,
      alert_type: 'INVALID_BLOOD_STOCK',
      severity: 'CRITICAL',
      entity: 'blood_units',
      entity_id: b.unit_id,
      timestamp: new Date().toISOString(),
      explanation: `${b.bloodbank_name} has corrupted ${b.blood_group} stock counts: available=${b.available}, total=${b.quantity}.`,
      suggested_action: 'Conduct manual physical count and reset inventory counts.',
    });
  }

  // 4. Safety: Duplicate Active Trips on Same Ambulance
  const duplicateAmbulanceTrips = db.prepare(`
    SELECT ambulance_id, COUNT(*) AS active_count
    FROM ambulance_requests
    WHERE status IN ('ACCEPTED', 'EN_ROUTE') AND ambulance_id IS NOT NULL
    GROUP BY ambulance_id
    HAVING COUNT(*) > 1
  `).all();

  for (const dup of duplicateAmbulanceTrips) {
    const amb = db.prepare('SELECT vehicle_no, driver_name FROM ambulances WHERE ambulance_id = ?').get(dup.ambulance_id);
    anomalies.push({
      id: `DUP_TRIP_${dup.ambulance_id}`,
      alert_type: 'DUPLICATE_ACTIVE_ASSIGNMENT',
      severity: 'CRITICAL',
      entity: 'ambulances',
      entity_id: dup.ambulance_id,
      timestamp: new Date().toISOString(),
      explanation: `Vehicle ${amb?.vehicle_no || dup.ambulance_id} is simultaneously assigned to ${dup.active_count} active emergency missions.`,
      suggested_action: 'Review dispatch console and reassign one mission to an available unit.',
    });
  }

  // 5. Workflow Bottleneck: Prolonged Pending Admissions
  const prolongedAdmissions = db.prepare(`
    SELECT a.admission_id, a.hospital_id, h.name AS hospital_name, a.severity, a.created_at,
           ROUND((julianday('now') - julianday(a.created_at)) * 1440) AS pending_minutes
    FROM admissions a
    JOIN hospitals h ON h.hospital_id = a.hospital_id
    WHERE a.status = 'PENDING'
      AND (julianday('now') - julianday(a.created_at)) * 1440 > ?
    ORDER BY a.created_at ASC
  `).all(pendingAdmissionThresholdMinutes);

  for (const adm of prolongedAdmissions) {
    anomalies.push({
      id: `LONG_ADM_${adm.admission_id}`,
      alert_type: 'PROLONGED_PENDING_ADMISSION',
      severity: adm.severity === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
      entity: 'admissions',
      entity_id: adm.admission_id,
      timestamp: new Date().toISOString(),
      explanation: `Admission #${adm.admission_id} (${adm.severity}) at ${adm.hospital_name} has been pending triage for ${adm.pending_minutes} minutes without response.`,
      suggested_action: 'Contact facility triage nurse or escalate to regional duty medical officer.',
    });
  }

  // 6. Workflow Bottleneck: Prolonged Unassigned Ambulance Requests
  const prolongedAmbulances = db.prepare(`
    SELECT ar.request_id, ar.pickup_location, ar.created_at,
           ROUND((julianday('now') - julianday(ar.created_at)) * 1440) AS pending_minutes
    FROM ambulance_requests ar
    WHERE ar.status = 'REQUESTED' AND ar.ambulance_id IS NULL
      AND (julianday('now') - julianday(ar.created_at)) * 1440 > ?
    ORDER BY ar.created_at ASC
  `).all(pendingAmbulanceThresholdMinutes);

  for (const amb of prolongedAmbulances) {
    anomalies.push({
      id: `LONG_AMB_${amb.request_id}`,
      alert_type: 'PROLONGED_UNASSIGNED_DISPATCH',
      severity: 'HIGH',
      entity: 'ambulance_requests',
      entity_id: amb.request_id,
      timestamp: new Date().toISOString(),
      explanation: `Ambulance request #${amb.request_id} at "${amb.pickup_location}" has remained queued without vehicle dispatch for ${amb.pending_minutes} minutes.`,
      suggested_action: 'Request fleet overflow assistance or mutual aid from neighboring regional zones.',
    });
  }

  // 7. Clinical Resource Shortage: Critical Low Blood Reserves
  const lowBlood = db.prepare(`
    SELECT bu.unit_id, bb.name AS bloodbank_name, bu.blood_group, bu.available, bu.quantity
    FROM blood_units bu
    JOIN blood_banks bb ON bb.bloodbank_id = bu.bloodbank_id
    WHERE bu.available <= ?
    ORDER BY bu.available ASC
  `).all(criticalBloodThreshold);

  for (const b of lowBlood) {
    anomalies.push({
      id: `LOW_BLOOD_${b.unit_id}`,
      alert_type: 'CRITICAL_BLOOD_STOCK',
      severity: b.available === 0 ? 'CRITICAL' : 'HIGH',
      entity: 'blood_units',
      entity_id: b.unit_id,
      timestamp: new Date().toISOString(),
      explanation: `${b.bloodbank_name} has critical depleted supply of ${b.blood_group}: only ${b.available} unit(s) available.`,
      suggested_action: 'Initiate targeted voluntary donor camp or request regional redistribution.',
    });
  }

  return anomalies;
}

module.exports = {
  detectAnomalies,
};

process.env.NODE_ENV = 'test';
process.env.DB_PATH = ':memory:';

const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');

const db = require('../db');
const { seedDatabase } = require('../seed');
const { distanceKm } = require('../services/geo');
const { calculateEstimatedWait } = require('../services/waitingEstimate');
const { getCompatibleDonorGroups, isDonorCompatible } = require('../services/bloodCompatibility');
const { detectAnomalies } = require('../services/anomalyDetector');
const { isValidCoordinate, isValidEmail, isValidPhone } = require('../middleware/validate');

before(() => {
  seedDatabase();
});

describe('Unit Tests: Core Algorithms & Pure Domain Services', () => {
  test('Haversine distance calculation is accurate across Jaipur coordinates', () => {
    // Distance between SMS Hospital (26.8953, 75.8155) and SDMH (26.8911, 75.8062) ~1.04 km
    const dist = distanceKm(26.8953, 75.8155, 26.8911, 75.8062);
    assert.ok(dist !== null, 'Distance should not be null');
    assert.ok(dist >= 0.8 && dist <= 1.3, `Expected ~1.04 km, got ${dist} km`);

    // Distance between SMS Hospital and Fortis Escorts Jaipur (26.8524, 75.8055) ~4.87 km
    const distFortis = distanceKm(26.8953, 75.8155, 26.8524, 75.8055);
    assert.ok(distFortis >= 4.0 && distFortis <= 5.5, `Expected ~4.87 km, got ${distFortis} km`);

    // Identical points return 0
    assert.equal(distanceKm(26.9124, 75.7873, 26.9124, 75.7873), 0);

    // Invalid coordinates return null
    assert.equal(distanceKm(null, 75.7873, 26.9124, 75.7873), null);
    assert.equal(distanceKm(95.0, 75.7873, 26.9124, 75.7873), null);
  });

  test('Waiting time estimation formula dynamically adjusts with bed occupancy and pending queue', () => {
    // Base 30 min, 100 total, 50 available (50% occupancy), 0 pending
    // formula: 30 * (1 + 0.5 * 0.5) + (5 * 0) = 30 * 1.25 = 37.5 -> 38
    const res1 = calculateEstimatedWait(30, 100, 50, 0);
    assert.equal(res1.estimated_minutes, 38);

    // With 4 pending admissions: 37.5 + (4 * 5) = 57.5 -> 58
    const res2 = calculateEstimatedWait(30, 100, 50, 4);
    assert.equal(res2.estimated_minutes, 58);

    // Full hospital (0 available beds, 100% occupancy): 30 * (1 + 1.0 * 0.5) = 45 min
    const res3 = calculateEstimatedWait(30, 100, 0, 0);
    assert.equal(res3.estimated_minutes, 45);
  });

  test('Blood compatibility matrix enforces ABO and Rh-D transfusion matching rules', () => {
    // Universal donor O- can only receive from O-
    assert.deepEqual(getCompatibleDonorGroups('O-'), ['O-']);
    assert.equal(isDonorCompatible('O-', 'O-'), true);
    assert.equal(isDonorCompatible('O+', 'O-'), false);

    // Universal recipient AB+ can receive from all 8 blood groups
    const abPlusDonors = getCompatibleDonorGroups('AB+');
    assert.equal(abPlusDonors.length, 8);
    assert.equal(isDonorCompatible('O-', 'AB+'), true);
    assert.equal(isDonorCompatible('B+', 'AB+'), true);
    assert.equal(isDonorCompatible('A-', 'AB+'), true);

    // A+ can receive A+, A-, O+, O-
    const aPlusDonors = getCompatibleDonorGroups('A+');
    assert.deepEqual(aPlusDonors, ['A+', 'A-', 'O+', 'O-']);
    assert.equal(isDonorCompatible('B+', 'A+'), false);
    assert.equal(isDonorCompatible('AB+', 'A+'), false);

    // Invalid group returns empty array
    assert.deepEqual(getCompatibleDonorGroups('XYZ'), []);
  });

  test('Anomaly detector identifies prolonged pending admissions and critical low blood reserves', () => {
    // 1. Critical low blood stock is detected from seeded low reserves
    const initialAlerts = detectAnomalies(db);
    const lowBloodAlert = initialAlerts.find(a => a.alert_type === 'CRITICAL_BLOOD_STOCK');
    assert.ok(lowBloodAlert, 'Should detect CRITICAL_BLOOD_STOCK from seeded low inventory');
    assert.equal(lowBloodAlert.entity, 'blood_units');

    // 2. Insert prolonged pending admission (created 45 mins ago)
    const info = db.prepare(`
      INSERT INTO admissions (patient_id, hospital_id, reason, severity, status, created_at)
      VALUES (2, 1, 'Delayed triage case', 'CRITICAL', 'PENDING', datetime('now', '-45 minutes'))
    `).run();

    const alertsWithDelayed = detectAnomalies(db);
    const delayedAlert = alertsWithDelayed.find(a => a.alert_type === 'PROLONGED_PENDING_ADMISSION');
    assert.ok(delayedAlert, 'Should detect PROLONGED_PENDING_ADMISSION');
    assert.equal(delayedAlert.severity, 'CRITICAL');
    assert.equal(delayedAlert.entity_id, info.lastInsertRowid);

    // Clean up
    db.prepare('DELETE FROM admissions WHERE admission_id = ?').run(info.lastInsertRowid);
  });

  test('Input validation middleware rejects out-of-bounds coordinates and malformed contacts', () => {
    assert.equal(isValidCoordinate(28.6139, 77.2090), true);
    assert.equal(isValidCoordinate(-91, 77.2090), false);
    assert.equal(isValidCoordinate(28.6139, 185), false);
    assert.equal(isValidCoordinate('invalid', 77.2090), false);

    assert.equal(isValidEmail('patient@medilink.com'), true);
    assert.equal(isValidEmail('not-an-email'), false);
    assert.equal(isValidEmail(''), false);

    assert.equal(isValidPhone('+91-9811100001'), true);
    assert.equal(isValidPhone('9811100001'), true);
    assert.equal(isValidPhone('123'), false);
  });
});

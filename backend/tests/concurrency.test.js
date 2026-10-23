process.env.NODE_ENV = 'test';
process.env.DB_PATH = ':memory:';

const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const { seedDatabase } = require('../seed');
const app = require('../server');
const db = require('../db');
const { expireStaleReservations } = require('../services/bloodCompatibility');

let patientToken;
let patient2Token;
let hospitalToken;
let bloodbankToken;

before(async () => {
  seedDatabase();

  const login = async (email, password) => {
    const res = await request(app).post('/api/auth/login').send({ email, password });
    return res.body.token;
  };

  patientToken = await login('patient@medilink.com', 'password123');
  patient2Token = await login('patient2@medilink.com', 'password123');
  hospitalToken = await login('hospital@medilink.com', 'password123');
  bloodbankToken = await login('bloodbank@medilink.com', 'password123');
});

describe('Concurrency & Race-Condition Safeguards', () => {
  test('Two patients competing for the final available bed: exactly one succeeds, second gets 409, inventory never negative', async () => {
    // 1. Set AIIMS (hospital 1) BED available to exactly 1
    db.prepare("UPDATE resources SET available = 1 WHERE hospital_id = 1 AND type = 'BED'").run();

    // 2. Both patients submit admission requests to hospital 1
    const adm1Res = await request(app)
      .post('/api/admissions')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ hospital_id: 1, reason: 'Patient 1 Trauma', severity: 'CRITICAL' });
    assert.equal(adm1Res.status, 201);
    const id1 = adm1Res.body.admission_id;

    const adm2Res = await request(app)
      .post('/api/admissions')
      .set('Authorization', `Bearer ${patient2Token}`)
      .send({ hospital_id: 1, reason: 'Patient 2 Trauma', severity: 'CRITICAL' });
    assert.equal(adm2Res.status, 201);
    const id2 = adm2Res.body.admission_id;

    // 3. Hospital staff accepts admission 1 -> succeeds, decrements bed to 0
    const accept1 = await request(app)
      .put(`/api/admissions/${id1}/status`)
      .set('Authorization', `Bearer ${hospitalToken}`)
      .send({ status: 'ACCEPTED' });
    assert.equal(accept1.status, 200);

    // Bed count must be 0
    const bedAfterFirst = db.prepare("SELECT available FROM resources WHERE hospital_id = 1 AND type = 'BED'").get().available;
    assert.equal(bedAfterFirst, 0, 'Bed count must be exactly 0 after first acceptance');

    // 4. Hospital staff tries to accept admission 2 -> must fail with 409 No beds available
    const accept2 = await request(app)
      .put(`/api/admissions/${id2}/status`)
      .set('Authorization', `Bearer ${hospitalToken}`)
      .send({ status: 'ACCEPTED' });
    assert.equal(accept2.status, 409);
    assert.match(accept2.body.error, /No beds available/i);

    // Bed count must STILL be 0, never negative
    const bedAfterSecond = db.prepare("SELECT available FROM resources WHERE hospital_id = 1 AND type = 'BED'").get().available;
    assert.equal(bedAfterSecond, 0, 'Bed count must remain 0 and never drop below 0');

    // 5. Patient 1 cancels accepted admission -> restores 1 bed
    const cancelRes = await request(app)
      .put(`/api/admissions/${id1}/cancel`)
      .set('Authorization', `Bearer ${patientToken}`);
    assert.equal(cancelRes.status, 200);

    const bedAfterCancel = db.prepare("SELECT available FROM resources WHERE hospital_id = 1 AND type = 'BED'").get().available;
    assert.equal(bedAfterCancel, 1, 'Bed count must be restored to 1 upon cancellation');

    // 6. Now admission 2 can be accepted
    const accept2Retry = await request(app)
      .put(`/api/admissions/${id2}/status`)
      .set('Authorization', `Bearer ${hospitalToken}`)
      .send({ status: 'ACCEPTED' });
    assert.equal(accept2Retry.status, 200);
  });

  test('Two concurrent ambulance requests with only 1 vehicle available: vehicle assigned to at most one, other safely queued', async () => {
    // Set all ambulances to OFFLINE except vehicle 1 (DL-01-AX-1001) which is AVAILABLE
    db.prepare("UPDATE ambulance_requests SET status = 'COMPLETED' WHERE ambulance_id = 1").run();
    db.prepare("UPDATE ambulances SET status = 'OFFLINE' WHERE ambulance_id != 1").run();
    db.prepare("UPDATE ambulances SET status = 'AVAILABLE' WHERE ambulance_id = 1").run();

    // Patient 1 requests ambulance
    const req1 = await request(app)
      .post('/api/ambulances/requests')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        pickup_location: 'Connaught Place Circle, New Delhi',
        pickup_lat: 28.6315,
        pickup_lng: 77.2167,
      });
    assert.equal(req1.status, 201);
    assert.equal(req1.body.status, 'ACCEPTED');
    assert.equal(req1.body.ambulance_id, 1, 'Ambulance 1 assigned to patient 1');

    // Vehicle 1 is now ON_TRIP in DB
    const ambState = db.prepare('SELECT status FROM ambulances WHERE ambulance_id = 1').get().status;
    assert.equal(ambState, 'ON_TRIP');

    // Patient 2 requests ambulance immediately afterwards
    const req2 = await request(app)
      .post('/api/ambulances/requests')
      .set('Authorization', `Bearer ${patient2Token}`)
      .send({
        pickup_location: 'Hauz Khas Village, New Delhi',
        pickup_lat: 28.5494,
        pickup_lng: 77.1932,
      });
    assert.equal(req2.status, 201);
    assert.equal(req2.body.status, 'REQUESTED', 'Patient 2 must be queued as REQUESTED when no ambulance is free');
    assert.equal(req2.body.ambulance_id, null, 'Must NOT assign an already engaged ambulance');

    // Invariant check: Ambulance 1 has exactly ONE active mission
    const activeTripsCount = db.prepare(`
      SELECT COUNT(*) c FROM ambulance_requests
      WHERE ambulance_id = 1 AND status IN ('ACCEPTED', 'EN_ROUTE')
    `).get().c;
    assert.equal(activeTripsCount, 1, 'Ambulance 1 must never have more than 1 active trip');
  });

  test('Concurrent blood reservations: only available stock can be approved, inventory never negative', async () => {
    // Red Cross blood bank (id: 1) AB- group has unit_id = 6. Set available = 1
    const targetUnit = db.prepare("SELECT unit_id, quantity FROM blood_units WHERE bloodbank_id = 1 AND blood_group = 'AB-'").get();
    db.prepare('UPDATE blood_units SET available = 1, quantity = 5 WHERE unit_id = ?').run(targetUnit.unit_id);

    // Patient 1 reserves 1 unit
    const res1 = await request(app)
      .post('/api/bloodbank/reservations')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ unit_id: targetUnit.unit_id, units_requested: 1 });
    assert.equal(res1.status, 201);

    // Patient 2 reserves 1 unit
    const res2 = await request(app)
      .post('/api/bloodbank/reservations')
      .set('Authorization', `Bearer ${patient2Token}`)
      .send({ unit_id: targetUnit.unit_id, units_requested: 1 });
    assert.equal(res2.status, 201);

    // Blood bank approves reservation 1 -> succeeds, available becomes 0
    const approve1 = await request(app)
      .put(`/api/bloodbank/reservations/${res1.body.reservation_id}`)
      .set('Authorization', `Bearer ${bloodbankToken}`)
      .send({ status: 'APPROVED' });
    assert.equal(approve1.status, 200);

    const stockAfter1 = db.prepare('SELECT available FROM blood_units WHERE unit_id = ?').get(targetUnit.unit_id).available;
    assert.equal(stockAfter1, 0, 'Available stock must be 0');

    // Blood bank attempts to approve reservation 2 -> must fail with 409 Insufficient blood units
    const approve2 = await request(app)
      .put(`/api/bloodbank/reservations/${res2.body.reservation_id}`)
      .set('Authorization', `Bearer ${bloodbankToken}`)
      .send({ status: 'APPROVED' });
    assert.equal(approve2.status, 409);
    assert.match(approve2.body.error, /Insufficient/i);

    // Stock must not drop below 0
    const stockAfter2 = db.prepare('SELECT available FROM blood_units WHERE unit_id = ?').get(targetUnit.unit_id).available;
    assert.equal(stockAfter2, 0, 'Available stock must remain 0 and never drop below 0');

    // Repeated fulfillment does not decrement stock again
    const fulfill1 = await request(app)
      .put(`/api/bloodbank/reservations/${res1.body.reservation_id}`)
      .set('Authorization', `Bearer ${bloodbankToken}`)
      .send({ status: 'FULFILLED' });
    assert.equal(fulfill1.status, 200);

    const stockAfterFulfill = db.prepare('SELECT available FROM blood_units WHERE unit_id = ?').get(targetUnit.unit_id).available;
    assert.equal(stockAfterFulfill, 0, 'Fulfillment does not decrement stock again');
  });

  test('Reservation expiry releases hold safely and is idempotent upon repeated runs', async () => {
    // Create an approved reservation and artificially age it by 25 hours
    const unit = db.prepare("SELECT unit_id, available, quantity FROM blood_units WHERE bloodbank_id = 1 AND blood_group = 'O+'").get();
    const initialAvail = unit.available;

    const res = await request(app)
      .post('/api/bloodbank/reservations')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ unit_id: unit.unit_id, units_requested: 2 });
    assert.equal(res.status, 201);
    const resId = res.body.reservation_id;

    // Approve reservation -> decrements available by 2
    await request(app)
      .put(`/api/bloodbank/reservations/${resId}`)
      .set('Authorization', `Bearer ${bloodbankToken}`)
      .send({ status: 'APPROVED' });

    const postApproveAvail = db.prepare('SELECT available FROM blood_units WHERE unit_id = ?').get(unit.unit_id).available;
    assert.equal(postApproveAvail, initialAvail - 2);

    // Age reservation past 24 hours
    db.prepare("UPDATE reservations SET updated_at = datetime('now', '-26 hours') WHERE reservation_id = ?").run(resId);

    // Run expiry
    const expiredIds = expireStaleReservations(db, 24);
    assert.ok(expiredIds.includes(resId), 'Reservation should be marked expired');

    // Stock should be restored by 2
    const postExpiryAvail = db.prepare('SELECT available FROM blood_units WHERE unit_id = ?').get(unit.unit_id).available;
    assert.equal(postExpiryAvail, initialAvail, 'Expired units must be restored to available inventory');

    // Running expiry again is idempotent: 0 additional units expired, stock does not increment again
    const expiredIdsSecondRun = expireStaleReservations(db, 24);
    assert.equal(expiredIdsSecondRun.length, 0, 'Repeated expiry run must be idempotent');

    const postSecondRunAvail = db.prepare('SELECT available FROM blood_units WHERE unit_id = ?').get(unit.unit_id).available;
    assert.equal(postSecondRunAvail, initialAvail, 'Stock must not be double-restored');
  });
});

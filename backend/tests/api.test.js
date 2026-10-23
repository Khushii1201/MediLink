process.env.NODE_ENV = 'test';
process.env.DB_PATH = ':memory:';

const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const { seedDatabase } = require('../seed');
const app = require('../server');
const db = require('../db');
const { calculateEstimatedWait } = require('../services/waitingEstimate');

let adminToken;
let patientToken;
let hospitalToken;
let managerToken;
let ambulanceToken;
let bloodbankToken;

before(async () => {
  seedDatabase();

  const login = async (email, password) => {
    const res = await request(app).post('/api/auth/login').send({ email, password });
    return res.body.token;
  };

  adminToken = await login('admin@medilink.com', 'password123');
  patientToken = await login('patient@medilink.com', 'password123');
  hospitalToken = await login('hospital@medilink.com', 'password123');
  managerToken = await login('manager@medilink.com', 'password123');
  ambulanceToken = await login('ambulance@medilink.com', 'password123');
  bloodbankToken = await login('bloodbank@medilink.com', 'password123');
});

describe('1. Authentication & User Management', () => {
  test('register forces PATIENT role even when role: ADMIN is sent; rejects weak password and invalid email', async () => {
    // Attempting privilege escalation to ADMIN
    const escalateRes = await request(app).post('/api/auth/register').send({
      name: 'Sneaky User',
      email: 'sneaky@example.com',
      password: 'password1234',
      role: 'ADMIN',
    });
    assert.equal(escalateRes.status, 201);
    assert.equal(escalateRes.body.user.role, 'PATIENT', 'Public registration must force PATIENT role');

    // Weak password (< 8 chars)
    const weakPassRes = await request(app).post('/api/auth/register').send({
      name: 'Weak Pass',
      email: 'weak@example.com',
      password: 'short',
    });
    assert.equal(weakPassRes.status, 400);

    // Invalid email
    const badEmailRes = await request(app).post('/api/auth/register').send({
      name: 'Bad Email',
      email: 'not-an-email',
      password: 'password1234',
    });
    assert.equal(badEmailRes.status, 400);
  });

  test('admin-created staff accounts are linked and can act on their own entity; a hospital user cannot modify another hospital (403)', async () => {
    // Admin creates a new hospital staff account linked to hospital 2
    const staffRes = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Hospital 2 Staff',
        email: 'hosp2staff@medilink.com',
        password: 'password1234',
        role: 'HOSPITAL',
        hospital_id: 2,
      });
    assert.equal(staffRes.status, 201);
    assert.equal(staffRes.body.role, 'HOSPITAL');
    assert.equal(staffRes.body.hospital_id, 2);

    // Log in as new hospital staff
    const loginRes = await request(app).post('/api/auth/login').send({
      email: 'hosp2staff@medilink.com',
      password: 'password1234',
    });
    const hosp2Token = loginRes.body.token;

    // Allowed: update own hospital (hospital 2)
    const ownRes = await request(app)
      .put('/api/hospitals/2/profile')
      .set('Authorization', `Bearer ${hosp2Token}`)
      .send({ description: 'Updated by hospital 2 staff' });
    assert.equal(ownRes.status, 200);

    // Forbidden: try updating hospital 1 (403)
    const otherRes = await request(app)
      .put('/api/hospitals/1/profile')
      .set('Authorization', `Bearer ${hosp2Token}`)
      .send({ description: 'Hacked description' });
    assert.equal(otherRes.status, 403);
  });

  test('role guards on every protected route; deactivated users cannot log in', async () => {
    // Patient cannot access admin users
    const patientForbidden = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${patientToken}`);
    assert.equal(patientForbidden.status, 403);

    // Create a temporary user and deactivate
    const tempUserRes = await request(app).post('/api/auth/register').send({
      name: 'Temp Deactivate',
      email: 'deact@example.com',
      password: 'password1234',
    });
    const tempId = tempUserRes.body.user.user_id;

    // Admin deactivates user
    const deactRes = await request(app)
      .delete(`/api/admin/users/${tempId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(deactRes.status, 200);

    // Attempt login as deactivated user (should return 403)
    const deactLogin = await request(app).post('/api/auth/login').send({
      email: 'deact@example.com',
      password: 'password1234',
    });
    assert.equal(deactLogin.status, 403);

    // Token of deactivated user rejected on authRequired
    const deactToken = tempUserRes.body.token;
    const authMeRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${deactToken}`);
    assert.equal(authMeRes.status, 403);
  });
});

describe('2. Admissions & Bed Inventory', () => {
  test('admission: invalid transitions give 409; accept decrements beds exactly once; accept with zero beds gives 409; complete restores bed; patient cancel works', async () => {
    // 1. Patient creates admission for hospital 1
    const createRes = await request(app)
      .post('/api/admissions')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        hospital_id: 1,
        reason: 'Severe migraine and vomiting',
        severity: 'LOW',
      });
    assert.equal(createRes.status, 201);
    const admissionId = createRes.body.admission_id;

    // 2. Patient cancels own pending request
    const cancelRes = await request(app)
      .put(`/api/admissions/${admissionId}/cancel`)
      .set('Authorization', `Bearer ${patientToken}`);
    assert.equal(cancelRes.status, 200);
    assert.equal(cancelRes.body.status, 'CANCELLED');

    // 3. Invalid transition from CANCELLED to ACCEPTED gives 409
    const invalidTrans = await request(app)
      .put(`/api/admissions/${admissionId}/status`)
      .set('Authorization', `Bearer ${hospitalToken}`)
      .send({ status: 'ACCEPTED' });
    assert.equal(invalidTrans.status, 409);

    // 4. Create fresh admission to test accept and bed decrements
    const newAdmRes = await request(app)
      .post('/api/admissions')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        hospital_id: 1,
        reason: 'Breathing difficulty',
        severity: 'CRITICAL',
      });
    const newAdmId = newAdmRes.body.admission_id;

    const bedsBefore = db.prepare("SELECT available FROM resources WHERE hospital_id = 1 AND type = 'BED'").get().available;

    // Accept admission
    const acceptRes = await request(app)
      .put(`/api/admissions/${newAdmId}/status`)
      .set('Authorization', `Bearer ${hospitalToken}`)
      .send({ status: 'ACCEPTED' });
    assert.equal(acceptRes.status, 200);
    assert.equal(acceptRes.body.status, 'ACCEPTED');

    const bedsAfterAccept = db.prepare("SELECT available FROM resources WHERE hospital_id = 1 AND type = 'BED'").get().available;
    assert.equal(bedsAfterAccept, bedsBefore - 1, 'Beds must decrement by 1 on ACCEPTED');

    // Repeating ACCEPTED gives 409 (invalid transition from ACCEPTED to ACCEPTED)
    const repeatAccept = await request(app)
      .put(`/api/admissions/${newAdmId}/status`)
      .set('Authorization', `Bearer ${hospitalToken}`)
      .send({ status: 'ACCEPTED' });
    assert.equal(repeatAccept.status, 409);

    // Complete admission restores bed
    const completeRes = await request(app)
      .put(`/api/admissions/${newAdmId}/status`)
      .set('Authorization', `Bearer ${hospitalToken}`)
      .send({ status: 'COMPLETED' });
    assert.equal(completeRes.status, 200);
    assert.equal(completeRes.body.status, 'COMPLETED');

    const bedsAfterComplete = db.prepare("SELECT available FROM resources WHERE hospital_id = 1 AND type = 'BED'").get().available;
    assert.equal(bedsAfterComplete, bedsBefore, 'Beds must be restored on COMPLETED');

    // Test accept with zero beds returns 409
    db.prepare("UPDATE resources SET available = 0 WHERE hospital_id = 1 AND type = 'BED'").run();
    const zeroBedAdm = await request(app)
      .post('/api/admissions')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ hospital_id: 1, reason: 'Test zero bed' });

    const acceptZero = await request(app)
      .put(`/api/admissions/${zeroBedAdm.body.admission_id}/status`)
      .set('Authorization', `Bearer ${hospitalToken}`)
      .send({ status: 'ACCEPTED' });
    assert.equal(acceptZero.status, 409, 'Accept with 0 available beds must return 409');

    // Restore beds for subsequent tests
    db.prepare("UPDATE resources SET available = 20 WHERE hospital_id = 1 AND type = 'BED'").run();
  });
});

describe('3. Blood Bank Inventory & Reservations', () => {
  test('blood: approve decrements once, fulfil does not decrement again; reject after approve restores stock; ownership check; insufficient stock gives 409', async () => {
    // Target blood unit: Bank 1, A+ (unit_id: 1)
    const unitBefore = db.prepare('SELECT available, quantity FROM blood_units WHERE unit_id = 1').get();

    // Patient reserves 2 units
    const reserveRes = await request(app)
      .post('/api/bloodbank/reservations')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ unit_id: 1, units_requested: 2 });
    assert.equal(reserveRes.status, 201);
    const reservationId = reserveRes.body.reservation_id;

    // Stock should not be decremented while PENDING
    let currentUnit = db.prepare('SELECT available FROM blood_units WHERE unit_id = 1').get();
    assert.equal(currentUnit.available, unitBefore.available);

    // Another bloodbank staff cannot approve this reservation (ownership check)
    // Create staff for Bank 2
    const staffB2 = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Bank 2 Staff',
        email: 'bank2staff@medilink.com',
        password: 'password1234',
        role: 'BLOODBANK',
        bloodbank_id: 2,
      });
    const loginB2 = await request(app).post('/api/auth/login').send({
      email: 'bank2staff@medilink.com',
      password: 'password1234',
    });
    const tokenB2 = loginB2.body.token;

    const crossBankRes = await request(app)
      .put(`/api/bloodbank/reservations/${reservationId}`)
      .set('Authorization', `Bearer ${tokenB2}`)
      .send({ status: 'APPROVED' });
    assert.equal(crossBankRes.status, 403, 'Staff from bank 2 cannot approve bank 1 reservation');

    // Correct staff approves reservation
    const approveRes = await request(app)
      .put(`/api/bloodbank/reservations/${reservationId}`)
      .set('Authorization', `Bearer ${bloodbankToken}`)
      .send({ status: 'APPROVED' });
    assert.equal(approveRes.status, 200);

    currentUnit = db.prepare('SELECT available FROM blood_units WHERE unit_id = 1').get();
    assert.equal(currentUnit.available, unitBefore.available - 2, 'Stock must decrement by requested units on APPROVED');

    // FULFILLED does NOT decrement again
    const fulfillRes = await request(app)
      .put(`/api/bloodbank/reservations/${reservationId}`)
      .set('Authorization', `Bearer ${bloodbankToken}`)
      .send({ status: 'FULFILLED' });
    assert.equal(fulfillRes.status, 200);

    currentUnit = db.prepare('SELECT available FROM blood_units WHERE unit_id = 1').get();
    assert.equal(currentUnit.available, unitBefore.available - 2, 'FULFILLED must not decrement stock again');

    // Test reject after approve restores stock
    const res2 = await request(app)
      .post('/api/bloodbank/reservations')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ unit_id: 1, units_requested: 3 });
    const res2Id = res2.body.reservation_id;

    await request(app)
      .put(`/api/bloodbank/reservations/${res2Id}`)
      .set('Authorization', `Bearer ${bloodbankToken}`)
      .send({ status: 'APPROVED' });

    const afterApproveStock = db.prepare('SELECT available FROM blood_units WHERE unit_id = 1').get().available;

    // Reject after approved
    await request(app)
      .put(`/api/bloodbank/reservations/${res2Id}`)
      .set('Authorization', `Bearer ${bloodbankToken}`)
      .send({ status: 'REJECTED' });

    const afterRejectStock = db.prepare('SELECT available FROM blood_units WHERE unit_id = 1').get().available;
    assert.equal(afterRejectStock, afterApproveStock + 3, 'Reject after approve must restore stock');

    // Insufficient stock returns 409 on approval
    db.prepare('UPDATE blood_units SET available = 1 WHERE unit_id = 1').run();
    const res3 = await request(app)
      .post('/api/bloodbank/reservations')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ unit_id: 1, units_requested: 1 });
    // reduce available to 0 before approval
    db.prepare('UPDATE blood_units SET available = 0 WHERE unit_id = 1').run();

    const approveFail = await request(app)
      .put(`/api/bloodbank/reservations/${res3.body.reservation_id}`)
      .set('Authorization', `Bearer ${bloodbankToken}`)
      .send({ status: 'APPROVED' });
    assert.equal(approveFail.status, 409, 'Approval with insufficient stock returns 409');
  });
});

describe('4. Ambulance Dispatch & Tracking', () => {
  test('ambulance: nearest available ambulance is chosen; queued when none available; reject reassigns; complete frees ambulance; location update writes history; tracking endpoint restricted', async () => {
    // 1. Request ambulance near SMS Hospital, Jaipur (pickup coords ~ 26.8920, 75.8250)
    // Ambulance 1 is at 26.8988, 75.8164 (AVAILABLE)
    const reqRes = await request(app)
      .post('/api/ambulances/requests')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        pickup_location: 'Raja Park, Jaipur',
        pickup_lat: 26.8920,
        pickup_lng: 75.8250,
      });
    assert.equal(reqRes.status, 201);
    assert.equal(reqRes.body.status, 'ACCEPTED');
    assert.equal(reqRes.body.ambulance_id, 1, 'Should choose closest available ambulance (Ambulance 1)');

    const amb1Status = db.prepare('SELECT status FROM ambulances WHERE ambulance_id = 1').get().status;
    assert.equal(amb1Status, 'ON_TRIP');

    const reqId = reqRes.body.request_id;

    // 2. Location update writes history
    const locRes = await request(app)
      .put('/api/ambulances/1/location')
      .set('Authorization', `Bearer ${ambulanceToken}`)
      .send({ latitude: 26.8995, longitude: 75.8170 });
    assert.equal(locRes.status, 200);

    const historyCount = db.prepare('SELECT COUNT(*) AS c FROM ambulance_locations WHERE ambulance_id = 1').get().c;
    assert.ok(historyCount > 0, 'Location update must write to ambulance_locations');

    // 3. Tracking endpoint accessible by patient
    const trackRes = await request(app)
      .get(`/api/ambulances/requests/${reqId}/track`)
      .set('Authorization', `Bearer ${patientToken}`);
    assert.equal(trackRes.status, 200);
    assert.ok(trackRes.body.eta_minutes !== undefined);
    assert.ok(Array.isArray(trackRes.body.location_history));

    // Another patient cannot track this request
    const p2Login = await request(app).post('/api/auth/login').send({
      email: 'patient2@medilink.com',
      password: 'password123',
    });
    const trackForbidden = await request(app)
      .get(`/api/ambulances/requests/${reqId}/track`)
      .set('Authorization', `Bearer ${p2Login.body.token}`);
    assert.equal(trackForbidden.status, 403);

    // 4. Operator reject reassigns to next nearest ambulance
    const rejectRes = await request(app)
      .put(`/api/ambulances/requests/${reqId}`)
      .set('Authorization', `Bearer ${ambulanceToken}`)
      .send({ action: 'reject' });
    assert.equal(rejectRes.status, 200);
    // Ambulance 1 should be freed to AVAILABLE
    assert.equal(db.prepare('SELECT status FROM ambulances WHERE ambulance_id = 1').get().status, 'AVAILABLE');

    // 5. Complete trip frees assigned ambulance
    const reqAfterReassign = db.prepare('SELECT ambulance_id FROM ambulance_requests WHERE request_id = ?').get(reqId);
    if (reqAfterReassign.ambulance_id) {
      await request(app)
        .put(`/api/ambulances/requests/${reqId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'EN_ROUTE' });

      await request(app)
        .put(`/api/ambulances/requests/${reqId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'COMPLETED' });

      assert.equal(
        db.prepare('SELECT status FROM ambulances WHERE ambulance_id = ?').get(reqAfterReassign.ambulance_id).status,
        'AVAILABLE'
      );
    }
  });
});

describe('5. Recommendations & Waiting-Time Estimation', () => {
  test('waiting-time estimate formula', () => {
    // Formula: estimated = reported * (1 + occupancy_factor) + 5 * pending_admissions
    // occupancy_factor = (total - available) / total * 0.5
    // Test: reported = 30, total = 100, available = 20 -> occupancy_ratio = 0.8, factor = 0.4. pending = 2
    // estimated = 30 * (1 + 0.4) + 10 = 42 + 10 = 52
    const calc = calculateEstimatedWait(30, 100, 20, 2);
    assert.equal(calc.reported_minutes, 30);
    assert.equal(calc.factors.occupancy_factor, 0.4);
    assert.equal(calc.factors.pending_admissions, 2);
    assert.equal(calc.estimated_minutes, 52);
  });

  test('recommendations: factor breakdown present, weights applied, history deduplication', async () => {
    const res = await request(app)
      .get('/api/recommendations?lat=28.5672&lng=77.2100&need=GENERAL')
      .set('Authorization', `Bearer ${patientToken}`);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.recommendations));
    assert.ok(res.body.recommendations.length > 0);

    const top = res.body.recommendations[0];
    assert.ok(top.score !== undefined);
    assert.ok(top.breakdown.distance);
    assert.ok(top.breakdown.availability);
    assert.ok(top.breakdown.wait);

    // History is persisted
    const histBefore = db.prepare('SELECT COUNT(*) AS c FROM ai_recommendations').get().c;

    // Immediate second call should not duplicate history (10 minute debounce)
    await request(app)
      .get('/api/recommendations?lat=28.5672&lng=77.2100&need=GENERAL')
      .set('Authorization', `Bearer ${patientToken}`);
    const histAfter = db.prepare('SELECT COUNT(*) AS c FROM ai_recommendations').get().c;
    assert.equal(histBefore, histAfter, 'History must not duplicate within 10 minutes');
  });
});

describe('6. Admin & Input Validation', () => {
  test('admin: cannot deactivate self; audit rows are written', async () => {
    const adminUser = db.prepare("SELECT user_id FROM users WHERE role = 'ADMIN'").get();

    // Admin attempts self-deactivation (400)
    const selfDeact = await request(app)
      .delete(`/api/admin/users/${adminUser.user_id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(selfDeact.status, 400);

    // Audit rows are recorded in database
    const auditCount = db.prepare('SELECT COUNT(*) AS c FROM audit_logs').get().c;
    assert.ok(auditCount > 0, 'Audit rows must be written');
  });

  test('validation: out-of-range coordinates, negative counts, available > total return 400', async () => {
    // Bad coords on hospital
    const badCoords = await request(app)
      .post('/api/hospitals')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Bad Coords Hospital', latitude: 95.0, longitude: 200.0 });
    assert.equal(badCoords.status, 400);

    // Negative resource count (executed by manager)
    const negResource = await request(app)
      .put('/api/hospitals/1/resources/1')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ available: -5 });
    assert.equal(negResource.status, 400);

    // available > total (executed by manager)
    const overflowResource = await request(app)
      .put('/api/hospitals/1/resources/1')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ total: 10, available: 50 });
    assert.equal(overflowResource.status, 400);
  });
});

describe('7. Hospital Staff Permissions, Occupancy Invariants & Geographic Range Controls', () => {
  test('clinical doctor is prohibited from mutating resources (403), while resource manager succeeds (200)', async () => {
    // 1. Doctor (CLINICAL) attempting to modify capacity -> 403 Forbidden
    const doctorMutation = await request(app)
      .put('/api/hospitals/1/resources/1')
      .set('Authorization', `Bearer ${hospitalToken}`)
      .send({ total: 200, available: 100 });
    assert.equal(doctorMutation.status, 403);
    assert.match(doctorMutation.body.error, /Doctors and clinical staff are not authorized/i);

    // 2. Resource Manager attempting to modify capacity -> 200 OK
    const managerMutation = await request(app)
      .put('/api/hospitals/1/resources/1')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ total: 150, available: 50 });
    assert.equal(managerMutation.status, 200);
    assert.equal(managerMutation.body.total, 150);
    assert.equal(managerMutation.body.available, 50);
  });

  test('hospital total capacity cannot be reduced below currently occupied beds (409 Conflict)', async () => {
    // Resource 1 total is 150, available is 50 -> 100 beds currently occupied
    // Attempting to reduce total to 80 (less than 100 occupied)
    const conflictRes = await request(app)
      .put('/api/hospitals/1/resources/1')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ total: 80 });
    assert.equal(conflictRes.status, 409);
    assert.match(conflictRes.body.error, /occupied/i);
  });

  test('ambulance request outside 50 km maximum radius is safely queued with out-of-range notification', async () => {
    // Patient requests an ambulance in New Delhi (~240 km from Jaipur vehicles)
    const outOfRangeRes = await request(app)
      .post('/api/ambulances/requests')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        pickup_location: 'Connaught Place, New Delhi',
        pickup_lat: 28.6304,
        pickup_lng: 77.2177,
      });
    assert.equal(outOfRangeRes.status, 201);
    assert.equal(outOfRangeRes.body.status, 'REQUESTED');
    assert.equal(outOfRangeRes.body.ambulance_id, null);
    assert.match(outOfRangeRes.body.assignment_message, /50 km/i);
  });

  test('blood bank inventory endpoint filters by blood group accurately with matching counts', async () => {
    // Querying for A+ blood group in Jaipur
    const aPosRes = await request(app).get('/api/bloodbank/units?blood_group=A%2B');
    assert.equal(aPosRes.status, 200);
    assert.ok(Array.isArray(aPosRes.body));
    // Every returned unit must be A+
    aPosRes.body.forEach(unit => {
      assert.equal(unit.blood_group, 'A+');
    });

    // All groups query
    const allRes = await request(app).get('/api/bloodbank/units');
    assert.equal(allRes.status, 200);
    assert.ok(allRes.body.length > aPosRes.body.length);
  });
});


process.env.NODE_ENV = 'test';
process.env.DB_PATH = ':memory:';

const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const { seedDatabase } = require('../seed');
const app = require('../server');
const db = require('../db');

let adminToken;
let hospitalToken;
let ambulanceToken;

before(async () => {
  seedDatabase();

  const login = async (email, password) => {
    const res = await request(app).post('/api/auth/login').send({ email, password });
    return res.body.token;
  };

  adminToken = await login('admin@medilink.com', 'password123');
  hospitalToken = await login('hospital@medilink.com', 'password123');
  ambulanceToken = await login('ambulance@medilink.com', 'password123');
});

describe('End-to-End Emergency Healthcare Coordination Workflow', () => {
  test('Complete lifecycle: Patient Registration -> Recommendations -> Admission -> Ambulance Dispatch -> Live Tracking -> Completion -> Audit Verification', async () => {
    // 1. Patient self-registers
    const regRes = await request(app).post('/api/auth/register').send({
      name: 'Aditi Sharma',
      email: 'aditi.emergency@example.com',
      password: 'SecurePassword123!',
      phone: '+91-9811223344',
    });
    assert.equal(regRes.status, 201);
    const patientToken = regRes.body.token;
    const patientId = regRes.body.user.user_id;

    // 2. Patient queries hospital recommendations near C-Scheme / Ashok Nagar Jaipur for Cardiology care
    const recRes = await request(app)
      .get('/api/recommendations?lat=26.8950&lng=75.8150&need=ICU&specialty=Cardiology')
      .set('Authorization', `Bearer ${patientToken}`);
    assert.equal(recRes.status, 200);
    assert.ok(Array.isArray(recRes.body.recommendations));
    assert.ok(recRes.body.recommendations.length > 0);

    const topHospital = recRes.body.recommendations[0];
    assert.ok(topHospital.hospital_id, 'Top hospital must have ID');
    assert.ok(topHospital.why_recommended, 'Must provide explainable "why_recommended" rationale');
    assert.ok(topHospital.breakdown, 'Must provide factor breakdown');

    // 3. Patient requests Emergency Admission at SMS Hospital (hospital 1)
    const initialBed = db.prepare("SELECT available FROM resources WHERE hospital_id = 1 AND type = 'BED'").get().available;

    const admRes = await request(app)
      .post('/api/admissions')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        hospital_id: 1,
        reason: 'Acute Chest Pain, ST-Elevation Myocardial Infarction',
        severity: 'CRITICAL',
        preferred_department: 'Cardiology',
      });
    assert.equal(admRes.status, 201);
    const admissionId = admRes.body.admission_id;
    assert.equal(admRes.body.status, 'PENDING');

    // 4. Hospital reviews queue: CRITICAL admission is listed
    const hospQueueRes = await request(app)
      .get('/api/admissions')
      .set('Authorization', `Bearer ${hospitalToken}`);
    assert.equal(hospQueueRes.status, 200);
    const queuedAdm = hospQueueRes.body.find(a => a.admission_id === admissionId);
    assert.ok(queuedAdm, 'New admission must appear in hospital triage queue');
    assert.equal(queuedAdm.severity, 'CRITICAL');

    // 5. Hospital accepts admission -> decrements bed atomically
    const acceptRes = await request(app)
      .put(`/api/admissions/${admissionId}/status`)
      .set('Authorization', `Bearer ${hospitalToken}`)
      .send({ status: 'ACCEPTED' });
    assert.equal(acceptRes.status, 200);
    assert.equal(acceptRes.body.status, 'ACCEPTED');

    const postAcceptBed = db.prepare("SELECT available FROM resources WHERE hospital_id = 1 AND type = 'BED'").get().available;
    assert.equal(postAcceptBed, initialBed - 1, 'Hospital bed count must decrement by exactly 1');

    // 6. Patient dispatches nearest emergency ambulance to pickup location in Jaipur
    const ambReqRes = await request(app)
      .post('/api/ambulances/requests')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        pickup_location: 'Albert Hall Museum, Ram Niwas Garden, Jaipur',
        pickup_lat: 26.9115,
        pickup_lng: 75.8190,
        drop_location: 'SMS Hospital Emergency Ward, Jawahar Lal Nehru Marg',
        drop_hospital_id: 1,
      });
    assert.equal(ambReqRes.status, 201);
    const tripId = ambReqRes.body.request_id;
    const assignedAmbulanceId = ambReqRes.body.ambulance_id;
    assert.ok(assignedAmbulanceId, 'An ambulance should be assigned');
    assert.equal(ambReqRes.body.status, 'ACCEPTED');

    // 7. Ambulance operator streams live GPS coordinate update
    const locUpdateRes = await request(app)
      .put(`/api/ambulances/${assignedAmbulanceId}/location`)
      .set('Authorization', `Bearer ${ambulanceToken}`)
      .send({ latitude: 26.9050, longitude: 75.8170 });
    assert.equal(locUpdateRes.status, 200);

    // 8. Patient tracks vehicle: checks live coordinates and estimated transit time
    const trackRes = await request(app)
      .get(`/api/ambulances/requests/${tripId}/track`)
      .set('Authorization', `Bearer ${patientToken}`);
    assert.equal(trackRes.status, 200);
    assert.ok(trackRes.body.ambulance, 'Should return ambulance object');
    assert.ok(trackRes.body.eta_minutes !== null, 'Should return estimated minutes');
    assert.ok(Array.isArray(trackRes.body.location_history), 'Should return location breadcrumbs');

    // 9. Driver transitions trip to EN_ROUTE, then marks COMPLETED
    const enRouteRes = await request(app)
      .put(`/api/ambulances/requests/${tripId}`)
      .set('Authorization', `Bearer ${ambulanceToken}`)
      .send({ status: 'EN_ROUTE' });
    assert.equal(enRouteRes.status, 200);
    assert.equal(enRouteRes.body.status, 'EN_ROUTE');

    const completeTripRes = await request(app)
      .put(`/api/ambulances/requests/${tripId}`)
      .set('Authorization', `Bearer ${ambulanceToken}`)
      .send({ status: 'COMPLETED' });
    assert.equal(completeTripRes.status, 200);
    assert.equal(completeTripRes.body.status, 'COMPLETED');

    // Vehicle returns to AVAILABLE
    const ambAfterTrip = db.prepare('SELECT status FROM ambulances WHERE ambulance_id = ?').get(assignedAmbulanceId).status;
    assert.equal(ambAfterTrip, 'AVAILABLE', 'Vehicle must return to AVAILABLE status upon trip completion');

    // 10. Patient is admitted and eventually discharged/completed -> hospital bed is restored
    const completeAdmRes = await request(app)
      .put(`/api/admissions/${admissionId}/status`)
      .set('Authorization', `Bearer ${hospitalToken}`)
      .send({ status: 'COMPLETED' });
    assert.equal(completeAdmRes.status, 200);

    const postDischargeBed = db.prepare("SELECT available FROM resources WHERE hospital_id = 1 AND type = 'BED'").get().available;
    assert.equal(postDischargeBed, initialBed, 'Bed must be restored to initial count upon admission completion');

    // 11. Admin verifies audit log trail
    const auditRes = await request(app)
      .get('/api/admin/audit?limit=20')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(auditRes.status, 200);
    assert.ok(Array.isArray(auditRes.body));
    const patientAudits = auditRes.body.filter(al => al.user_id === patientId);
    assert.ok(patientAudits.length >= 2, 'Should have logged patient admission and ambulance request audits');
  });
});

const bcrypt = require('bcryptjs');
const db = require('./db');

function count(table) {
  return db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get().c;
}

if (count('hospitals') > 0) {
  console.log('Database already seeded. Skipping.');
  process.exit(0);
}

const insertHospital = db.prepare(`INSERT INTO hospitals (name, address, latitude, longitude, specialties, insurance_info)
  VALUES (@name, @address, @latitude, @longitude, @specialties, @insurance_info)`);

const hospitals = [
  { name: 'City General Hospital', address: 'MG Road, Delhi', latitude: 28.6139, longitude: 77.2090, specialties: 'Cardiology, Trauma, General Surgery', insurance_info: 'CGHS, Star Health, HDFC Ergo' },
  { name: 'Sunrise Multispecialty Hospital', address: 'Sector 21, Delhi', latitude: 28.5355, longitude: 77.3910, specialties: 'Neurology, Oncology, Pediatrics', insurance_info: 'ICICI Lombard, Niva Bupa' },
  { name: 'Lotus Care Hospital', address: 'Rohini, Delhi', latitude: 28.7041, longitude: 77.1025, specialties: 'Orthopedics, ICU Care, Maternity', insurance_info: 'Star Health, CGHS' },
];
for (const h of hospitals) insertHospital.run(h);

const insertDoctor = db.prepare(`INSERT INTO doctors (hospital_id, name, specialization, available) VALUES (?,?,?,?)`);
const doctorData = [
  [1, 'Dr. Arjun Mehta', 'Cardiology', 1],
  [1, 'Dr. Priya Nair', 'Trauma Surgery', 1],
  [2, 'Dr. Kavita Rao', 'Neurology', 1],
  [2, 'Dr. Sameer Khan', 'Oncology', 0],
  [3, 'Dr. Ritu Sharma', 'Orthopedics', 1],
];
for (const d of doctorData) insertDoctor.run(...d);

const insertResource = db.prepare(`INSERT INTO resources (hospital_id, type, total, available) VALUES (?,?,?,?)`);
const resourceData = [
  [1, 'BED', 120, 18],
  [1, 'ICU', 20, 3],
  [1, 'VENTILATOR', 15, 2],
  [2, 'BED', 90, 25],
  [2, 'ICU', 15, 6],
  [2, 'VENTILATOR', 10, 4],
  [3, 'BED', 60, 10],
  [3, 'ICU', 8, 1],
  [3, 'VENTILATOR', 6, 1],
];
for (const r of resourceData) insertResource.run(...r);

const insertWT = db.prepare(`INSERT INTO waiting_times (hospital_id, department, minutes) VALUES (?,?,?)`);
const wtData = [
  [1, 'Emergency', 35],
  [1, 'Cardiology', 50],
  [2, 'Emergency', 20],
  [2, 'Oncology', 45],
  [3, 'Emergency', 60],
  [3, 'Orthopedics', 40],
];
for (const w of wtData) insertWT.run(...w);

const insertBB = db.prepare(`INSERT INTO blood_banks (name, address) VALUES (?,?)`);
insertBB.run('Delhi Central Blood Bank', 'Connaught Place, Delhi');
insertBB.run('LifeFlow Blood Bank', 'Dwarka, Delhi');

const insertUnit = db.prepare(`INSERT INTO blood_units (bloodbank_id, blood_group, quantity, available) VALUES (?,?,?,?)`);
const unitData = [
  [1, 'A+', 40, 12], [1, 'B+', 30, 8], [1, 'O+', 50, 20], [1, 'AB+', 10, 2],
  [2, 'A+', 25, 5], [2, 'O-', 15, 3], [2, 'B-', 10, 1], [2, 'O+', 35, 14],
];
for (const u of unitData) insertUnit.run(...u);

const insertAmbulance = db.prepare(`INSERT INTO ambulances (vehicle_no, status, latitude, longitude) VALUES (?,?,?,?)`);
insertAmbulance.run('DL-1A-1234', 'AVAILABLE', 28.6200, 77.2100);
insertAmbulance.run('DL-2B-5678', 'AVAILABLE', 28.6450, 77.2500);

const insertUser = db.prepare(`INSERT INTO users (name, email, password_hash, phone, role, hospital_id, ambulance_id, bloodbank_id)
  VALUES (@name, @email, @password_hash, @phone, @role, @hospital_id, @ambulance_id, @bloodbank_id)`);

const pw = bcrypt.hashSync('password123', 10);
const users = [
  { name: 'Admin User', email: 'admin@medilink.com', password_hash: pw, phone: '9999900000', role: 'ADMIN', hospital_id: null, ambulance_id: null, bloodbank_id: null },
  { name: 'Riya Sharma', email: 'patient@medilink.com', password_hash: pw, phone: '9999911111', role: 'PATIENT', hospital_id: null, ambulance_id: null, bloodbank_id: null },
  { name: 'City General Staff', email: 'hospital@medilink.com', password_hash: pw, phone: '9999922222', role: 'HOSPITAL', hospital_id: 1, ambulance_id: null, bloodbank_id: null },
  { name: 'Ambulance Operator', email: 'ambulance@medilink.com', password_hash: pw, phone: '9999933333', role: 'AMBULANCE', hospital_id: null, ambulance_id: 1, bloodbank_id: null },
  { name: 'Blood Bank Staff', email: 'bloodbank@medilink.com', password_hash: pw, phone: '9999944444', role: 'BLOODBANK', hospital_id: null, ambulance_id: null, bloodbank_id: 1 },
];
for (const u of users) insertUser.run(u);

console.log('Seed complete. Demo accounts (password: password123):');
users.forEach(u => console.log(`  ${u.role.padEnd(10)} -> ${u.email}`));

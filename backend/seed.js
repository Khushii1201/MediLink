require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./db');

function seedDatabase() {
  const isProd = process.env.NODE_ENV === 'production';
  const seedDemo = process.env.SEED_DEMO === 'true' || !isProd;

  const hospitalCount = db.prepare('SELECT COUNT(*) AS c FROM hospitals').get().c;
  const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;

  // In production, if SEED_DEMO is false, ensure a single admin exists
  if (isProd && !seedDemo) {
    if (userCount === 0) {
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@medilink.com';
      const adminPass = process.env.ADMIN_PASSWORD || 'AdminPass123!';
      const hash = bcrypt.hashSync(adminPass, 10);
      db.prepare(`
        INSERT INTO users (name, email, password_hash, phone, role, active)
        VALUES ('System Administrator', ?, ?, '9999900000', 'ADMIN', 1)
      `).run(adminEmail.toLowerCase(), hash);
      console.log(`Production admin created: ${adminEmail}`);
    } else {
      console.log('Production users already exist. Skipping.');
    }
    return;
  }

  // Idempotent check for demo seed: skip if hospitals already exist
  if (hospitalCount > 0) {
    console.log('Database already seeded. Skipping.');
    return;
  }

  console.log('Seeding rich demo data for MediLink (Delhi NCR)...');

  // 1. Insert 8 Hospitals
  const insertHospital = db.prepare(`
    INSERT INTO hospitals (name, address, latitude, longitude, specialties, insurance_info, phone, email, description)
    VALUES (@name, @address, @latitude, @longitude, @specialties, @insurance_info, @phone, @email, @description)
  `);

  const hospitalsData = [
    {
      name: 'All India Institute of Medical Sciences (AIIMS)',
      address: 'Ansari Nagar, New Delhi',
      latitude: 28.5672,
      longitude: 77.2100,
      specialties: 'Cardiology, Trauma Surgery, Neurology, Oncology, Pediatrics',
      insurance_info: 'CGHS, ECHS, Ayushman Bharat, Star Health',
      phone: '+91-11-26588500',
      email: 'emergency@aiims.edu.in',
      description: 'Apex premier public healthcare and tertiary referral research institute offering 24/7 comprehensive emergency care.',
    },
    {
      name: 'Safdarjung Hospital & Trauma Centre',
      address: 'Ring Road, Opposite AIIMS, New Delhi',
      latitude: 28.5701,
      longitude: 77.2078,
      specialties: 'Trauma Surgery, Orthopedics, Burns & Plastic Surgery, Pulmonary Care',
      insurance_info: 'CGHS, Ayushman Bharat, National Insurance',
      phone: '+91-11-26165060',
      email: 'info@safdarjunghospital.in',
      description: 'Major central government multi-specialty healthcare centre with state-of-the-art dedicated trauma ward.',
    },
    {
      name: 'Max Super Speciality Hospital, Saket',
      address: '1, 2 Press Enclave Marg, Saket, New Delhi',
      latitude: 28.5284,
      longitude: 77.2131,
      specialties: 'Cardiology, Cardiac Surgery, Oncology, Nephrology, Neurosciences',
      insurance_info: 'HDFC Ergo, ICICI Lombard, Star Health, Max Bupa, Care Health',
      phone: '+91-11-26515050',
      email: 'emergency.saket@maxhealthcare.com',
      description: 'JCI-accredited tertiary care facility with advanced cardiac life support and precision diagnostics.',
    },
    {
      name: 'Fortis Memorial Research Institute',
      address: 'Sector 44, Opposite City Centre Metro, Gurugram',
      latitude: 28.4595,
      longitude: 77.0725,
      specialties: 'Robotic Surgery, Bone Marrow Transplant, Neurology, Critical Care',
      insurance_info: 'Star Health, Niva Bupa, Bajaj Allianz, Care Health',
      phone: '+91-124-4962200',
      email: 'care.gurugram@fortishealthcare.com',
      description: 'Next-generation quaternary care hospital known for cutting-edge medical technology and international patient care.',
    },
    {
      name: 'Indraprastha Apollo Hospitals',
      address: 'Delhi Mathura Road, Sarita Vihar, New Delhi',
      latitude: 28.5414,
      longitude: 77.2842,
      specialties: 'Organ Transplant, Cardiology, Gastroenterology, Critical Care',
      insurance_info: 'CGHS, Star Health, ICICI Lombard, New India Assurance',
      phone: '+91-11-26925858',
      email: 'assistance@apollohospitals.com',
      description: 'Renowned hospital network leader featuring dedicated 24-hour pediatric and adult emergency departments.',
    },
    {
      name: 'Medanta - The Medicity',
      address: 'CH Bakhtawar Singh Road, Sector 38, Gurugram',
      latitude: 28.4394,
      longitude: 77.0427,
      specialties: 'Cardiology, Heart Institute, Neurosciences, Oncology, Urology',
      insurance_info: 'ICICI Lombard, Star Health, HDFC Ergo, Paramount TPA',
      phone: '+91-124-4141414',
      email: 'emergency@medanta.org',
      description: 'One of India’s largest multi-super specialty institutes with dedicated air ambulance landing pad and stroke units.',
    },
    {
      name: 'Sir Ganga Ram Hospital',
      address: 'Sir Ganga Ram Hospital Marg, Old Rajinder Nagar, New Delhi',
      latitude: 28.6386,
      longitude: 77.1897,
      specialties: 'General Surgery, Nephrology, Gastroenterology, Orthopedics',
      insurance_info: 'CGHS, Star Health, United India Insurance, IFFCO Tokio',
      phone: '+91-11-42254000',
      email: 'gangaram@sgrh.com',
      description: 'Premier trust hospital known for high clinical standards, surgical excellence, and accessible patient care.',
    },
    {
      name: 'Jaypee Hospital',
      address: 'Jaypee Healthcare, Sector 128, Noida',
      latitude: 28.5135,
      longitude: 77.3697,
      specialties: 'Emergency & Trauma, Critical Care, Cardiology, Pediatrics',
      insurance_info: 'Star Health, Care Health, HDFC Ergo, Oriental Insurance',
      phone: '+91-120-4122222',
      email: 'emergency@jaypeehealthcare.com',
      description: 'Flagship healthcare facility serving Noida and Western UP with full advanced life support services.',
    },
  ];

  for (const h of hospitalsData) {
    insertHospital.run(h);
  }

  // 2. Insert Doctors (3 to 4 doctors per hospital with qualifications and availability)
  const insertDoctor = db.prepare(`
    INSERT INTO doctors (hospital_id, name, specialization, qualification, available)
    VALUES (?, ?, ?, ?, ?)
  `);

  const doctorsData = [
    // AIIMS (id: 1)
    [1, 'Dr. Arjun Mehta', 'Cardiology', 'MBBS, MD, DM (Cardiology)', 1],
    [1, 'Dr. Priya Nair', 'Trauma Surgery', 'MBBS, MS (General Surgery), MCh (Trauma)', 1],
    [1, 'Dr. Rajesh Khurana', 'Neurology', 'MBBS, MD, DM (Neurology)', 0],
    [1, 'Dr. Sunita Bansal', 'Critical Care', 'MBBS, MD (Anesthesia), FNB (Critical Care)', 1],
    // Safdarjung (id: 2)
    [2, 'Dr. Manoj Tiwari', 'Trauma Surgery', 'MBBS, MS (Surgery)', 1],
    [2, 'Dr. Ananya Roy', 'Orthopedics', 'MBBS, MS (Orthopedics)', 1],
    [2, 'Dr. Arvind Saxena', 'Pulmonary Care', 'MBBS, MD (Pulmonary Medicine)', 0],
    // Max Saket (id: 3)
    [3, 'Dr. Kavita Rao', 'Neurology', 'MBBS, MD, DM (Neurology)', 1],
    [3, 'Dr. Sameer Khan', 'Cardiology', 'MBBS, MD, DM (Cardiology)', 1],
    [3, 'Dr. Preeti Deshmukh', 'Oncology', 'MBBS, MD (Radiotherapy), DNB', 1],
    [3, 'Dr. Tarun Verma', 'Critical Care', 'MBBS, MD, EDIC', 0],
    // Fortis Gurugram (id: 4)
    [4, 'Dr. Ritu Sharma', 'Orthopedics', 'MBBS, MS, MCh (Ortho)', 1],
    [4, 'Dr. Alok Sen', 'Robotic Surgery', 'MBBS, MS, FACS', 1],
    [4, 'Dr. Deepa Pillai', 'Critical Care', 'MBBS, MD (Anesthesiology)', 1],
    // Apollo Sarita Vihar (id: 5)
    [5, 'Dr. Rohan Bhatt', 'Organ Transplant', 'MBBS, MS, FRCS', 1],
    [5, 'Dr. Sneha Paul', 'Cardiology', 'MBBS, MD, FACC', 1],
    [5, 'Dr. Vivek Mishra', 'Critical Care', 'MBBS, MD, FNB', 0],
    // Medanta Gurugram (id: 6)
    [6, 'Dr. Naresh Goel', 'Cardiac Surgery', 'MBBS, MS, MCh (CTVS)', 1],
    [6, 'Dr. Swati Sen', 'Neurology', 'MBBS, MD, DM', 1],
    [6, 'Dr. Karan Malhotra', 'Urology', 'MBBS, MS, MCh (Urology)', 1],
    // Ganga Ram (id: 7)
    [7, 'Dr. Hemant Joshi', 'Nephrology', 'MBBS, MD, DM (Nephrology)', 1],
    [7, 'Dr. Geeta Aggarwal', 'Gastroenterology', 'MBBS, MD, DM', 1],
    [7, 'Dr. Prakash Narang', 'General Surgery', 'MBBS, MS', 0],
    // Jaypee Noida (id: 8)
    [8, 'Dr. Neeraj Vats', 'Emergency Medicine', 'MBBS, MD (Emergency Medicine)', 1],
    [8, 'Dr. Shweta Choudhary', 'Pediatrics', 'MBBS, MD (Pediatrics)', 1],
    [8, 'Dr. Devendra Yadav', 'Critical Care', 'MBBS, MD, IDCCM', 1],
  ];

  for (const doc of doctorsData) {
    insertDoctor.run(...doc);
  }

  // 3. Resources (BED, ICU, VENTILATOR) for each hospital
  const insertResource = db.prepare(`
    INSERT INTO resources (hospital_id, type, total, available)
    VALUES (?, ?, ?, ?)
  `);

  const resourcesData = [
    // AIIMS (id: 1)
    [1, 'BED', 150, 24],
    [1, 'ICU', 30, 4],
    [1, 'VENTILATOR', 20, 3],
    // Safdarjung (id: 2)
    [2, 'BED', 120, 18],
    [2, 'ICU', 25, 2],
    [2, 'VENTILATOR', 15, 1],
    // Max Saket (id: 3)
    [3, 'BED', 100, 32],
    [3, 'ICU', 20, 6],
    [3, 'VENTILATOR', 12, 5],
    // Fortis Gurugram (id: 4)
    [4, 'BED', 85, 21],
    [4, 'ICU', 18, 5],
    [4, 'VENTILATOR', 10, 3],
    // Apollo Sarita Vihar (id: 5)
    [5, 'BED', 110, 28],
    [5, 'ICU', 22, 7],
    [5, 'VENTILATOR', 14, 4],
    // Medanta Gurugram (id: 6)
    [6, 'BED', 140, 45],
    [6, 'ICU', 35, 11],
    [6, 'VENTILATOR', 25, 8],
    // Ganga Ram (id: 7)
    [7, 'BED', 95, 16],
    [7, 'ICU', 16, 3],
    [7, 'VENTILATOR', 10, 2],
    // Jaypee Noida (id: 8)
    [8, 'BED', 75, 26],
    [8, 'ICU', 15, 5],
    [8, 'VENTILATOR', 8, 4],
  ];

  for (const res of resourcesData) {
    insertResource.run(...res);
  }

  // 4. Waiting Times (2 to 3 departments each)
  const insertWT = db.prepare(`
    INSERT INTO waiting_times (hospital_id, department, minutes)
    VALUES (?, ?, ?)
  `);

  const wtData = [
    [1, 'Emergency', 40],
    [1, 'Trauma', 25],
    [1, 'Cardiology', 55],
    [2, 'Emergency', 35],
    [2, 'Orthopedics', 45],
    [3, 'Emergency', 20],
    [3, 'Cardiology', 35],
    [3, 'Oncology', 30],
    [4, 'Emergency', 15],
    [4, 'Neurology', 25],
    [5, 'Emergency', 25],
    [5, 'Critical Care', 30],
    [6, 'Emergency', 20],
    [6, 'Cardiology', 30],
    [7, 'Emergency', 30],
    [7, 'Nephrology', 40],
    [8, 'Emergency', 15],
    [8, 'Pediatrics', 20],
  ];

  for (const wt of wtData) {
    insertWT.run(...wt);
  }

  // 5. 3 Blood Banks with full 8-group inventory (some deliberately low < 5)
  const insertBB = db.prepare(`
    INSERT INTO blood_banks (name, address, latitude, longitude, phone)
    VALUES (?, ?, ?, ?, ?)
  `);

  insertBB.run('Delhi Red Cross Blood Bank', '1 Red Cross Road, Connaught Place, New Delhi', 28.6212, 77.2115, '+91-11-23716441');
  insertBB.run('Rotary Blood Bank', '56 Tughlakabad Institutional Area, New Delhi', 28.5126, 77.2743, '+91-11-29955531');
  insertBB.run('Lions Blood Bank', 'Block CP-2, Shalimar Bagh, New Delhi', 28.7153, 77.1623, '+91-11-42258494');

  const insertUnit = db.prepare(`
    INSERT INTO blood_units (bloodbank_id, blood_group, quantity, available)
    VALUES (?, ?, ?, ?)
  `);

  const groups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  const bankInventory = [
    // Bank 1: Red Cross (Connaught Place)
    { 1: { 'A+': [35, 12], 'A-': [15, 3], 'B+': [40, 18], 'B-': [12, 2], 'AB+': [20, 7], 'AB-': [8, 1], 'O+': [50, 22], 'O-': [15, 4] } },
    // Bank 2: Rotary (Tughlakabad)
    { 2: { 'A+': [25, 8], 'A-': [10, 2], 'B+': [30, 14], 'B-': [8, 1], 'AB+': [15, 4], 'AB-': [6, 1], 'O+': [35, 15], 'O-': [12, 3] } },
    // Bank 3: Lions (Shalimar Bagh)
    { 3: { 'A+': [20, 6], 'A-': [8, 2], 'B+': [25, 9], 'B-': [6, 2], 'AB+': [10, 3], 'AB-': [5, 1], 'O+': [30, 11], 'O-': [10, 2] } },
  ];

  for (const bObj of bankInventory) {
    const bankId = Object.keys(bObj)[0];
    const inv = bObj[bankId];
    for (const grp of groups) {
      const [qty, avail] = inv[grp] || [10, 5];
      insertUnit.run(Number(bankId), grp, qty, avail);
    }
  }

  // 6. 5 Ambulances spread across Delhi NCR with driver details
  const insertAmb = db.prepare(`
    INSERT INTO ambulances (vehicle_no, driver_name, driver_phone, status, latitude, longitude)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  insertAmb.run('DL-01-AX-1001', 'Rajesh Kumar', '+91-9811100001', 'AVAILABLE', 28.5670, 77.2110);
  insertAmb.run('DL-02-BY-2002', 'Vikram Singh', '+91-9811100002', 'ON_TRIP', 28.5300, 77.2150);
  insertAmb.run('HR-26-CZ-3003', 'Amit Sharma', '+91-9811100003', 'AVAILABLE', 28.4600, 77.0700);
  insertAmb.run('UP-16-DK-4004', 'Sunita Rao', '+91-9811100004', 'AVAILABLE', 28.5150, 77.3700);
  insertAmb.run('DL-03-EL-5005', 'Manoj Verma', '+91-9811100005', 'OFFLINE', 28.6400, 77.1900);

  // Initial location history for ambulance 1 and 2
  const insertLoc = db.prepare('INSERT INTO ambulance_locations (ambulance_id, latitude, longitude) VALUES (?, ?, ?)');
  insertLoc.run(1, 28.5650, 77.2090);
  insertLoc.run(1, 28.5670, 77.2110);
  insertLoc.run(2, 28.5350, 77.2200);
  insertLoc.run(2, 28.5300, 77.2150);

  // 7. Demo Users for all 5 roles (password: password123)
  const insertUser = db.prepare(`
    INSERT INTO users (name, email, password_hash, phone, role, hospital_id, ambulance_id, bloodbank_id, active)
    VALUES (@name, @email, @password_hash, @phone, @role, @hospital_id, @ambulance_id, @bloodbank_id, 1)
  `);

  const pwHash = bcrypt.hashSync('password123', 10);
  const demoUsers = [
    {
      name: 'System Administrator',
      email: 'admin@medilink.com',
      password_hash: pwHash,
      phone: '+91-9999900000',
      role: 'ADMIN',
      hospital_id: null,
      ambulance_id: null,
      bloodbank_id: null,
    },
    {
      name: 'Riya Sharma',
      email: 'patient@medilink.com',
      password_hash: pwHash,
      phone: '+91-9999911111',
      role: 'PATIENT',
      hospital_id: null,
      ambulance_id: null,
      bloodbank_id: null,
    },
    {
      name: 'Dr. Arjun (AIIMS Staff)',
      email: 'hospital@medilink.com',
      password_hash: pwHash,
      phone: '+91-9999922222',
      role: 'HOSPITAL',
      hospital_id: 1, // AIIMS
      ambulance_id: null,
      bloodbank_id: null,
    },
    {
      name: 'Rajesh (Ambulance Lead)',
      email: 'ambulance@medilink.com',
      password_hash: pwHash,
      phone: '+91-9999933333',
      role: 'AMBULANCE',
      hospital_id: null,
      ambulance_id: 1, // DL-01-AX-1001
      bloodbank_id: null,
    },
    {
      name: 'Suresh (Red Cross Staff)',
      email: 'bloodbank@medilink.com',
      password_hash: pwHash,
      phone: '+91-9999944444',
      role: 'BLOODBANK',
      hospital_id: null,
      ambulance_id: null,
      bloodbank_id: 1, // Delhi Red Cross
    },
    // Second patient for rich queue views
    {
      name: 'Karan Patel',
      email: 'patient2@medilink.com',
      password_hash: pwHash,
      phone: '+91-9999955555',
      role: 'PATIENT',
      hospital_id: null,
      ambulance_id: null,
      bloodbank_id: null,
    },
  ];

  for (const u of demoUsers) {
    insertUser.run(u);
  }

  // Link ambulance 1 to operator user (user_id: 4)
  db.prepare('UPDATE ambulances SET operator_user_id = 4 WHERE ambulance_id = 1').run();

  // 8. Sample admissions in various statuses so Hospital and Patient dashboards look alive
  const insertAdmission = db.prepare(`
    INSERT INTO admissions (patient_id, hospital_id, reason, severity, preferred_department, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  insertAdmission.run(2, 1, 'Acute chest pain and severe shortness of breath', 'CRITICAL', 'Emergency', 'PENDING');
  insertAdmission.run(6, 1, 'Compound fracture of left tibia following road accident', 'MEDIUM', 'Trauma', 'ACCEPTED');
  insertAdmission.run(2, 2, 'High fever with suspected dengue infection', 'LOW', 'Emergency', 'COMPLETED');

  // 9. Sample ambulance requests
  const insertAmbReq = db.prepare(`
    INSERT INTO ambulance_requests (patient_id, ambulance_id, pickup_location, pickup_lat, pickup_lng, drop_location, drop_hospital_id, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertAmbReq.run(2, 1, 'Near Hauz Khas Metro Station, New Delhi', 28.5430, 77.2060, 'AIIMS Emergency Wing', 1, 'ACCEPTED');
  insertAmbReq.run(6, 2, 'South Extension Part II, New Delhi', 28.5680, 77.2220, 'Safdarjung Trauma Centre', 2, 'EN_ROUTE');
  insertAmbReq.run(2, 3, 'Connaught Place Outer Circle, New Delhi', 28.6310, 77.2180, 'Sir Ganga Ram Hospital', 7, 'COMPLETED');

  // 10. Sample blood reservations
  const insertRes = db.prepare(`
    INSERT INTO reservations (patient_id, unit_id, units_requested, status)
    VALUES (?, ?, ?, ?)
  `);

  insertRes.run(2, 1, 2, 'PENDING'); // Bank 1, A+
  insertRes.run(6, 7, 1, 'APPROVED'); // Bank 1, O+
  insertRes.run(2, 3, 1, 'FULFILLED'); // Bank 1, B+

  console.log('Seed completed successfully. Demo accounts:');
  demoUsers.forEach(u => console.log(`  ${u.role.padEnd(10)} -> ${u.email} (password: password123)`));
}

if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };

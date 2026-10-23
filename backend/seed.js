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
        INSERT INTO users (name, email, password_hash, phone, role, staff_role, active)
        VALUES ('System Administrator', ?, ?, '9999900000', 'ADMIN', 'ADMIN', 1)
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

  console.log('Seeding rich demo data for MediLink (Jaipur, Rajasthan)...');

  // 1. Insert 8 Hospitals in Jaipur
  const insertHospital = db.prepare(`
    INSERT INTO hospitals (name, address, latitude, longitude, specialties, insurance_info, phone, email, description)
    VALUES (@name, @address, @latitude, @longitude, @specialties, @insurance_info, @phone, @email, @description)
  `);

  const hospitalsData = [
    {
      name: 'Sawai Man Singh Hospital (SMS Hospital)',
      address: 'Jawahar Lal Nehru Marg, Ashok Nagar, Jaipur',
      latitude: 26.8953,
      longitude: 75.8155,
      specialties: 'Emergency & Trauma, Cardiology, Neurology, General Surgery, Nephrology',
      insurance_info: 'RGHS, Chiranjeevi, Ayushman Bharat, Star Health',
      phone: '+91-141-2560291',
      email: 'emergency@smshospitaljaipur.org',
      description: 'Premier apex public healthcare teaching hospital in Rajasthan offering 24/7 dedicated trauma care and multispecialty emergency services.',
    },
    {
      name: 'Fortis Escorts Hospital Jaipur',
      address: 'Jawahar Lal Nehru Marg, Malviya Nagar, Jaipur',
      latitude: 26.8524,
      longitude: 75.8055,
      specialties: 'Cardiology, Cardiac Surgery, Critical Care, Orthopedics, Neurosciences',
      insurance_info: 'Star Health, HDFC Ergo, ICICI Lombard, Niva Bupa, Care Health',
      phone: '+91-141-2547000',
      email: 'emergency.jaipur@fortishealthcare.com',
      description: 'NABH and NABL accredited super-specialty hospital renowned for advanced interventional cardiology and emergency cardiac care.',
    },
    {
      name: 'Eternal Heart Care Centre (EHCC)',
      address: 'Jawahar Circle, Malviya Nagar, Jaipur',
      latitude: 26.8458,
      longitude: 75.8012,
      specialties: 'Cardiology, Critical Care, Neurology, Oncology, Organ Transplant',
      insurance_info: 'CGHS, RGHS, Star Health, ICICI Lombard, Max Bupa',
      phone: '+91-141-5174000',
      email: 'emergency@eternalhospital.com',
      description: 'Quaternary-care heart and multispecialty hospital with high-dependency intensive care units and 24/7 stroke response.',
    },
    {
      name: 'Manipal Hospital Jaipur',
      address: 'Sector 5, Main Sikar Road, Vidhyadhar Nagar, Jaipur',
      latitude: 26.9712,
      longitude: 75.7761,
      specialties: 'Emergency & Trauma, Gastroenterology, Oncology, Pediatrics, Critical Care',
      insurance_info: 'Star Health, Care Health, Bajaj Allianz, HDFC Ergo',
      phone: '+91-141-5164000',
      email: 'info.jaipur@manipalhospitals.com',
      description: 'Modern multispecialty hospital serving North Jaipur with comprehensive emergency medicine and dedicated intensive care.',
    },
    {
      name: 'Narayana Multispeciality Hospital',
      address: 'Kumbha Marg, Sector 28, Pratap Nagar, Sanganer, Jaipur',
      latitude: 26.8045,
      longitude: 75.8234,
      specialties: 'Cardiology, Orthopedics, Nephrology, Pulmonology, General Surgery',
      insurance_info: 'RGHS, Chiranjeevi, Star Health, Reliance General',
      phone: '+91-141-7122222',
      email: 'emergency.jaipur@narayanahealth.org',
      description: 'Flagship tertiary hospital in South Jaipur delivering accessible high-quality clinical care, dialysis, and trauma triage.',
    },
    {
      name: 'Santokba Durlabhji Memorial Hospital (SDMH)',
      address: 'Bhawani Singh Road, Near Rambagh Circle, Bapu Nagar, Jaipur',
      latitude: 26.8911,
      longitude: 75.8062,
      specialties: 'General Surgery, Pediatrics, Emergency Medicine, Critical Care, Urology',
      insurance_info: 'RGHS, CGHS, United India, Oriental Insurance, Star Health',
      phone: '+91-141-2566251',
      email: 'info@sdmh.in',
      description: 'Historic trust hospital known for compassionate patient care, extensive pediatric facilities, and active round-the-clock emergency desk.',
    },
    {
      name: 'Apex Hospital',
      address: 'SP-4 & 6, Malviya Industrial Area, Malviya Nagar, Jaipur',
      latitude: 26.8492,
      longitude: 75.8164,
      specialties: 'Oncology, Neurosurgery, Critical Care, Orthopedics, Plastic Surgery',
      insurance_info: 'Star Health, Niva Bupa, IFFCO Tokio, RGHS',
      phone: '+91-141-2751871',
      email: 'emergency@apexhospitals.com',
      description: 'Comprehensive surgical and trauma care hospital equipped with modular operation theatres and advanced life support.',
    },
    {
      name: 'Mahatma Gandhi Hospital',
      address: 'RIICO Institutional Area, Sitapura, Jaipur',
      latitude: 26.7725,
      longitude: 75.8456,
      specialties: 'Emergency & Trauma, Critical Care, General Medicine, Nephrology, Cardiology',
      insurance_info: 'Chiranjeevi, RGHS, Ayushman Bharat, Star Health',
      phone: '+91-141-2771777',
      email: 'emergency@mgumst.org',
      description: 'Large medical college and multispecialty healthcare hospital providing critical care, burn treatment, and round-the-clock emergency facilities.',
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
    // SMS Hospital (id: 1)
    [1, 'Dr. Arjun Mehta', 'Cardiology', 'MBBS, MD, DM (Cardiology)', 1],
    [1, 'Dr. Priya Nair', 'Trauma Surgery', 'MBBS, MS (General Surgery), MCh (Trauma)', 1],
    [1, 'Dr. Rajesh Khurana', 'Neurology', 'MBBS, MD, DM (Neurology)', 0],
    [1, 'Dr. Sunita Bansal', 'Critical Care', 'MBBS, MD (Anesthesia), FNB (Critical Care)', 1],
    // Fortis Escorts Jaipur (id: 2)
    [2, 'Dr. Manoj Tiwari', 'Cardiac Surgery', 'MBBS, MS, MCh (CTVS)', 1],
    [2, 'Dr. Ananya Roy', 'Orthopedics', 'MBBS, MS (Orthopedics)', 1],
    [2, 'Dr. Arvind Saxena', 'Pulmonary Care', 'MBBS, MD (Pulmonary Medicine)', 0],
    // EHCC (id: 3)
    [3, 'Dr. Kavita Rao', 'Neurology', 'MBBS, MD, DM (Neurology)', 1],
    [3, 'Dr. Sameer Khan', 'Cardiology', 'MBBS, MD, DM (Cardiology)', 1],
    [3, 'Dr. Preeti Deshmukh', 'Oncology', 'MBBS, MD (Radiotherapy), DNB', 1],
    [3, 'Dr. Tarun Verma', 'Critical Care', 'MBBS, MD, EDIC', 0],
    // Manipal Hospital Jaipur (id: 4)
    [4, 'Dr. Ritu Sharma', 'Gastroenterology', 'MBBS, MD, DM (Gastro)', 1],
    [4, 'Dr. Alok Nath', 'Emergency Medicine', 'MBBS, MD (Emergency Medicine)', 1],
    [4, 'Dr. Deepa Joshi', 'Pediatrics', 'MBBS, DCH, DNB (Pediatrics)', 1],
    // Narayana Jaipur (id: 5)
    [5, 'Dr. Vivek Singhal', 'Nephrology', 'MBBS, MD, DM (Nephrology)', 1],
    [5, 'Dr. Sneha Pillai', 'Cardiology', 'MBBS, MD, DNB (Cardiology)', 1],
    [5, 'Dr. Gaurav Bhatt', 'Orthopedics', 'MBBS, MS (Ortho)', 0],
    // SDMH (id: 6)
    [6, 'Dr. Anita Desai', 'General Surgery', 'MBBS, MS (Surgery)', 1],
    [6, 'Dr. Hemant Goel', 'Pediatrics', 'MBBS, MD (Pediatrics)', 1],
    [6, 'Dr. Pooja Kulkarni', 'Critical Care', 'MBBS, DA, DNB (Critical Care)', 1],
    // Apex Hospital (id: 7)
    [7, 'Dr. Sandeep Yadav', 'Neurosurgery', 'MBBS, MS, MCh (Neurosurgery)', 1],
    [7, 'Dr. Meena Agarwal', 'Oncology', 'MBBS, MD (Onco)', 1],
    // Mahatma Gandhi Hospital (id: 8)
    [8, 'Dr. Devendra Rathore', 'Emergency Medicine', 'MBBS, MD (Emergency)', 1],
    [8, 'Dr. Swati Sen', 'Nephrology', 'MBBS, MD, DNB', 1],
  ];

  for (const d of doctorsData) {
    insertDoctor.run(...d);
  }

  // 3. Insert Resources (BED, ICU, VENTILATOR) for each hospital
  const insertResource = db.prepare(`
    INSERT INTO resources (hospital_id, type, total, available)
    VALUES (?, ?, ?, ?)
  `);

  const resourcesData = [
    // SMS Hospital: High capacity public hospital
    [1, 'BED', 120, 24],
    [1, 'ICU', 25, 4],
    [1, 'VENTILATOR', 12, 3],
    // Fortis Escorts Jaipur: Tertiary cardiac
    [2, 'BED', 60, 18],
    [2, 'ICU', 15, 4],
    [2, 'VENTILATOR', 8, 2],
    // EHCC: Heart care
    [3, 'BED', 50, 12],
    [3, 'ICU', 12, 2],
    [3, 'VENTILATOR', 6, 1],
    // Manipal Jaipur
    [4, 'BED', 70, 22],
    [4, 'ICU', 16, 5],
    [4, 'VENTILATOR', 8, 3],
    // Narayana Jaipur
    [5, 'BED', 65, 19],
    [5, 'ICU', 14, 3],
    [5, 'VENTILATOR', 7, 2],
    // SDMH: Trust hospital
    [6, 'BED', 55, 15],
    [6, 'ICU', 10, 2],
    [6, 'VENTILATOR', 5, 1],
    // Apex Hospital: Malviya Nagar
    [7, 'BED', 45, 11],
    [7, 'ICU', 10, 2],
    [7, 'VENTILATOR', 4, 1],
    // Mahatma Gandhi Hospital: Sitapura
    [8, 'BED', 90, 28],
    [8, 'ICU', 25, 6],
    [8, 'VENTILATOR', 12, 4],
  ];

  for (const r of resourcesData) {
    insertResource.run(...r);
  }

  // 4. Insert baseline waiting times (Emergency and department specific)
  const insertWT = db.prepare(`
    INSERT INTO waiting_times (hospital_id, department, minutes)
    VALUES (?, ?, ?)
  `);

  const wtData = [
    [1, 'Emergency', 25],
    [1, 'Cardiology', 40],
    [1, 'Trauma', 15],
    [2, 'Emergency', 20],
    [2, 'Cardiology', 30],
    [3, 'Emergency', 15],
    [3, 'Cardiology', 25],
    [4, 'Emergency', 20],
    [4, 'Gastroenterology', 35],
    [5, 'Emergency', 25],
    [5, 'Nephrology', 30],
    [6, 'Emergency', 20],
    [6, 'Pediatrics', 25],
    [7, 'Emergency', 25],
    [7, 'Oncology', 35],
    [8, 'Emergency', 30],
    [8, 'General Medicine', 40],
  ];

  for (const wt of wtData) {
    insertWT.run(...wt);
  }

  // 5. 3 Blood Banks in Jaipur with realistic, varied stock distributions
  // Varied stock guarantees that different blood groups return distinct listing counts
  const insertBB = db.prepare(`
    INSERT INTO blood_banks (name, address, latitude, longitude, phone)
    VALUES (?, ?, ?, ?, ?)
  `);

  insertBB.run('SMS Hospital Central Blood Bank', 'JLN Marg, Ashok Nagar, Jaipur', 26.8950, 75.8150, '+91-141-2560291');
  insertBB.run('Swasthya Kalyan Blood Centre', '10 Hospital Road, C-Scheme, Jaipur', 26.9142, 75.8021, '+91-141-2372332');
  insertBB.run('Rotary Blood Bank Jaipur', 'Near Nehru Garden, Tonk Road, Gandhinagar, Jaipur', 26.8831, 75.8019, '+91-141-2706030');

  const insertUnit = db.prepare(`
    INSERT INTO blood_units (bloodbank_id, blood_group, quantity, available)
    VALUES (?, ?, ?, ?)
  `);

  // Specific varied stock across the 3 banks
  const bankInventory = [
    // Bank 1: SMS Blood Bank (Ashok Nagar) - Stocks 7 groups (No AB-)
    {
      bankId: 1,
      units: [
        ['A+', 35, 12],
        ['A-', 15, 3],
        ['B+', 40, 18],
        ['B-', 12, 2],
        ['O+', 50, 22],
        ['O-', 15, 4],
        ['AB+', 20, 5],
      ],
    },
    // Bank 2: Swasthya Kalyan (C-Scheme) - Stocks 5 groups (No A-, No O-)
    {
      bankId: 2,
      units: [
        ['A+', 25, 8],
        ['B+', 30, 14],
        ['AB+', 15, 4],
        ['AB-', 6, 2],
        ['O+', 35, 15],
      ],
    },
    // Bank 3: Rotary Blood Bank (Tonk Road) - Stocks 5 groups (No A+, No A-, No AB-)
    {
      bankId: 3,
      units: [
        ['B+', 25, 9],
        ['B-', 8, 2],
        ['AB+', 10, 3],
        ['O+', 30, 11],
        ['O-', 10, 2],
      ],
    },
  ];

  for (const b of bankInventory) {
    for (const [grp, qty, avail] of b.units) {
      insertUnit.run(b.bankId, grp, qty, avail);
    }
  }

  // 6. 5 Ambulances in Jaipur with Rajasthan registrations and driver details
  const insertAmb = db.prepare(`
    INSERT INTO ambulances (vehicle_no, driver_name, driver_phone, status, latitude, longitude)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  insertAmb.run('RJ-14-AX-1001', 'Rajesh Sharma', '+91-9829000001', 'AVAILABLE', 26.8980, 75.8120);
  insertAmb.run('RJ-14-BY-2002', 'Vikram Meena', '+91-9829000002', 'ON_TRIP', 26.8510, 75.8080);
  insertAmb.run('RJ-14-CZ-3003', 'Amit Choudhary', '+91-9829000003', 'AVAILABLE', 26.9200, 75.7900);
  insertAmb.run('RJ-14-DK-4004', 'Sunita Gurjar', '+91-9829000004', 'AVAILABLE', 26.9650, 75.7720);
  insertAmb.run('RJ-14-EL-5005', 'Manoj Saini', '+91-9829000005', 'OFFLINE', 26.8100, 75.8200);

  // Initial location history for ambulance 1 and 2
  const insertLoc = db.prepare('INSERT INTO ambulance_locations (ambulance_id, latitude, longitude) VALUES (?, ?, ?)');
  insertLoc.run(1, 26.8960, 75.8100);
  insertLoc.run(1, 26.8980, 75.8120);
  insertLoc.run(2, 26.8530, 75.8050);
  insertLoc.run(2, 26.8510, 75.8080);

  // 7. Demo Users (password: password123)
  const insertUser = db.prepare(`
    INSERT INTO users (name, email, password_hash, phone, role, staff_role, hospital_id, ambulance_id, bloodbank_id, active)
    VALUES (@name, @email, @password_hash, @phone, @role, @staff_role, @hospital_id, @ambulance_id, @bloodbank_id, 1)
  `);

  const pwHash = bcrypt.hashSync('password123', 10);
  const demoUsers = [
    {
      name: 'System Administrator',
      email: 'admin@medilink.com',
      password_hash: pwHash,
      phone: '+91-9829900000',
      role: 'ADMIN',
      staff_role: 'ADMIN',
      hospital_id: null,
      ambulance_id: null,
      bloodbank_id: null,
    },
    {
      name: 'Riya Sharma',
      email: 'patient@medilink.com',
      password_hash: pwHash,
      phone: '+91-9829911111',
      role: 'PATIENT',
      staff_role: 'CLINICAL',
      hospital_id: null,
      ambulance_id: null,
      bloodbank_id: null,
    },
    {
      name: 'Dr. Arjun (SMS Clinical Staff)',
      email: 'hospital@medilink.com',
      password_hash: pwHash,
      phone: '+91-9829922222',
      role: 'HOSPITAL',
      staff_role: 'CLINICAL',
      hospital_id: 1, // SMS Hospital
      ambulance_id: null,
      bloodbank_id: null,
    },
    {
      name: 'Sunita Sharma (SMS Resource Manager)',
      email: 'manager@medilink.com',
      password_hash: pwHash,
      phone: '+91-9829922223',
      role: 'HOSPITAL',
      staff_role: 'RESOURCE_MANAGER',
      hospital_id: 1, // SMS Hospital
      ambulance_id: null,
      bloodbank_id: null,
    },
    {
      name: 'Rajesh Sharma (RJ-14 Operator)',
      email: 'ambulance@medilink.com',
      password_hash: pwHash,
      phone: '+91-9829933333',
      role: 'AMBULANCE',
      staff_role: 'CLINICAL',
      hospital_id: null,
      ambulance_id: 1, // RJ-14-AX-1001
      bloodbank_id: null,
    },
    {
      name: 'Suresh (SMS Blood Bank Staff)',
      email: 'bloodbank@medilink.com',
      password_hash: pwHash,
      phone: '+91-9829944444',
      role: 'BLOODBANK',
      staff_role: 'CLINICAL',
      hospital_id: null,
      ambulance_id: null,
      bloodbank_id: 1, // SMS Blood Bank
    },
    // Second patient for rich queue views
    {
      name: 'Rahul Verma',
      email: 'patient2@medilink.com',
      password_hash: pwHash,
      phone: '+91-9829955555',
      role: 'PATIENT',
      staff_role: 'CLINICAL',
      hospital_id: null,
      ambulance_id: null,
      bloodbank_id: null,
    },
  ];

  for (const u of demoUsers) {
    insertUser.run(u);
  }

  // Link ambulance 1 to operator user (user_id of ambulance operator)
  const ambOperator = db.prepare("SELECT user_id FROM users WHERE email = 'ambulance@medilink.com'").get();
  if (ambOperator) {
    db.prepare('UPDATE ambulances SET operator_user_id = ? WHERE ambulance_id = 1').run(ambOperator.user_id);
  }

  // 8. Sample admissions in various statuses so Hospital and Patient dashboards look alive
  const patient1 = db.prepare("SELECT user_id FROM users WHERE email = 'patient@medilink.com'").get()?.user_id || 2;
  const patient2 = db.prepare("SELECT user_id FROM users WHERE email = 'patient2@medilink.com'").get()?.user_id || 7;

  const insertAdmission = db.prepare(`
    INSERT INTO admissions (patient_id, hospital_id, reason, severity, preferred_department, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  insertAdmission.run(patient1, 1, 'Acute chest pain and severe shortness of breath', 'CRITICAL', 'Emergency', 'PENDING');
  insertAdmission.run(patient2, 1, 'Fracture of left wrist following fall at home', 'MEDIUM', 'Trauma', 'ACCEPTED');
  insertAdmission.run(patient1, 2, 'High fever with seasonal viral infection', 'LOW', 'Emergency', 'COMPLETED');

  // 9. Sample ambulance requests in Jaipur
  const insertAmbReq = db.prepare(`
    INSERT INTO ambulance_requests (patient_id, ambulance_id, pickup_location, pickup_lat, pickup_lng, drop_location, drop_hospital_id, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertAmbReq.run(patient1, 1, 'Near Albert Hall Museum, Ram Niwas Garden, Jaipur', 26.9115, 75.8190, 'SMS Hospital Emergency Ward', 1, 'ACCEPTED');
  insertAmbReq.run(patient2, 2, 'Gaurav Tower, Malviya Nagar, Jaipur', 26.8530, 75.8050, 'Fortis Escorts Emergency', 2, 'EN_ROUTE');
  insertAmbReq.run(patient1, 3, 'Panch Batti, M.I. Road, Jaipur', 26.9170, 75.8110, 'Santokba Durlabhji Hospital', 6, 'COMPLETED');

  // 10. Sample blood reservations in Jaipur
  const insertRes = db.prepare(`
    INSERT INTO reservations (patient_id, unit_id, units_requested, status)
    VALUES (?, ?, ?, ?)
  `);

  insertRes.run(patient1, 1, 2, 'PENDING'); // Bank 1, A+
  insertRes.run(patient2, 5, 1, 'APPROVED'); // Bank 1, O+
  insertRes.run(patient1, 3, 1, 'FULFILLED'); // Bank 1, B+

  console.log('Seed completed successfully. Demo accounts:');
  demoUsers.forEach(u => console.log(`  ${u.role.padEnd(10)} [${u.staff_role.padEnd(16)}] -> ${u.email} (password: password123)`));
}

if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };

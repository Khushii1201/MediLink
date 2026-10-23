const path = require('path');
const Database = require('better-sqlite3');

function getDb(customPath) {
  const envPath = customPath || process.env.DB_PATH;
  let dbPath;
  if (envPath === ':memory:') {
    dbPath = ':memory:';
  } else if (envPath) {
    dbPath = path.isAbsolute(envPath) ? envPath : path.join(__dirname, envPath);
  } else {
    dbPath = path.join(__dirname, 'medilink.db');
  }

  const fs = require('fs');
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  const db = new Database(dbPath);
  if (dbPath !== ':memory:') {
    db.pragma('journal_mode = WAL');
  }
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      user_id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      phone TEXT,
      role TEXT NOT NULL CHECK(role IN ('PATIENT','HOSPITAL','AMBULANCE','BLOODBANK','ADMIN')),
      staff_role TEXT DEFAULT 'CLINICAL',
      hospital_id INTEGER,
      ambulance_id INTEGER,
      bloodbank_id INTEGER,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS hospitals (
      hospital_id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT,
      latitude REAL,
      longitude REAL,
      specialties TEXT,
      insurance_info TEXT,
      phone TEXT,
      email TEXT,
      description TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS doctors (
      doctor_id INTEGER PRIMARY KEY AUTOINCREMENT,
      hospital_id INTEGER NOT NULL REFERENCES hospitals(hospital_id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      specialization TEXT,
      qualification TEXT,
      available INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS resources (
      resource_id INTEGER PRIMARY KEY AUTOINCREMENT,
      hospital_id INTEGER NOT NULL REFERENCES hospitals(hospital_id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK(type IN ('BED','ICU','VENTILATOR')),
      total INTEGER NOT NULL DEFAULT 0,
      available INTEGER NOT NULL DEFAULT 0,
      CONSTRAINT valid_availability CHECK(available >= 0 AND available <= total)
    );

    CREATE TABLE IF NOT EXISTS admissions (
      admission_id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL REFERENCES users(user_id),
      hospital_id INTEGER NOT NULL REFERENCES hospitals(hospital_id),
      reason TEXT,
      severity TEXT NOT NULL DEFAULT 'MEDIUM' CHECK(severity IN ('LOW','MEDIUM','CRITICAL')),
      preferred_department TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','ACCEPTED','REJECTED','COMPLETED','CANCELLED')),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ambulances (
      ambulance_id INTEGER PRIMARY KEY AUTOINCREMENT,
      operator_user_id INTEGER REFERENCES users(user_id),
      vehicle_no TEXT NOT NULL,
      driver_name TEXT,
      driver_phone TEXT,
      status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK(status IN ('AVAILABLE','ON_TRIP','OFFLINE')),
      latitude REAL,
      longitude REAL
    );

    CREATE TABLE IF NOT EXISTS ambulance_requests (
      request_id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL REFERENCES users(user_id),
      ambulance_id INTEGER REFERENCES ambulances(ambulance_id),
      pickup_location TEXT NOT NULL,
      pickup_lat REAL,
      pickup_lng REAL,
      drop_location TEXT,
      drop_hospital_id INTEGER REFERENCES hospitals(hospital_id),
      status TEXT NOT NULL DEFAULT 'REQUESTED' CHECK(status IN ('REQUESTED','ACCEPTED','EN_ROUTE','COMPLETED','CANCELLED')),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ambulance_locations (
      tracking_id INTEGER PRIMARY KEY AUTOINCREMENT,
      ambulance_id INTEGER NOT NULL REFERENCES ambulances(ambulance_id) ON DELETE CASCADE,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      recorded_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS blood_banks (
      bloodbank_id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT,
      latitude REAL,
      longitude REAL,
      phone TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS blood_units (
      unit_id INTEGER PRIMARY KEY AUTOINCREMENT,
      bloodbank_id INTEGER NOT NULL REFERENCES blood_banks(bloodbank_id) ON DELETE CASCADE,
      blood_group TEXT NOT NULL CHECK(blood_group IN ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
      quantity INTEGER NOT NULL DEFAULT 0,
      available INTEGER NOT NULL DEFAULT 0,
      CONSTRAINT valid_blood_stock CHECK(available >= 0 AND available <= quantity)
    );

    CREATE TABLE IF NOT EXISTS reservations (
      reservation_id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL REFERENCES users(user_id),
      unit_id INTEGER NOT NULL REFERENCES blood_units(unit_id),
      units_requested INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','APPROVED','REJECTED','FULFILLED','CANCELLED','EXPIRED')),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS waiting_times (
      estimate_id INTEGER PRIMARY KEY AUTOINCREMENT,
      hospital_id INTEGER NOT NULL REFERENCES hospitals(hospital_id) ON DELETE CASCADE,
      department TEXT NOT NULL,
      minutes INTEGER NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ai_recommendations (
      recommendation_id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL REFERENCES users(user_id),
      hospital_id INTEGER NOT NULL REFERENCES hospitals(hospital_id),
      score REAL NOT NULL,
      reason TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      log_id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(user_id),
      action TEXT NOT NULL,
      entity TEXT NOT NULL,
      entity_id INTEGER,
      details TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    CREATE INDEX IF NOT EXISTS idx_admissions_patient ON admissions(patient_id);
    CREATE INDEX IF NOT EXISTS idx_admissions_hospital ON admissions(hospital_id);
    CREATE INDEX IF NOT EXISTS idx_admissions_status ON admissions(status);
    CREATE INDEX IF NOT EXISTS idx_ambulances_status ON ambulances(status);
    CREATE INDEX IF NOT EXISTS idx_ambulance_requests_patient ON ambulance_requests(patient_id);
    CREATE INDEX IF NOT EXISTS idx_ambulance_requests_ambulance ON ambulance_requests(ambulance_id);
    CREATE INDEX IF NOT EXISTS idx_ambulance_requests_status ON ambulance_requests(status);
    CREATE INDEX IF NOT EXISTS idx_ambulance_locations_ambulance ON ambulance_locations(ambulance_id);
    CREATE INDEX IF NOT EXISTS idx_blood_units_bank ON blood_units(bloodbank_id);
    CREATE INDEX IF NOT EXISTS idx_blood_units_group ON blood_units(blood_group);
    CREATE INDEX IF NOT EXISTS idx_reservations_patient ON reservations(patient_id);
    CREATE INDEX IF NOT EXISTS idx_reservations_unit ON reservations(unit_id);
    CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status);
    CREATE INDEX IF NOT EXISTS idx_waiting_times_hospital ON waiting_times(hospital_id);
    CREATE INDEX IF NOT EXISTS idx_ai_recommendations_patient ON ai_recommendations(patient_id);
    CREATE INDEX IF NOT EXISTS idx_ai_recommendations_hospital ON ai_recommendations(hospital_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity);
  `);

  // Safe runtime migration for existing databases
  try {
    db.exec("ALTER TABLE users ADD COLUMN staff_role TEXT DEFAULT 'CLINICAL'");
  } catch (err) {
    // Column already exists or table was just created
  }

  // Non-destructive targeted demo data migration to Jaipur, Rajasthan
  migrateDemoDataToJaipur(db);

  return db;
}

function migrateDemoDataToJaipur(db) {
  try {
    const legacyCount = db.prepare(`
      SELECT COUNT(*) AS c FROM hospitals
      WHERE latitude > 28.0 OR address LIKE '%Delhi%' OR address LIKE '%Gurugram%' OR address LIKE '%Noida%' OR name LIKE '%AIIMS%'
    `).get()?.c || 0;

    if (legacyCount === 0) {
      return;
    }

    console.log(`Detected ${legacyCount} legacy Delhi/Gurugram hospital records in database. Upgrading in-place to Jaipur, Rajasthan demo dataset...`);

    const upgradeTx = db.transaction(() => {
      // 1. Update 8 Hospitals in-place (preserving primary keys and foreign key relationships)
      const updateHospital = db.prepare(`
        UPDATE hospitals
        SET name = @name,
            address = @address,
            latitude = @latitude,
            longitude = @longitude,
            specialties = @specialties,
            insurance_info = @insurance_info,
            phone = @phone,
            email = @email,
            description = @description
        WHERE hospital_id = @id
      `);

      const insertHospitalWithId = db.prepare(`
        INSERT INTO hospitals (hospital_id, name, address, latitude, longitude, specialties, insurance_info, phone, email, description)
        VALUES (@id, @name, @address, @latitude, @longitude, @specialties, @insurance_info, @phone, @email, @description)
      `);

      const jaipurHospitals = [
        {
          id: 1,
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
          id: 2,
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
          id: 3,
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
          id: 4,
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
          id: 5,
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
          id: 6,
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
          id: 7,
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
          id: 8,
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

      for (const h of jaipurHospitals) {
        const existing = db.prepare('SELECT hospital_id FROM hospitals WHERE hospital_id = ?').get(h.id);
        if (existing) {
          updateHospital.run(h);
        } else {
          insertHospitalWithId.run(h);
        }
      }

      // 2. Update Blood Banks 1..3 in-place
      const jaipurBloodBanks = [
        {
          id: 1,
          name: 'SMS Hospital Regional Blood Bank',
          address: 'Sawai Man Singh Hospital Campus, J.L.N. Marg, Jaipur',
          latitude: 26.8950,
          longitude: 75.8150,
          phone: '+91-141-2560291',
        },
        {
          id: 2,
          name: 'Swasthya Kalyan Blood Centre',
          address: 'Sitapura Institutional Area, Tonk Road, Jaipur',
          latitude: 26.7820,
          longitude: 75.8340,
          phone: '+91-141-2771234',
        },
        {
          id: 3,
          name: 'Rotary Club Jaipur Blood Bank',
          address: 'Gandhi Nagar Club Road, Bajaj Nagar, Jaipur',
          latitude: 26.8830,
          longitude: 75.8050,
          phone: '+91-141-2706500',
        },
      ];

      const updateBloodBank = db.prepare(`
        UPDATE blood_banks
        SET name = @name, address = @address, latitude = @latitude, longitude = @longitude, phone = @phone
        WHERE bloodbank_id = @id
      `);
      const insertBloodBankWithId = db.prepare(`
        INSERT INTO blood_banks (bloodbank_id, name, address, latitude, longitude, phone)
        VALUES (@id, @name, @address, @latitude, @longitude, @phone)
      `);

      for (const b of jaipurBloodBanks) {
        const existing = db.prepare('SELECT bloodbank_id FROM blood_banks WHERE bloodbank_id = ?').get(b.id);
        if (existing) {
          updateBloodBank.run(b);
        } else {
          insertBloodBankWithId.run(b);
        }
      }

      // 3. Update Ambulances 1..5 in-place to Jaipur coordinates and RJ-14 registrations
      const jaipurAmbulances = [
        { id: 1, vehicle: 'RJ-14-EA-1001', driver: 'Vikram Singh', phone: '9829011111', lat: 26.8988, lng: 75.8164 },
        { id: 2, vehicle: 'RJ-14-EA-2002', driver: 'Kailash Choudhary', phone: '9829022222', lat: 26.8530, lng: 75.8060 },
        { id: 3, vehicle: 'RJ-14-EA-3003', driver: 'Mohan Lal Meena', phone: '9829033333', lat: 26.8465, lng: 75.8015 },
        { id: 4, vehicle: 'RJ-14-EA-4004', driver: 'Surendra Gurjar', phone: '9829044444', lat: 26.9720, lng: 75.7770 },
        { id: 5, vehicle: 'RJ-14-EA-5005', driver: 'Dinesh Sharma', phone: '9829055555', lat: 26.8050, lng: 75.8240 },
      ];

      const updateAmbulance = db.prepare(`
        UPDATE ambulances
        SET vehicle_no = @vehicle, driver_name = @driver, driver_phone = @phone, latitude = @lat, longitude = @lng
        WHERE ambulance_id = @id
      `);
      const insertAmbulanceWithId = db.prepare(`
        INSERT INTO ambulances (ambulance_id, vehicle_no, driver_name, driver_phone, status, latitude, longitude)
        VALUES (@id, @vehicle, @driver, @phone, 'AVAILABLE', @lat, @lng)
      `);

      for (const a of jaipurAmbulances) {
        const existing = db.prepare('SELECT ambulance_id FROM ambulances WHERE ambulance_id = ?').get(a.id);
        if (existing) {
          updateAmbulance.run(a);
        } else {
          insertAmbulanceWithId.run(a);
        }
      }

      // 4. Update user labels and ensure manager@medilink.com exists
      db.prepare(`
        UPDATE users
        SET name = 'Dr. Arjun Mehta (SMS Hospital)'
        WHERE email = 'hospital@medilink.com'
      `).run();

      db.prepare(`
        UPDATE users
        SET name = 'Suresh Kumar (SMS Blood Bank)'
        WHERE email = 'bloodbank@medilink.com'
      `).run();

      const managerUser = db.prepare("SELECT user_id FROM users WHERE email = 'manager@medilink.com'").get();
      if (!managerUser) {
        const bcrypt = require('bcryptjs');
        const hash = bcrypt.hashSync('password123', 10);
        db.prepare(`
          INSERT INTO users (name, email, password_hash, phone, role, staff_role, hospital_id, active)
          VALUES ('Sunita Sharma (Resource Manager)', 'manager@medilink.com', ?, '9829066666', 'HOSPITAL', 'RESOURCE_MANAGER', 1, 1)
        `).run(hash);
      }

      // 5. Update legacy ambulance requests coordinates from Delhi (>28) to Jaipur
      db.prepare(`
        UPDATE ambulance_requests
        SET pickup_lat = 26.8920,
            pickup_lng = 75.8250,
            pickup_location = 'Raja Park, Jaipur'
        WHERE pickup_lat > 28.0
      `).run();
    });

    upgradeTx();
    console.log('Successfully upgraded legacy database to Jaipur, Rajasthan demo records in-place.');
  } catch (err) {
    console.warn('Non-destructive Jaipur migration warning:', err.message);
  }
}

const defaultDb = getDb();

defaultDb.getDb = getDb;
defaultDb.migrateDemoDataToJaipur = migrateDemoDataToJaipur;

module.exports = defaultDb;

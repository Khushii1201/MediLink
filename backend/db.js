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
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','APPROVED','REJECTED','FULFILLED','CANCELLED')),
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

  return db;
}

const defaultDb = getDb();

defaultDb.getDb = getDb;

module.exports = defaultDb;

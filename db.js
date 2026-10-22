const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, 'medilink.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
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
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS doctors (
  doctor_id INTEGER PRIMARY KEY AUTOINCREMENT,
  hospital_id INTEGER NOT NULL REFERENCES hospitals(hospital_id),
  name TEXT NOT NULL,
  specialization TEXT,
  available INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS resources (
  resource_id INTEGER PRIMARY KEY AUTOINCREMENT,
  hospital_id INTEGER NOT NULL REFERENCES hospitals(hospital_id),
  type TEXT NOT NULL CHECK(type IN ('BED','ICU','VENTILATOR')),
  total INTEGER NOT NULL DEFAULT 0,
  available INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS admissions (
  admission_id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES users(user_id),
  hospital_id INTEGER NOT NULL REFERENCES hospitals(hospital_id),
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','ACCEPTED','REJECTED','COMPLETED')),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ambulances (
  ambulance_id INTEGER PRIMARY KEY AUTOINCREMENT,
  operator_user_id INTEGER REFERENCES users(user_id),
  vehicle_no TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK(status IN ('AVAILABLE','ON_TRIP','OFFLINE')),
  latitude REAL,
  longitude REAL
);

CREATE TABLE IF NOT EXISTS ambulance_requests (
  request_id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES users(user_id),
  ambulance_id INTEGER REFERENCES ambulances(ambulance_id),
  pickup_location TEXT,
  status TEXT NOT NULL DEFAULT 'REQUESTED' CHECK(status IN ('REQUESTED','ACCEPTED','EN_ROUTE','COMPLETED','CANCELLED')),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS blood_banks (
  bloodbank_id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  address TEXT
);

CREATE TABLE IF NOT EXISTS blood_units (
  unit_id INTEGER PRIMARY KEY AUTOINCREMENT,
  bloodbank_id INTEGER NOT NULL REFERENCES blood_banks(bloodbank_id),
  blood_group TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  available INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS reservations (
  reservation_id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES users(user_id),
  unit_id INTEGER NOT NULL REFERENCES blood_units(unit_id),
  units_requested INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','APPROVED','REJECTED','FULFILLED')),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS waiting_times (
  estimate_id INTEGER PRIMARY KEY AUTOINCREMENT,
  hospital_id INTEGER NOT NULL REFERENCES hospitals(hospital_id),
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
`);

module.exports = db;

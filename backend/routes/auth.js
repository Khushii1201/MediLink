const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { JWT_SECRET, authRequired } = require('../middleware/auth');
const { isValidEmail, isValidPhone } = require('../middleware/validate');
const { logAudit } = require('../services/audit');

const router = express.Router();

// Public registration: ALWAYS forces PATIENT role, ignoring any role in the request body
router.post('/register', (req, res) => {
  const { name, email, password, phone } = req.body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Name is required' });
  }

  const trimmedEmail = (email || '').trim().toLowerCase();
  if (!isValidEmail(trimmedEmail)) {
    return res.status(400).json({ error: 'A valid email address is required' });
  }

  if (!password || typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long' });
  }

  const cleanPhone = phone ? String(phone).trim() : null;
  if (cleanPhone && !isValidPhone(cleanPhone)) {
    return res.status(400).json({ error: 'Invalid phone number format' });
  }

  const existing = db.prepare('SELECT user_id FROM users WHERE LOWER(email) = ?').get(trimmedEmail);
  if (existing) {
    return res.status(409).json({ error: 'An account with this email already exists' });
  }

  // Always force PATIENT role for public registration
  const role = 'PATIENT';
  const password_hash = bcrypt.hashSync(password, 10);

  const info = db.prepare(`
    INSERT INTO users (name, email, password_hash, phone, role, active)
    VALUES (?, ?, ?, ?, ?, 1)
  `).run(name.trim(), trimmedEmail, password_hash, cleanPhone, role);

  const userId = info.lastInsertRowid;
  logAudit(db, { user_id: userId, action: 'REGISTER', entity: 'users', entity_id: userId, details: { role } });

  const token = jwt.sign(
    { user_id: userId, role, name: name.trim(), email: trimmedEmail },
    JWT_SECRET,
    { expiresIn: '12h' }
  );

  res.status(201).json({
    token,
    user: {
      user_id: userId,
      name: name.trim(),
      email: trimmedEmail,
      phone: cleanPhone,
      role,
      hospital_id: null,
      ambulance_id: null,
      bloodbank_id: null,
      active: 1,
    },
  });
});

// Login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const user = db.prepare('SELECT * FROM users WHERE LOWER(email) = ?').get(cleanEmail);

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  if (!user.active) {
    return res.status(403).json({ error: 'Account has been deactivated. Please contact an administrator.' });
  }

  const token = jwt.sign(
    {
      user_id: user.user_id,
      role: user.role,
      name: user.name,
      email: user.email,
      hospital_id: user.hospital_id,
      ambulance_id: user.ambulance_id,
      bloodbank_id: user.bloodbank_id,
    },
    JWT_SECRET,
    { expiresIn: '12h' }
  );

  res.json({
    token,
    user: {
      user_id: user.user_id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      hospital_id: user.hospital_id,
      ambulance_id: user.ambulance_id,
      bloodbank_id: user.bloodbank_id,
      active: user.active,
    },
  });
});

// GET /api/auth/me - returns current user from DB to validate stored token
router.get('/me', authRequired, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;

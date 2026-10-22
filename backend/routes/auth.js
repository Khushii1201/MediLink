const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

router.post('/register', (req, res) => {
  const { name, email, password, phone, role } = req.body;
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'name, email, password, and role are required' });
  }
  const allowedRoles = ['PATIENT', 'HOSPITAL', 'AMBULANCE', 'BLOODBANK', 'ADMIN'];
  if (!allowedRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  const existing = db.prepare('SELECT user_id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ error: 'An account with this email already exists' });

  const password_hash = bcrypt.hashSync(password, 10);
  const info = db.prepare(`INSERT INTO users (name, email, password_hash, phone, role) VALUES (?,?,?,?,?)`)
    .run(name, email, password_hash, phone || null, role);

  const token = jwt.sign({ user_id: info.lastInsertRowid, role, name, email }, JWT_SECRET, { expiresIn: '12h' });
  res.status(201).json({ token, user: { user_id: info.lastInsertRowid, name, email, role } });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = jwt.sign(
    { user_id: user.user_id, role: user.role, name: user.name, email: user.email,
      hospital_id: user.hospital_id, ambulance_id: user.ambulance_id, bloodbank_id: user.bloodbank_id },
    JWT_SECRET, { expiresIn: '12h' }
  );
  res.json({
    token,
    user: {
      user_id: user.user_id, name: user.name, email: user.email, role: user.role,
      hospital_id: user.hospital_id, ambulance_id: user.ambulance_id, bloodbank_id: user.bloodbank_id,
    },
  });
});

module.exports = router;

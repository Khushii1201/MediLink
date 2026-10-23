const jwt = require('jsonwebtoken');
const db = require('../db');

const isProd = process.env.NODE_ENV === 'production';
let JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  if (isProd) {
    console.error('FATAL: JWT_SECRET environment variable is required in production.');
    process.exit(1);
  } else {
    JWT_SECRET = 'medilink-dev-secret-change-in-production';
    console.warn('WARNING: Running with default dev JWT_SECRET. Set JWT_SECRET in production.');
  }
}

function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing authentication token' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // Verify user exists and is active in DB
    const user = db.prepare('SELECT user_id, name, email, role, staff_role, hospital_id, ambulance_id, bloodbank_id, active FROM users WHERE user_id = ?').get(decoded.user_id);
    if (!user) {
      return res.status(401).json({ error: 'User account not found' });
    }
    if (!user.active) {
      return res.status(403).json({ error: 'Account has been deactivated. Please contact an administrator.' });
    }
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions for this action' });
    }
    next();
  };
}

module.exports = { authRequired, requireRole, JWT_SECRET };

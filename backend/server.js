require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const db = require('./db'); // ensures schema exists before routes load

const authRoutes = require('./routes/auth');
const hospitalRoutes = require('./routes/hospitals');
const admissionRoutes = require('./routes/admissions');
const ambulanceRoutes = require('./routes/ambulances');
const bloodbankRoutes = require('./routes/bloodbank');
const recommendationRoutes = require('./routes/recommendations');
const waitingTimeRoutes = require('./routes/waitingtime');
const adminRoutes = require('./routes/admin');

const app = express();
const isProd = process.env.NODE_ENV === 'production';

// Security Headers with Helmet
app.use(
  helmet({
    contentSecurityPolicy: false, // Allows Leaflet OpenStreetMap tiles & frontend assets without restrictive header blocking
    crossOriginEmbedderPolicy: false,
  })
);

// CORS Configuration
if (isProd && process.env.CORS_ORIGIN) {
  const allowedOrigins = process.env.CORS_ORIGIN.split(',').map(o => o.trim()).filter(Boolean);
  app.use(cors({ origin: allowedOrigins, credentials: true }));
} else {
  app.use(cors());
}

// Request Body Limit
app.use(express.json({ limit: '100kb' }));

// General Rate Limiter (skip in tests)
if (process.env.NODE_ENV !== 'test') {
  const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests from this IP, please try again later.' },
  });
  app.use('/api', generalLimiter);

  // Stricter Rate Limiter for Authentication endpoints
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 25,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many authentication attempts. Please try again after 15 minutes.' },
  });
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/register', authLimiter);
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'medilink-backend',
    env: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  });
});

// Public Stats endpoint for landing page (no auth, aggregates only)
app.get('/api/public/stats', (req, res) => {
  try {
    const hospitalsCount = db.prepare('SELECT COUNT(*) AS c FROM hospitals').get()?.c || 0;

    const bedsAvailable = db.prepare(`
      SELECT SUM(available) AS s FROM resources WHERE type = 'BED'
    `).get()?.s || 0;

    const icuAvailable = db.prepare(`
      SELECT SUM(available) AS s FROM resources WHERE type = 'ICU'
    `).get()?.s || 0;

    const bloodAvailable = db.prepare(`
      SELECT SUM(available) AS s FROM blood_units
    `).get()?.s || 0;

    const ambulancesAvailable = db.prepare(`
      SELECT COUNT(*) AS c FROM ambulances WHERE status = 'AVAILABLE'
    `).get()?.c || 0;

    res.json({
      hospitals: hospitalsCount,
      beds_available: Number(bedsAvailable),
      icu_available: Number(icuAvailable),
      blood_units_available: Number(bloodAvailable),
      ambulances_available: ambulancesAvailable,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve stats' });
  }
});

// REST API Routes
app.use('/api/auth', authRoutes);
app.use('/api/hospitals', hospitalRoutes);
app.use('/api/admissions', admissionRoutes);
app.use('/api/ambulances', ambulanceRoutes);
app.use('/api/bloodbank', bloodbankRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/waiting-time', waitingTimeRoutes);
app.use('/api/admin', adminRoutes);

// Single-service production mode: serve frontend/dist static files with SPA fallback
const distPath = path.join(__dirname, '..', 'frontend', 'dist');
if (isProd) {
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// 404 for unhandled API routes
app.use('/api/*', (req, res) => res.status(404).json({ error: 'Endpoint not found' }));

// Centralized Error Handler (Never leaks stack trace in production)
app.use((err, req, res, next) => {
  if (!isProd) {
    console.error('Unhandled Server Error:', err);
  }
  const status = err.status || 500;
  const message = isProd ? (status === 500 ? 'Internal server error' : err.message) : err.message;
  res.status(status).json({ error: message });
});

const PORT = process.env.PORT || 5000;

if (require.main === module) {
  app.listen(PORT, () => console.log(`MediLink backend running on port ${PORT} (env: ${process.env.NODE_ENV || 'dev'})`));
}

module.exports = app;

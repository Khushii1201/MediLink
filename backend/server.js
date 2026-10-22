require('dotenv').config();
const express = require('express');
const cors = require('cors');

require('./db'); // ensures schema exists before routes load

const authRoutes = require('./routes/auth');
const hospitalRoutes = require('./routes/hospitals');
const admissionRoutes = require('./routes/admissions');
const ambulanceRoutes = require('./routes/ambulances');
const bloodbankRoutes = require('./routes/bloodbank');
const recommendationRoutes = require('./routes/recommendations');
const waitingTimeRoutes = require('./routes/waitingtime');
const adminRoutes = require('./routes/admin');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'medilink-backend' }));

app.use('/api/auth', authRoutes);
app.use('/api/hospitals', hospitalRoutes);
app.use('/api/admissions', admissionRoutes);
app.use('/api/ambulances', ambulanceRoutes);
app.use('/api/bloodbank', bloodbankRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/waiting-time', waitingTimeRoutes);
app.use('/api/admin', adminRoutes);

app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`MediLink backend running on http://localhost:${PORT}`));

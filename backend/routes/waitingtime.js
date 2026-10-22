const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const { hospital_id } = req.query;
  let rows;
  if (hospital_id) {
    rows = db.prepare('SELECT * FROM waiting_times WHERE hospital_id = ?').all(hospital_id);
  } else {
    rows = db.prepare(`SELECT wt.*, h.name AS hospital_name FROM waiting_times wt JOIN hospitals h ON h.hospital_id = wt.hospital_id`).all();
  }
  res.json(rows);
});

module.exports = router;

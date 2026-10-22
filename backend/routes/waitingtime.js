const express = require('express');
const db = require('../db');
const { calculateEstimatedWait } = require('../services/waitingEstimate');

const router = express.Router();

router.get('/', (req, res) => {
  const { hospital_id } = req.query;

  let sql = `
    SELECT wt.*, h.name AS hospital_name
    FROM waiting_times wt
    JOIN hospitals h ON h.hospital_id = wt.hospital_id
  `;
  const params = [];
  if (hospital_id) {
    sql += ' WHERE wt.hospital_id = ?';
    params.push(hospital_id);
  }

  const rawRows = db.prepare(sql).all(...params);

  // For each waiting time entry, fetch hospital bed resources and pending admissions count
  const bedStmt = db.prepare("SELECT total, available FROM resources WHERE hospital_id = ? AND type = 'BED'");
  const pendingStmt = db.prepare("SELECT COUNT(*) AS count FROM admissions WHERE hospital_id = ? AND status = 'PENDING'");

  const rows = rawRows.map((r) => {
    const bed = bedStmt.get(r.hospital_id) || { total: 0, available: 0 };
    const pending = pendingStmt.get(r.hospital_id)?.count || 0;
    const calc = calculateEstimatedWait(r.minutes, bed.total, bed.available, pending);

    return {
      estimate_id: r.estimate_id,
      hospital_id: r.hospital_id,
      hospital_name: r.hospital_name,
      department: r.department,
      reported_minutes: calc.reported_minutes,
      estimated_minutes: calc.estimated_minutes,
      factors: calc.factors,
      note: calc.note,
      updated_at: r.updated_at,
    };
  });

  res.json(rows);
});

module.exports = router;

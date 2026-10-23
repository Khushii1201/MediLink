const express = require('express');
const db = require('../db');
const { authRequired, requireRole } = require('../middleware/auth');
const { logAudit } = require('../services/audit');

const router = express.Router();

// Patient creates admission request
router.post('/', authRequired, requireRole('PATIENT'), (req, res) => {
  const { hospital_id, reason, severity = 'MEDIUM', preferred_department } = req.body;
  if (!hospital_id) return res.status(400).json({ error: 'hospital_id is required' });

  const hospital = db.prepare('SELECT * FROM hospitals WHERE hospital_id = ?').get(hospital_id);
  if (!hospital) return res.status(404).json({ error: 'Hospital not found' });

  const validSeverities = ['LOW', 'MEDIUM', 'CRITICAL'];
  const cleanSeverity = String(severity).toUpperCase();
  if (!validSeverities.includes(cleanSeverity)) {
    return res.status(400).json({ error: 'severity must be one of LOW, MEDIUM, CRITICAL' });
  }

  // Prevent more than 3 simultaneous PENDING requests to the same hospital
  const pendingCount = db.prepare(`
    SELECT COUNT(*) as count FROM admissions
    WHERE patient_id = ? AND hospital_id = ? AND status = 'PENDING'
  `).get(req.user.user_id, hospital_id).count;

  if (pendingCount >= 3) {
    return res.status(409).json({ error: 'Maximum 3 pending admission requests allowed per hospital' });
  }

  const info = db.prepare(`
    INSERT INTO admissions (patient_id, hospital_id, reason, severity, preferred_department, status)
    VALUES (?, ?, ?, ?, ?, 'PENDING')
  `).run(req.user.user_id, hospital_id, reason || null, cleanSeverity, preferred_department || null);

  const newAdmission = db.prepare('SELECT * FROM admissions WHERE admission_id = ?').get(info.lastInsertRowid);
  logAudit(db, {
    user_id: req.user.user_id,
    action: 'CREATE',
    entity: 'admissions',
    entity_id: newAdmission.admission_id,
    details: { hospital_id, severity: cleanSeverity },
  });

  res.status(201).json(newAdmission);
});

// Patient views own requests; hospital views requests for its hospital (sorted CRITICAL first, then oldest); admin sees all
router.get('/', authRequired, (req, res) => {
  let rows;
  if (req.user.role === 'PATIENT') {
    rows = db.prepare(`
      SELECT a.*, h.name AS hospital_name, h.phone AS hospital_phone
      FROM admissions a
      JOIN hospitals h ON h.hospital_id = a.hospital_id
      WHERE a.patient_id = ?
      ORDER BY a.created_at DESC
    `).all(req.user.user_id);
  } else if (req.user.role === 'HOSPITAL') {
    if (!req.user.hospital_id) {
      return res.status(403).json({ error: 'No hospital assigned to this account' });
    }
    rows = db.prepare(`
      SELECT a.*, u.name AS patient_name, u.phone AS patient_phone
      FROM admissions a
      JOIN users u ON u.user_id = a.patient_id
      WHERE a.hospital_id = ?
      ORDER BY
        CASE a.severity
          WHEN 'CRITICAL' THEN 1
          WHEN 'MEDIUM' THEN 2
          WHEN 'LOW' THEN 3
          ELSE 4
        END ASC,
        a.created_at ASC
    `).all(req.user.hospital_id);
  } else if (req.user.role === 'ADMIN') {
    rows = db.prepare(`
      SELECT a.*, h.name AS hospital_name, u.name AS patient_name, u.phone AS patient_phone
      FROM admissions a
      JOIN hospitals h ON h.hospital_id = a.hospital_id
      JOIN users u ON u.user_id = a.patient_id
      ORDER BY a.created_at DESC
    `).all();
  } else {
    return res.status(403).json({ error: 'Not permitted to view admissions' });
  }
  res.json(rows);
});

// Patient cancels own pending request
router.put('/:id/cancel', authRequired, requireRole('PATIENT'), (req, res) => {
  const admission = db.prepare('SELECT * FROM admissions WHERE admission_id = ?').get(req.params.id);
  if (!admission) return res.status(404).json({ error: 'Admission request not found' });
  if (admission.patient_id !== req.user.user_id) {
    return res.status(403).json({ error: 'You can only cancel your own requests' });
  }

  if (!['PENDING', 'ACCEPTED'].includes(admission.status)) {
    return res.status(409).json({ error: `Cannot cancel admission with status ${admission.status}. Only PENDING or ACCEPTED can be cancelled.` });
  }

  const cancelTx = db.transaction(() => {
    if (admission.status === 'ACCEPTED') {
      const bedResource = db.prepare(`
        SELECT resource_id, total, available FROM resources
        WHERE hospital_id = ? AND type = 'BED'
      `).get(admission.hospital_id);

      if (bedResource) {
        db.prepare(`
          UPDATE resources
          SET available = MIN(available + 1, total)
          WHERE resource_id = ?
        `).run(bedResource.resource_id);
      }
    }

    db.prepare(`UPDATE admissions SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP WHERE admission_id = ?`).run(req.params.id);
  });

  cancelTx();

  logAudit(db, {
    user_id: req.user.user_id,
    action: 'CANCEL',
    entity: 'admissions',
    entity_id: admission.admission_id,
    details: { prev_status: admission.status, new_status: 'CANCELLED' },
  });

  res.json(db.prepare('SELECT * FROM admissions WHERE admission_id = ?').get(req.params.id));
});

// Hospital staff processes request (accept / reject / complete / cancel)
router.put('/:id/status', authRequired, requireRole('HOSPITAL', 'ADMIN'), (req, res) => {
  const { status } = req.body;
  const allowed = ['ACCEPTED', 'REJECTED', 'COMPLETED', 'CANCELLED'];
  if (!status || !allowed.includes(status)) {
    return res.status(400).json({ error: 'status must be one of ' + allowed.join(', ') });
  }

  const admission = db.prepare('SELECT * FROM admissions WHERE admission_id = ?').get(req.params.id);
  if (!admission) return res.status(404).json({ error: 'Admission request not found' });

  if (req.user.role === 'HOSPITAL' && req.user.hospital_id !== admission.hospital_id) {
    return res.status(403).json({ error: 'You can only process requests for your own hospital' });
  }

  const currentStatus = admission.status;

  // Enforce State Machine:
  // PENDING -> ACCEPTED | REJECTED
  // ACCEPTED -> COMPLETED | CANCELLED | REJECTED
  const validTransitions = {
    PENDING: ['ACCEPTED', 'REJECTED'],
    ACCEPTED: ['COMPLETED', 'CANCELLED', 'REJECTED'],
  };

  if (!validTransitions[currentStatus] || !validTransitions[currentStatus].includes(status)) {
    return res.status(409).json({
      error: `Invalid status transition from ${currentStatus} to ${status}. Allowed: ${(validTransitions[currentStatus] || []).join(', ') || 'None'}`
    });
  }

  // Execute transition with Bed transaction
  const executeTransition = db.transaction(() => {
    if (status === 'ACCEPTED') {
      const bedResource = db.prepare(`
        SELECT resource_id, total, available FROM resources
        WHERE hospital_id = ? AND type = 'BED'
      `).get(admission.hospital_id);

      if (!bedResource || bedResource.available < 1) {
        throw new Error('NO_BEDS_AVAILABLE');
      }

      // Decrement bed count with atomic concurrency check
      const decRes = db.prepare(`
        UPDATE resources
        SET available = available - 1
        WHERE resource_id = ? AND available > 0
      `).run(bedResource.resource_id);

      if (decRes.changes === 0) {
        throw new Error('NO_BEDS_AVAILABLE');
      }
    } else if (status === 'COMPLETED' || ((status === 'CANCELLED' || status === 'REJECTED') && currentStatus === 'ACCEPTED')) {
      // Restore one bed if completing or if cancelling/rejecting an already ACCEPTED admission
      const bedResource = db.prepare(`
        SELECT resource_id, total, available FROM resources
        WHERE hospital_id = ? AND type = 'BED'
      `).get(admission.hospital_id);

      if (bedResource) {
        db.prepare(`
          UPDATE resources
          SET available = MIN(available + 1, total)
          WHERE resource_id = ?
        `).run(bedResource.resource_id);
      }
    }

    db.prepare(`
      UPDATE admissions
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE admission_id = ?
    `).run(status, req.params.id);
  });

  try {
    executeTransition();
  } catch (err) {
    if (err.message === 'NO_BEDS_AVAILABLE') {
      return res.status(409).json({ error: 'No beds available' });
    }
    return res.status(500).json({ error: 'Failed to update admission status' });
  }

  logAudit(db, {
    user_id: req.user.user_id,
    action: `STATUS_${status}`,
    entity: 'admissions',
    entity_id: admission.admission_id,
    details: { prev_status: currentStatus, new_status: status },
  });

  res.json(db.prepare('SELECT * FROM admissions WHERE admission_id = ?').get(req.params.id));
});

module.exports = router;

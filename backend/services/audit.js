function logAudit(db, { user_id, action, entity, entity_id = null, details = null }) {
  try {
    const detailsStr = typeof details === 'object' && details !== null ? JSON.stringify(details) : details;
    db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity, entity_id, details)
      VALUES (?, ?, ?, ?, ?)
    `).run(user_id || null, action, entity, entity_id ? Number(entity_id) : null, detailsStr || null);
  } catch (err) {
    console.error('Audit log failure:', err.message);
  }
}

module.exports = { logAudit };

/**
 * MediLink Blood Group Compatibility & Transfusion Match Matrix
 *
 * NOTE: This module provides standard red blood cell (RBC) ABO and Rh(D) compatibility rules
 * for educational and preliminary healthcare resource coordination.
 * Clinical blood administration strictly requires laboratory antibody cross-matching
 * and physician verification prior to transfusion.
 */

const COMPATIBLE_DONORS = {
  'O-': ['O-'],
  'O+': ['O+', 'O-'],
  'A-': ['A-', 'O-'],
  'A+': ['A+', 'A-', 'O+', 'O-'],
  'B-': ['B-', 'O-'],
  'B+': ['B+', 'B-', 'O+', 'O-'],
  'AB-': ['AB-', 'A-', 'B-', 'O-'],
  'AB+': ['AB+', 'AB-', 'A+', 'A-', 'B+', 'B-', 'O+', 'O-'],
};

/**
 * Returns array of compatible donor blood groups for a given recipient blood group
 */
function getCompatibleDonorGroups(recipientGroup) {
  if (!recipientGroup) return [];
  const clean = String(recipientGroup).trim().toUpperCase();
  return COMPATIBLE_DONORS[clean] || [];
}

/**
 * Checks if a specific donor group can safely be received by a recipient group
 */
function isDonorCompatible(donorGroup, recipientGroup) {
  const compatible = getCompatibleDonorGroups(recipientGroup);
  return compatible.includes(String(donorGroup).trim().toUpperCase());
}

/**
 * Auto-expires approved or pending blood reservations that exceeded the hold TTL
 * (default 24 hours), restoring reserved units to available inventory atomically.
 */
function expireStaleReservations(db, maxAgeHours = 24) {
  const expiredStmt = db.prepare(`
    SELECT r.reservation_id, r.unit_id, r.units_requested, r.status
    FROM reservations r
    WHERE r.status = 'APPROVED'
      AND datetime(r.updated_at, '+' || ? || ' hours') < datetime('now')
  `);

  const expiredRows = expiredStmt.all(maxAgeHours);
  if (!expiredRows.length) return [];

  const expireTx = db.transaction(() => {
    const expiredIds = [];
    for (const res of expiredRows) {
      // Restore available stock up to total quantity
      db.prepare(`
        UPDATE blood_units
        SET available = MIN(available + ?, quantity)
        WHERE unit_id = ?
      `).run(res.units_requested, res.unit_id);

      db.prepare(`
        UPDATE reservations
        SET status = 'EXPIRED', updated_at = CURRENT_TIMESTAMP
        WHERE reservation_id = ?
      `).run(res.reservation_id);

      expiredIds.push(res.reservation_id);
    }
    return expiredIds;
  });

  return expireTx();
}

module.exports = {
  COMPATIBLE_DONORS,
  getCompatibleDonorGroups,
  isDonorCompatible,
  expireStaleReservations,
};

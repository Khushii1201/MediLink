function calculateEstimatedWait(reportedMinutes, bedTotal, bedAvailable, pendingAdmissions) {
  const reported = Number(reportedMinutes) || 0;
  const total = Number(bedTotal) || 0;
  const available = Number(bedAvailable) || 0;
  const pending = Number(pendingAdmissions) || 0;

  const occupancyRatio = total > 0 ? Math.max(0, Math.min(1, (total - available) / total)) : 0;
  const occupancyFactor = occupancyRatio * 0.5;

  const estimated = reported * (1 + occupancyFactor) + 5 * pending;

  return {
    reported_minutes: reported,
    estimated_minutes: Math.round(estimated),
    factors: {
      occupancy_ratio: Math.round(occupancyRatio * 100) / 100,
      occupancy_factor: Math.round(occupancyFactor * 100) / 100,
      pending_admissions: pending,
    },
    note: 'Estimate, informational only, not a clinical or triage decision',
  };
}

module.exports = { calculateEstimatedWait };

export function StatCard({
  label,
  value,
  subtext,
  icon,
  variant = 'default',
  className = '',
}) {
  return (
    <div className={`stat-card stat-${variant} ${className}`}>
      <div className="stat-content">
        <span className="stat-label">{label}</span>
        <span className="stat-value">{value}</span>
        {subtext && <span className="stat-subtext">{subtext}</span>}
      </div>
      {icon && <div className="stat-icon" aria-hidden="true">{icon}</div>}
    </div>
  );
}

export default StatCard;

export function Badge({ status, label, size = 'md' }) {
  const norm = (status || label || '').toUpperCase();

  let variant = 'default';

  // Amber / Pending
  if (['PENDING', 'REQUESTED'].includes(norm)) {
    variant = 'warning';
  }
  // Green / Positive
  else if (['ACCEPTED', 'APPROVED', 'AVAILABLE', 'COMPLETED', 'ACTIVE', 'LOW'].includes(norm)) {
    variant = 'success';
  }
  // Red / Danger
  else if (['REJECTED', 'CANCELLED', 'INACTIVE', 'OFFLINE', 'CRITICAL'].includes(norm)) {
    variant = 'danger';
  }
  // Blue / In Transit
  else if (['EN_ROUTE', 'ON_TRIP', 'MEDIUM'].includes(norm)) {
    variant = 'info';
  }
  // Muted / Fulfilled
  else if (['FULFILLED'].includes(norm)) {
    variant = 'slate';
  }

  return (
    <span className={`badge badge-${variant} badge-${size}`}>
      {label || status}
    </span>
  );
}

export default Badge;

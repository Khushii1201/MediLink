export function Spinner({ size = 'md', className = '' }) {
  return (
    <div className={`spinner-wrapper ${className}`} role="status" aria-label="Loading">
      <div className={`spinner spinner-${size}`} />
    </div>
  );
}

export function SkeletonLine({ width = '100%', height = '1rem', className = '' }) {
  return <div className={`skeleton skeleton-line ${className}`} style={{ width, height }} />;
}

export function SkeletonCard({ count = 1 }) {
  return (
    <div className="skeleton-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-card">
          <SkeletonLine width="60%" height="1.5rem" />
          <SkeletonLine width="90%" height="1rem" />
          <SkeletonLine width="40%" height="1rem" />
        </div>
      ))}
    </div>
  );
}

export default Spinner;

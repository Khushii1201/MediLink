import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Spinner } from './Spinner';

export default function ProtectedRoute({ roles = [], children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="page-loading-screen">
        <Spinner size="lg" />
        <p className="muted">Verifying credentials...</p>
      </div>
    );
  }

  if (!user) {
    const returnUrl = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect=${returnUrl}`} replace />;
  }

  if (roles.length > 0 && !roles.includes(user.role)) {
    return (
      <div className="page unauthorized-page">
        <div className="card text-center" style={{ maxWidth: '480px', margin: '4rem auto' }}>
          <h2>Access Restricted</h2>
          <p className="muted">
            Your account ({user.role}) does not have permission to access this area.
          </p>
          <div style={{ marginTop: '1.5rem' }}>
            <Navigate to={`/${user.role.toLowerCase()}`} replace />
          </div>
        </div>
      </div>
    );
  }

  return children;
}

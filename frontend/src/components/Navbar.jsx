import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const DASHBOARD_PATH = {
  PATIENT: '/patient',
  HOSPITAL: '/hospital',
  AMBULANCE: '/ambulance',
  BLOODBANK: '/bloodbank',
  ADMIN: '/admin',
};

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="navbar">
      <Link to="/" className="brand">MediLink</Link>
      <nav>
        {user ? (
          <>
            <Link to={DASHBOARD_PATH[user.role] || '/'}>Dashboard</Link>
            <span className="user-chip">{user.name} · {user.role}</span>
            <button className="btn-link" onClick={() => { logout(); navigate('/'); }}>Log out</button>
          </>
        ) : (
          <>
            <Link to="/login">Log in</Link>
            <Link to="/register" className="btn-primary-small">Sign up</Link>
          </>
        )}
      </nav>
    </header>
  );
}

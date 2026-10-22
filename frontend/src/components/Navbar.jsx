import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const ROLE_DASHBOARDS = {
  PATIENT: { path: '/patient', label: 'Patient Portal' },
  HOSPITAL: { path: '/hospital', label: 'Hospital Ops' },
  AMBULANCE: { path: '/ambulance', label: 'Ambulance Console' },
  BLOODBANK: { path: '/bloodbank', label: 'Blood Bank Ops' },
  ADMIN: { path: '/admin', label: 'Admin Console' },
};

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
    setMobileMenuOpen(false);
  };

  const closeMobile = () => setMobileMenuOpen(false);

  // Persistent red emergency action
  const handleEmergencyClick = () => {
    closeMobile();
    if (!user) {
      navigate('/login?redirect=%2Fpatient');
    } else if (user.role === 'PATIENT') {
      navigate('/patient');
    } else {
      navigate(ROLE_DASHBOARDS[user.role]?.path || '/');
    }
  };

  const dashboardInfo = user ? ROLE_DASHBOARDS[user.role] : null;

  return (
    <header className="navbar-root">
      <div className="navbar-container">
        {/* Brand */}
        <Link to="/" className="brand-logo" onClick={closeMobile}>
          <span className="brand-icon" aria-hidden="true">✚</span>
          <span className="brand-text">MediLink</span>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="nav-links desktop-only" aria-label="Main Navigation">
          <NavLink to="/" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            Home
          </NavLink>
          <NavLink to="/hospitals" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            Find Hospitals
          </NavLink>
          <NavLink to="/blood" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            Blood Bank
          </NavLink>
          <NavLink to="/about" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            How It Works
          </NavLink>
          {dashboardInfo && (
            <NavLink to={dashboardInfo.path} className={({ isActive }) => `nav-item nav-item-dashboard ${isActive ? 'active' : ''}`}>
              {dashboardInfo.label}
            </NavLink>
          )}
        </nav>

        {/* Action Controls */}
        <div className="nav-actions desktop-only">
          <button
            type="button"
            className="btn-emergency"
            onClick={handleEmergencyClick}
            aria-label="Emergency Ambulance Request"
          >
            <span className="emergency-siren" aria-hidden="true">🚨</span>
            <span>Emergency Care</span>
          </button>

          {user ? (
            <div className="user-profile-menu">
              <span className="user-badge-chip">
                <span className="user-name">{user.name}</span>
                <span className="user-role-tag">{user.role}</span>
              </span>
              <button
                type="button"
                className="btn-logout"
                onClick={handleLogout}
                aria-label="Log out"
              >
                Sign out
              </button>
            </div>
          ) : (
            <div className="auth-buttons">
              <Link to="/login" className="btn-signin">
                Log in
              </Link>
              <Link to="/register" className="btn-register">
                Register
              </Link>
            </div>
          )}
        </div>

        {/* Mobile Hamburger Toggle */}
        <div className="mobile-toggle mobile-only">
          <button
            type="button"
            className="btn-emergency-mobile"
            onClick={handleEmergencyClick}
            aria-label="Emergency Request"
          >
            🚨
          </button>
          <button
            type="button"
            className="hamburger-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-expanded={mobileMenuOpen}
            aria-label="Toggle navigation menu"
          >
            <span className="hamburger-bar" />
            <span className="hamburger-bar" />
            <span className="hamburger-bar" />
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="mobile-drawer mobile-only">
          <NavLink to="/" end className="mobile-nav-item" onClick={closeMobile}>
            Home
          </NavLink>
          <NavLink to="/hospitals" className="mobile-nav-item" onClick={closeMobile}>
            Find Hospitals
          </NavLink>
          <NavLink to="/blood" className="mobile-nav-item" onClick={closeMobile}>
            Blood Bank
          </NavLink>
          <NavLink to="/about" className="mobile-nav-item" onClick={closeMobile}>
            How It Works
          </NavLink>

          {dashboardInfo && (
            <NavLink to={dashboardInfo.path} className="mobile-nav-item mobile-dashboard-link" onClick={closeMobile}>
              {dashboardInfo.label}
            </NavLink>
          )}

          <div className="mobile-drawer-footer">
            {user ? (
              <div className="mobile-user-box">
                <div className="mobile-user-details">
                  <strong>{user.name}</strong>
                  <span className="muted">Role: {user.role}</span>
                </div>
                <button type="button" className="btn btn-outline" onClick={handleLogout}>
                  Log out
                </button>
              </div>
            ) : (
              <div className="mobile-auth-actions">
                <Link to="/login" className="btn btn-secondary full-width" onClick={closeMobile}>
                  Log in
                </Link>
                <Link to="/register" className="btn btn-primary full-width" onClick={closeMobile}>
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

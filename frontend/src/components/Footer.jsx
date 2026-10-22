import { Link } from 'react-router-dom';

const currentYear = new Date().getFullYear();

export default function Footer() {
  return (
    <footer className="app-footer">
      <div className="footer-container">
        <div className="footer-top">
          <div className="footer-brand-col">
            <div className="brand-logo footer-logo">
              <span className="brand-icon" aria-hidden="true">✚</span>
              <span className="brand-text">MediLink</span>
            </div>
            <p className="footer-tagline">
              Connecting patients, hospitals, emergency ambulance fleets, and blood banks through real-time coordination.
            </p>
          </div>

          <div className="footer-links-col">
            <h4>Quick Access</h4>
            <ul>
              <li><Link to="/hospitals">Find Nearby Hospitals</Link></li>
              <li><Link to="/blood">Blood Unit Availability</Link></li>
              <li><Link to="/about">About & Architecture</Link></li>
              <li><Link to="/login">Portal Login</Link></li>
            </ul>
          </div>

          <div className="footer-links-col">
            <h4>Emergency Contact</h4>
            <div className="emergency-callout">
              <span className="badge badge-danger">National Emergency Helpline: 112</span>
              <p className="muted" style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
                Ambulance: 102 / 108<br />
                National Blood Helpline: 1910
              </p>
            </div>
          </div>
        </div>

        <div className="footer-disclaimer-box">
          <p className="disclaimer-text">
            <strong>Medical & Emergency Disclaimer:</strong> MediLink is a healthcare coordination and administrative tool designed to facilitate resource visibility. It is <strong>not</strong> a substitute for professional medical advice, clinical diagnosis, or government emergency dispatch services. In any life-threatening emergency, call your local emergency number (<strong>112 in India</strong>) immediately.
          </p>
        </div>

        <div className="footer-bottom">
          <p>&copy; {currentYear} MediLink Platform. Open Source Healthcare Architecture.</p>
        </div>
      </div>
    </footer>
  );
}

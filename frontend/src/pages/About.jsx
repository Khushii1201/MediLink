export default function About() {
  return (
    <div className="page about-page">
      <div className="page-header text-center" style={{ maxWidth: '780px', margin: '0 auto 2.5rem auto' }}>
        <span className="section-tag">About MediLink</span>
        <h2>Centralized Healthcare Coordination Architecture</h2>
        <p className="muted">
          MediLink is an open, full-stack emergency coordination and resource discovery system connecting patients,
          hospitals, ambulance operators, blood banks, and health authorities into a unified network.
        </p>
      </div>

      <div className="about-sections-wrap" style={{ maxWidth: '850px', margin: '0 auto' }}>
        {/* Core Architecture */}
        <div className="card about-card">
          <h3>1. System Architecture & Tech Stack</h3>
          <p>
            MediLink is engineered with a lean, reliable full-stack architecture focused on high auditability and transactional integrity:
          </p>
          <ul className="about-tech-list">
            <li><strong>Frontend:</strong> React 19, Vite 8, React Router 7, and Leaflet OpenStreetMap tiles. Fast, responsive, accessible across mobile and desktop devices.</li>
            <li><strong>Backend:</strong> Node.js 20+ with Express 4, hardened with Helmet, strict rate limiters, and defensive validation middleware.</li>
            <li><strong>Database:</strong> SQLite with WAL (Write-Ahead Logging) and enforced foreign-key constraints via <code>better-sqlite3</code>.</li>
            <li><strong>Security:</strong> Role-based access control (RBAC), bcrypt salted hashing, and signed JWT authentication.</li>
          </ul>
        </div>

        {/* Recommendation Engine */}
        <div className="card about-card">
          <h3>2. Explainable Recommendation Algorithm</h3>
          <p>
            Rather than relying on opaque machine learning black boxes, MediLink employs an explainable, deterministic rule-based scoring engine with explicit factor weights:
          </p>

          <div className="weights-table-card">
            <table className="table">
              <thead>
                <tr>
                  <th>Factor</th>
                  <th>Standard Weight</th>
                  <th>Normalized Function</th>
                  <th>Rationale</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Geographical Distance</strong></td>
                  <td>35% (0.35)</td>
                  <td><code>max(0, 1 - distance_km / 25)</code></td>
                  <td>Prioritizes closer facilities for critical emergency transit within a 25 km radius.</td>
                </tr>
                <tr>
                  <td><strong>Resource Availability</strong></td>
                  <td>30% (0.30)</td>
                  <td><code>available / total</code></td>
                  <td>Ensures patients are routed to hospitals with verified empty General, ICU, or Ventilator beds.</td>
                </tr>
                <tr>
                  <td><strong>Estimated Waiting Time</strong></td>
                  <td>20% (0.20)</td>
                  <td><code>max(0, 1 - wait_min / 120)</code></td>
                  <td>Favors facilities with shorter turnaround times to prevent ER overcrowding.</td>
                </tr>
                <tr>
                  <td><strong>Specialty Match</strong></td>
                  <td>15% (0.15)</td>
                  <td><code>1.0 if match else 0.0</code></td>
                  <td>Routes specialized conditions (e.g., Cardiology, Trauma) to matching specialty departments.</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="muted" style={{ fontSize: '0.85rem', marginTop: '0.75rem' }}>
            * Note: If no specific specialty is requested by the patient, the 15% specialty weight is proportionally redistributed across distance, availability, and wait time.
          </p>
        </div>

        {/* Dynamic Waiting-Time Formula */}
        <div className="card about-card">
          <h3>3. Waiting-Time Estimation Model</h3>
          <p>
            Real waiting times fluctuate with ward load. MediLink calculates dynamic department estimates using staff-reported baseline times adjusted by real-time bed occupancy and active pending admission queues:
          </p>
          <div className="formula-box">
            <code>Estimated Wait = Reported Baseline × (1 + Bed Occupancy Ratio × 0.5) + (5 min × Pending Admissions)</code>
          </div>
          <p className="muted" style={{ marginTop: '0.75rem' }}>
            This ensures that as a hospital's beds fill up or new critical admissions enter the triage queue, waiting times dynamically scale to reflect the true operational backlog.
          </p>
        </div>

        {/* Boundaries & Limitations */}
        <div className="card about-card boundary-card">
          <h3>4. Operational Scope & Boundaries</h3>
          <p>
            To maintain honest and transparent communication, the following boundaries govern the MediLink platform:
          </p>
          <ul className="boundary-list">
            <li>
              <strong>Self-Reported Facility Data:</strong> Hospital resource availability and waiting times are maintained by facility staff and demo datasets; MediLink does not claim live integration with proprietary hospital EHR systems.
            </li>
            <li>
              <strong>Browser Geolocation & Dispatch:</strong> Location calculations use the Haversine spherical formula and browser GPS coordinates. It is not an official government emergency dispatch network.
            </li>
            <li>
              <strong>Not Clinical Triage:</strong> Recommendations, scores, and waiting times are mathematical estimates intended for coordination and comparison only. They do not constitute clinical judgment or triage diagnoses.
            </li>
            <li>
              <strong>Emergency Services:</strong> In any life-threatening situation, call your local emergency response service (<strong>112 in India</strong>) immediately.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

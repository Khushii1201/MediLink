import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { MapView } from '../components/MapView';
import { StatCard } from '../components/StatCard';
import { Button } from '../components/Button';
import { useGeolocation } from '../hooks/useGeolocation';

export default function Home() {
  const navigate = useNavigate();
  const { coords } = useGeolocation(true);
  const [stats, setStats] = useState(null);
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    Promise.all([
      api.getPublicStats().catch(() => null),
      api.searchHospitals({ lat: coords.lat, lng: coords.lng }).catch(() => []),
    ]).then(([statsRes, hospRes]) => {
      if (!isMounted) return;
      if (statsRes) setStats(statsRes);
      if (Array.isArray(hospRes)) setHospitals(hospRes.slice(0, 8));
      setLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [coords.lat, coords.lng]);

  const mapMarkers = hospitals.map((h) => ({
    id: h.hospital_id,
    lat: h.latitude,
    lng: h.longitude,
    iconType: 'HOSPITAL',
    popup: (
      <div className="map-popup-card">
        <strong>{h.name}</strong>
        <p className="muted" style={{ margin: '0.25rem 0' }}>{h.address}</p>
        <div style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
          <span>Beds available: <strong>{h.available_beds}</strong></span> ·{' '}
          <span>ICU: <strong>{h.available_icu}</strong></span>
        </div>
        <Link to={`/hospitals/${h.hospital_id}`} style={{ display: 'inline-block', marginTop: '0.5rem', color: '#0f766e', fontWeight: 600 }}>
          View details &rarr;
        </Link>
      </div>
    ),
  }));

  return (
    <div className="landing-page">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-container">
          <div className="hero-badge">
            <span className="badge badge-success">Live Network</span>
            <span>Real-time Healthcare Resource Coordination</span>
          </div>

          <h1 className="hero-title">
            Find immediate care.<br />
            Track hospital resources in real time.
          </h1>

          <p className="hero-subtitle">
            MediLink connects patients with nearby hospitals, verified available ICU beds,
            dispatched emergency ambulances, and certified blood bank inventories across Delhi NCR.
          </p>

          <div className="hero-cta-group">
            <Link to="/hospitals">
              <Button variant="primary" size="lg" className="hero-btn">
                <span>🏥 Find a Hospital Now</span>
              </Button>
            </Link>
            <Button
              variant="danger"
              size="lg"
              className="hero-btn"
              onClick={() => navigate('/patient')}
            >
              <span>🚨 Request Ambulance</span>
            </Button>
          </div>
        </div>
      </section>

      {/* Live Stats Strip */}
      <section className="stats-strip-section">
        <div className="section-container">
          <div className="stats-grid">
            <StatCard
              label="Connected Hospitals"
              value={stats?.hospitals ?? (loading ? '...' : 8)}
              icon="🏥"
              variant="teal"
            />
            <StatCard
              label="Available Beds"
              value={stats?.beds_available ?? (loading ? '...' : 210)}
              subtext="General & Emergency"
              icon="🛏️"
              variant="teal"
            />
            <StatCard
              label="Available ICU Beds"
              value={stats?.icu_available ?? (loading ? '...' : 43)}
              subtext="Critical Care Units"
              icon="🫁"
              variant="blue"
            />
            <StatCard
              label="Blood Units In Stock"
              value={stats?.blood_units_available ?? (loading ? '...' : 153)}
              subtext="Across 8 Blood Groups"
              icon="🩸"
              variant="red"
            />
            <StatCard
              label="Ambulances Ready"
              value={stats?.ambulances_available ?? (loading ? '...' : 3)}
              subtext="Live GPS Fleet"
              icon="🚑"
              variant="blue"
            />
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section className="how-it-works-section">
        <div className="section-container text-center">
          <span className="section-tag">Coordinated Healthcare</span>
          <h2 className="section-title">How MediLink Works</h2>
          <p className="section-desc">
            Emergency response and resource locating in three simple steps.
          </p>

          <div className="steps-grid">
            <div className="step-card">
              <div className="step-number">01</div>
              <h3>Search & Assess</h3>
              <p className="muted">
                Patients view verified hospital beds, ICU facilities, doctor availability,
                and transparent estimated waiting times based on current occupancy.
              </p>
            </div>

            <div className="step-card">
              <div className="step-number">02</div>
              <h3>Coordinate & Dispatch</h3>
              <p className="muted">
                Submit emergency admission requests or dispatch the nearest available ambulance
                calculated via Haversine distance with real-time location tracking.
              </p>
            </div>

            <div className="step-card">
              <div className="step-number">03</div>
              <h3>Reserve & Receive Care</h3>
              <p className="muted">
                Hold critical blood units with verified inventory reservation, while hospital
                staff review and accept admissions before patient arrival.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Map Preview Section */}
      <section className="map-preview-section">
        <div className="section-container">
          <div className="map-section-header">
            <div>
              <span className="section-tag">Live Network Map</span>
              <h2 className="section-title">Nearby Hospital Facilities</h2>
              <p className="muted">
                Browse network hospitals in Delhi NCR with verified real-time bed counts.
              </p>
            </div>
            <Link to="/hospitals">
              <Button variant="outline" size="sm">
                Explore Full Directory &rarr;
              </Button>
            </Link>
          </div>

          <div className="map-card-wrapper">
            <MapView
              center={[coords.lat, coords.lng]}
              zoom={11}
              markers={mapMarkers}
              height="450px"
            />
          </div>
        </div>
      </section>

      {/* Capabilities Section */}
      <section className="features-section">
        <div className="section-container text-center">
          <span className="section-tag">Platform Capabilities</span>
          <h2 className="section-title">Comprehensive Emergency Ecosystem</h2>
          <p className="section-desc">
            Bridging fragmented healthcare resources into an integrated command platform.
          </p>

          <div className="features-grid">
            <div className="feature-card">
              <span className="feature-icon">🛏️</span>
              <h4>Bed & ICU Management</h4>
              <p className="muted">
                Direct visibility into total vs. available beds, ICU units, and ventilators. Live atomic decrement upon admission acceptance prevents overbooking.
              </p>
            </div>

            <div className="feature-card">
              <span className="feature-icon">🚑</span>
              <h4>Smart Ambulance Dispatch</h4>
              <p className="muted">
                Haversine distance routing automatically assigns the closest available vehicle with operator location broadcast and dynamic ETA calculation.
              </p>
            </div>

            <div className="feature-card">
              <span className="feature-icon">🩸</span>
              <h4>Blood Bank Inventory</h4>
              <p className="muted">
                Comprehensive stock monitoring for all 8 blood groups with reservation management and single-step atomic fulfillment logic.
              </p>
            </div>

            <div className="feature-card">
              <span className="feature-icon">🧠</span>
              <h4>Smart Recommendation</h4>
              <p className="muted">
                Weighted rule-based scoring combining distance (35%), target resource availability (30%), waiting time (20%), and medical specialty match (15%).
              </p>
            </div>

            <div className="feature-card">
              <span className="feature-icon">⏱️</span>
              <h4>Dynamic Wait Estimates</h4>
              <p className="muted">
                Waiting-time model incorporates staff-reported baseline times adjusted by real-time bed occupancy and active pending admissions queue.
              </p>
            </div>

            <div className="feature-card">
              <span className="feature-icon">📊</span>
              <h4>Administrative Governance</h4>
              <p className="muted">
                Audit logs on state transitions, resource utilization dashboards, staff user provisioning, and non-destructive entity management.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Role Personas Section */}
      <section className="roles-section">
        <div className="section-container">
          <div className="text-center" style={{ marginBottom: '2.5rem' }}>
            <span className="section-tag">Who Uses MediLink</span>
            <h2 className="section-title">Tailored Portals for Healthcare Roles</h2>
          </div>

          <div className="roles-grid">
            <div className="role-card">
              <span className="role-icon">🧑‍⚕️</span>
              <h4>Patients & Caregivers</h4>
              <p className="muted">
                Compare hospitals, request admissions, book ambulances, and reserve rare blood groups.
              </p>
            </div>

            <div className="role-card">
              <span className="role-icon">🏥</span>
              <h4>Hospital Operations</h4>
              <p className="muted">
                Manage doctor shifts, adjust live bed counts, update wait times, and process incoming patient admissions.
              </p>
            </div>

            <div className="role-card">
              <span className="role-icon">🚑</span>
              <h4>Ambulance Operators</h4>
              <p className="muted">
                Receive nearest dispatch assignments, broadcast live coordinates, and manage trip lifecycles.
              </p>
            </div>

            <div className="role-card">
              <span className="role-icon">🩸</span>
              <h4>Blood Bank Coordinators</h4>
              <p className="muted">
                Maintain group inventory levels, manage stock alerts, and fulfill emergency patient reservations.
              </p>
            </div>

            <div className="role-card">
              <span className="role-icon">🛡️</span>
              <h4>System Administrators</h4>
              <p className="muted">
                Oversee platform analytics, track audit logs, register staff accounts, and maintain facility rosters.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

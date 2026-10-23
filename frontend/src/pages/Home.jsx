import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../hooks/useAuth';
import { MapView } from '../components/MapView';
import { StatCard } from '../components/StatCard';
import { Button } from '../components/Button';
import { useGeolocation } from '../hooks/useGeolocation';

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
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

  const handleEmergencyAction = () => {
    if (!user) {
      navigate('/login?redirect=%2Fpatient');
    } else if (user.role === 'PATIENT') {
      navigate('/patient');
    } else {
      navigate('/hospitals');
    }
  };

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
          <span>Beds available: <strong>{h.available_beds ?? 0}</strong></span> ·{' '}
          <span>ICU: <strong>{h.available_icu ?? 0}</strong></span>
        </div>
        <Link to={`/hospitals/${h.hospital_id}`} style={{ display: 'inline-block', marginTop: '0.5rem', color: '#0f766e', fontWeight: 600 }}>
          View facility details &rarr;
        </Link>
      </div>
    ),
  }));

  return (
    <div className="landing-page">
      {/* Compact, Informative Hero Section */}
      <section className="hero-section">
        <div className="hero-container">
          <div className="hero-badge">
            <span>Healthcare Operations Network</span>
          </div>

          <h1 className="hero-title">
            Emergency Care & Hospital Resource Coordination
          </h1>

          <p className="hero-subtitle">
            MediLink connects patients, healthcare facilities, ambulance operators, and blood banks
            to locate and coordinate emergency medical resources in real time across Delhi NCR.
          </p>

          <div className="hero-cta-group">
            <Link to="/hospitals">
              <Button variant="primary" size="md">
                Find Hospitals
              </Button>
            </Link>
            <Button
              variant="danger"
              size="md"
              onClick={handleEmergencyAction}
            >
              Emergency Care Assistance
            </Button>
          </div>
        </div>
      </section>

      {/* Verified Resource Summaries */}
      <section className="stats-strip-section">
        <div className="section-container">
          <div className="stats-grid">
            <StatCard
              label="Connected Hospitals"
              value={stats?.hospitals ?? (loading ? '...' : '—')}
              subtext="Network facilities"
              variant="teal"
            />
            <StatCard
              label="Available Beds"
              value={stats?.beds_available ?? (loading ? '...' : '—')}
              subtext="General & emergency"
              variant="teal"
            />
            <StatCard
              label="Available ICU Beds"
              value={stats?.icu_available ?? (loading ? '...' : '—')}
              subtext="Critical care units"
              variant="blue"
            />
            <StatCard
              label="Blood Units In Stock"
              value={stats?.blood_units_available ?? (loading ? '...' : '—')}
              subtext="Across 8 blood groups"
              variant="red"
            />
            <StatCard
              label="Available Ambulances"
              value={stats?.ambulances_available ?? (loading ? '...' : '—')}
              subtext="Ready for dispatch"
              variant="blue"
            />
          </div>
        </div>
      </section>

      {/* How MediLink Works (3 Clear Steps) */}
      <section className="how-it-works-section">
        <div className="section-container">
          <span className="section-tag">Workflow</span>
          <h2 className="section-title">How MediLink Works</h2>
          <p className="section-desc">
            Coordinated resource access and emergency response in three structured steps.
          </p>

          <div className="steps-grid">
            <div className="step-card">
              <div className="step-number">Step 01</div>
              <h3>Locate Verified Resources</h3>
              <p>
                Patients check real-time bed occupancy, ICU capacity, and transparent estimated
                waiting times adjusted by current hospital census.
              </p>
            </div>

            <div className="step-card">
              <div className="step-number">Step 02</div>
              <h3>Request & Dispatch</h3>
              <p>
                Submit emergency admission requests directly to hospital triage, or request
                dispatch of the nearest available ambulance calculated by distance.
              </p>
            </div>

            <div className="step-card">
              <div className="step-number">Step 03</div>
              <h3>Reserve & Coordinate Care</h3>
              <p>
                Hold critical blood units through verified inventory reservation, while medical
                teams review patient severity and prepare incoming resources.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Nearby Hospital Directory Map */}
      <section className="map-preview-section">
        <div className="section-container">
          <div className="map-section-header">
            <div>
              <span className="section-tag">Facility Directory</span>
              <h2 className="section-title">Regional Hospital Facilities</h2>
              <p className="muted" style={{ margin: 0 }}>
                Participating healthcare centers with verified capacity and emergency contact information.
              </p>
            </div>
            <Link to="/hospitals">
              <Button variant="outline" size="sm">
                View All Hospitals &rarr;
              </Button>
            </Link>
          </div>

          <div className="map-card-wrapper">
            <MapView
              center={[coords.lat, coords.lng]}
              zoom={11}
              markers={mapMarkers}
              height="420px"
              autoFit={mapMarkers.length > 0}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

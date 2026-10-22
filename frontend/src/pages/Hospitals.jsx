import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { MapView } from '../components/MapView';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { SkeletonCard } from '../components/Spinner';
import { useGeolocation } from '../hooks/useGeolocation';

export default function Hospitals() {
  const { coords, requestLocation, loading: geoLoading } = useGeolocation(true);

  const [hospitals, setHospitals] = useState([]);
  const [filterOptions, setFilterOptions] = useState({ specialties: [], insurers: [] });
  const [loading, setLoading] = useState(true);

  // Filter state
  const [query, setQuery] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState('');
  const [selectedInsurance, setSelectedInsurance] = useState('');
  const [minBeds, setMinBeds] = useState('');
  const [hasIcu, setHasIcu] = useState(false);
  const [hasVentilator, setHasVentilator] = useState(false);
  const [sort, setSort] = useState('distance');

  // Load filter dropdown options once
  useEffect(() => {
    api.getHospitalFilters()
      .then(setFilterOptions)
      .catch(() => {});
  }, []);

  // Fetch hospitals based on active filters
  const fetchHospitals = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (query.trim()) params.q = query.trim();
      if (selectedSpecialty) params.specialty = selectedSpecialty;
      if (selectedInsurance) params.insurance = selectedInsurance;
      if (minBeds) params.min_beds = minBeds;
      if (hasIcu) params.has_icu = 'true';
      if (hasVentilator) params.has_ventilator = 'true';
      if (coords.lat && coords.lng) {
        params.lat = coords.lat;
        params.lng = coords.lng;
      }
      if (sort) params.sort = sort;

      const data = await api.searchHospitals(params);
      setHospitals(data || []);
    } catch (err) {
      console.error('Failed to search hospitals:', err);
    } finally {
      setLoading(false);
    }
  }, [query, selectedSpecialty, selectedInsurance, minBeds, hasIcu, hasVentilator, coords.lat, coords.lng, sort]);

  useEffect(() => {
    fetchHospitals();
  }, [fetchHospitals]);

  const mapMarkers = hospitals.map((h) => ({
    id: h.hospital_id,
    lat: h.latitude,
    lng: h.longitude,
    iconType: 'HOSPITAL',
    popup: (
      <div className="map-popup-card">
        <strong>{h.name}</strong>
        <p className="muted" style={{ margin: '0.25rem 0' }}>{h.address}</p>
        <div style={{ fontSize: '0.85rem', margin: '0.25rem 0' }}>
          <span>Beds: <strong>{h.available_beds}</strong></span> ·{' '}
          <span>ICU: <strong>{h.available_icu}</strong></span> ·{' '}
          <span>Est. Wait: <strong>{h.avg_wait_minutes}m</strong></span>
        </div>
        <Link to={`/hospitals/${h.hospital_id}`} style={{ color: '#0f766e', fontWeight: 600 }}>
          View details &rarr;
        </Link>
      </div>
    ),
  }));

  const resetFilters = () => {
    setQuery('');
    setSelectedSpecialty('');
    setSelectedInsurance('');
    setMinBeds('');
    setHasIcu(false);
    setHasVentilator(false);
    setSort('distance');
  };

  return (
    <div className="page hospitals-page">
      <div className="page-header">
        <div>
          <h2>Hospital Directory & Resource Tracker</h2>
          <p className="muted">
            Search verified network hospitals in Delhi NCR. Compare available beds, ICU facilities, and waiting times.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={requestLocation} loading={geoLoading}>
          <span>📍 Near Me</span>
        </Button>
      </div>

      {/* Filter Toolbar */}
      <div className="card filter-panel">
        <div className="filter-row">
          <div className="search-input-wrap">
            <span className="search-icon" aria-hidden="true">🔍</span>
            <input
              type="text"
              className="form-input search-input"
              placeholder="Search by hospital name, address, or landmark..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <select
            className="form-input filter-select"
            value={selectedSpecialty}
            onChange={(e) => setSelectedSpecialty(e.target.value)}
            aria-label="Filter by specialty"
          >
            <option value="">All Specialties</option>
            {filterOptions.specialties.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <select
            className="form-input filter-select"
            value={selectedInsurance}
            onChange={(e) => setSelectedInsurance(e.target.value)}
            aria-label="Filter by insurance provider"
          >
            <option value="">All Insurers</option>
            {filterOptions.insurers.map((i) => (
              <option key={i} value={i}>{i}</option>
            ))}
          </select>

          <select
            className="form-input filter-select"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            aria-label="Sort hospitals by"
          >
            <option value="distance">Sort by Distance</option>
            <option value="beds">Sort by Most Beds Available</option>
            <option value="wait">Sort by Shortest Wait Time</option>
          </select>
        </div>

        <div className="filter-checkbox-row">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={hasIcu}
              onChange={(e) => setHasIcu(e.target.checked)}
            />
            <span>ICU Beds Available</span>
          </label>

          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={hasVentilator}
              onChange={(e) => setHasVentilator(e.target.checked)}
            />
            <span>Ventilators Available</span>
          </label>

          <div className="min-beds-filter">
            <span className="filter-label">Min Beds:</span>
            <input
              type="number"
              min="0"
              className="form-input input-narrow"
              placeholder="0"
              value={minBeds}
              onChange={(e) => setMinBeds(e.target.value)}
            />
          </div>

          {(query || selectedSpecialty || selectedInsurance || minBeds || hasIcu || hasVentilator) && (
            <button type="button" className="btn-link clear-filter-btn" onClick={resetFilters}>
              Reset filters
            </button>
          )}
        </div>
      </div>

      {/* Main Content Layout: Results + Map */}
      <div className="hospitals-split-layout">
        {/* Hospitals List */}
        <div className="hospitals-list-col">
          <div className="results-count-bar">
            <span>Showing <strong>{hospitals.length}</strong> facilities</span>
          </div>

          {loading ? (
            <SkeletonCard count={4} />
          ) : hospitals.length === 0 ? (
            <EmptyState
              title="No hospitals matched your filters"
              message="Try broadening your search query or unchecking some filter options."
              actionLabel="Reset filters"
              onAction={resetFilters}
            />
          ) : (
            <div className="hospital-cards-grid">
              {hospitals.map((h) => {
                const bedTotal = h.resources?.find((r) => r.type === 'BED')?.total || 1;
                const bedAvail = h.available_beds || 0;
                const bedPct = Math.round((bedAvail / bedTotal) * 100);

                return (
                  <div key={h.hospital_id} className="card hospital-item-card">
                    <div className="hospital-card-header">
                      <div>
                        <h3 className="hospital-card-name">
                          <Link to={`/hospitals/${h.hospital_id}`}>{h.name}</Link>
                        </h3>
                        <p className="hospital-card-address">{h.address}</p>
                      </div>
                      {h.distance_km !== null && (
                        <div className="distance-badge">
                          <strong>{h.distance_km}</strong> km away
                        </div>
                      )}
                    </div>

                    <div className="hospital-resource-strip">
                      <div className="res-stat-item">
                        <span className="res-label">Available Beds</span>
                        <div className="res-val-wrap">
                          <strong className="res-val">{bedAvail}</strong>
                          <span className="muted">/ {bedTotal}</span>
                        </div>
                        <div className="progress-bar-track">
                          <div
                            className={`progress-bar-fill ${bedPct < 15 ? 'fill-danger' : (bedPct < 40 ? 'fill-warning' : 'fill-success')}`}
                            style={{ width: `${Math.min(100, Math.max(5, bedPct))}%` }}
                          />
                        </div>
                      </div>

                      <div className="res-stat-item">
                        <span className="res-label">ICU / Vents</span>
                        <div className="res-val-wrap">
                          <strong>{h.available_icu}</strong> ICU · <strong>{h.available_ventilators}</strong> Vent
                        </div>
                        <span className="res-sub">Emergency critical care</span>
                      </div>

                      <div className="res-stat-item">
                        <span className="res-label">Est. Emergency Wait</span>
                        <div className="res-val-wrap">
                          <strong className="res-val text-warning">{h.avg_wait_minutes} min</strong>
                        </div>
                        <span className="res-sub">Occupancy-adjusted</span>
                      </div>
                    </div>

                    {h.specialties && (
                      <div className="hospital-specialties-wrap">
                        {h.specialties.split(',').slice(0, 4).map((s) => (
                          <span key={s} className="specialty-chip">{s.trim()}</span>
                        ))}
                      </div>
                    )}

                    <div className="hospital-card-footer">
                      <div className="doctor-availability-info">
                        <Badge
                          status={h.doctors_available > 0 ? 'AVAILABLE' : 'OFFLINE'}
                          label={`${h.doctors_available} Doctors On Duty`}
                          size="sm"
                        />
                      </div>
                      <Link to={`/hospitals/${h.hospital_id}`}>
                        <Button variant="primary" size="sm">
                          Facility Details &rarr;
                        </Button>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sticky Map Column */}
        <div className="hospitals-map-col">
          <div className="sticky-map-card card">
            <h4 style={{ marginBottom: '0.75rem' }}>Map View</h4>
            <MapView
              center={[coords.lat, coords.lng]}
              zoom={11}
              markers={mapMarkers}
              height="550px"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

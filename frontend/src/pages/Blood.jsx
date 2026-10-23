import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { useGeolocation } from '../hooks/useGeolocation';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { FormField } from '../components/FormField';
import { SkeletonCard } from '../components/Spinner';
import { EmptyState } from '../components/EmptyState';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function Blood() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useToast();
  const { coords, requestLocation, loading: geoLoading } = useGeolocation(true);

  const [selectedGroup, setSelectedGroup] = useState('');
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Reservation modal state
  const [reserveModalOpen, setReserveModalOpen] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [unitsRequested, setUnitsRequested] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const fetchUnits = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (selectedGroup) params.blood_group = selectedGroup;
      if (coords.lat && coords.lng) {
        params.lat = coords.lat;
        params.lng = coords.lng;
      }
      const data = await api.searchBloodUnits(params);
      setUnits(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load blood units:', err);
      setError(err.message || 'Unable to load blood inventory listings. Please check your network connection.');
    } finally {
      setLoading(false);
    }
  }, [selectedGroup, coords.lat, coords.lng]);

  useEffect(() => {
    fetchUnits();
  }, [fetchUnits]);

  const handleReserveClick = (unit) => {
    if (!user) {
      const returnUrl = encodeURIComponent(window.location.pathname);
      navigate(`/login?redirect=${returnUrl}`);
      return;
    }
    if (user.role !== 'PATIENT') {
      addToast('Only registered patient accounts can reserve blood units.', 'warning');
      return;
    }
    if (unit.available < 1) {
      addToast('No units currently available for reservation.', 'error');
      return;
    }
    setSelectedUnit(unit);
    setUnitsRequested(1);
    setReserveModalOpen(true);
  };

  const handleReserveSubmit = async (e) => {
    e.preventDefault();
    if (!selectedUnit) return;
    const qty = Number(unitsRequested);
    if (qty < 1 || qty > selectedUnit.available) {
      addToast(`Please request between 1 and ${selectedUnit.available} units.`, 'error');
      return;
    }

    setSubmitting(true);
    try {
      await api.reserveBlood(selectedUnit.unit_id, qty);
      addToast('Blood unit reservation submitted successfully! The blood bank will review your request.', 'success');
      setReserveModalOpen(false);
      fetchUnits();
      navigate('/patient');
    } catch (err) {
      addToast(err.message || 'Failed to submit reservation', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page blood-page">
      <div className="page-header">
        <div>
          <h2>Blood Bank Directory & Stock Locator</h2>
          <p className="muted">
            Locate available blood units across certified blood banks in Jaipur and surrounding regions. Live inventory and patient reservations.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={requestLocation} loading={geoLoading}>
          <span>Use My Location</span>
        </Button>
      </div>

      {/* Blood Group Chips Toolbar */}
      <div className="card blood-filter-panel">
        <span className="filter-label" style={{ fontWeight: 600 }}>Filter by Blood Group:</span>
        <div className="blood-chips-row">
          <button
            type="button"
            className={`blood-chip ${selectedGroup === '' ? 'active' : ''}`}
            onClick={() => setSelectedGroup('')}
          >
            All Groups
          </button>
          {BLOOD_GROUPS.map((grp) => (
            <button
              key={grp}
              type="button"
              className={`blood-chip ${selectedGroup === grp ? 'active' : ''}`}
              onClick={() => setSelectedGroup(grp)}
            >
              {grp}
            </button>
          ))}
        </div>
      </div>

      {/* Dynamic Results Count Bar */}
      <div className="results-count-bar">
        <span>
          Showing <strong>{loading ? '...' : units.length}</strong>{' '}
          {units.length === 1 ? 'inventory listing' : 'inventory listings'}
          {selectedGroup ? ` for blood group ${selectedGroup}` : ' across all blood groups'}
        </span>
      </div>

      {loading ? (
        <SkeletonCard count={4} />
      ) : error ? (
        <div className="card alert-card alert-card-danger" style={{ textAlign: 'center', padding: '2rem' }}>
          <p style={{ color: 'var(--color-danger)', fontWeight: 600, marginBottom: '1rem' }}>{error}</p>
          <Button variant="outline" size="sm" onClick={fetchUnits}>
            Retry Loading Inventory
          </Button>
        </div>
      ) : units.length === 0 ? (
        <EmptyState
          title={selectedGroup ? `No ${selectedGroup} blood inventory found` : 'No blood inventory found'}
          message={
            selectedGroup
              ? 'No inventory available for this blood group across registered blood banks.'
              : 'No blood bank inventory records match the current criteria.'
          }
          actionLabel={selectedGroup ? 'View All Blood Groups' : undefined}
          onAction={selectedGroup ? () => setSelectedGroup('') : undefined}
        />
      ) : (
        <div className="blood-cards-grid">
          {units.map((unit) => {
            const isLowStock = unit.available > 0 && unit.available < 5;
            const isOutOfStock = unit.available === 0;

            return (
              <div key={unit.unit_id} className={`card blood-unit-card ${isLowStock ? 'low-stock' : ''}`}>
                <div className="blood-card-top">
                  <div className="blood-group-badge">
                    {unit.blood_group}
                  </div>
                  <div className="blood-bank-info">
                    <h3 className="blood-bank-name">{unit.bloodbank_name}</h3>
                    <p className="blood-bank-addr">{unit.address}</p>
                    {unit.phone && (
                      <span className="contact-tag">Tel: {unit.phone}</span>
                    )}
                  </div>
                  {unit.distance_km !== null && (
                    <div className="distance-badge">
                      <strong>{unit.distance_km}</strong> km away
                    </div>
                  )}
                </div>

                <div className="blood-stock-metrics">
                  <div className="metric-box">
                    <span className="metric-label">Available Units</span>
                    <strong className={`metric-val ${isOutOfStock ? 'text-danger' : (isLowStock ? 'text-warning' : 'text-success')}`}>
                      {unit.available} units
                    </strong>
                  </div>
                  <div className="metric-box">
                    <span className="metric-label">Total Stock</span>
                    <strong className="metric-val">{unit.quantity} units</strong>
                  </div>
                </div>

                {isLowStock && (
                  <div className="low-stock-alert">
                    <strong>Critical Low Stock:</strong> Only {unit.available} unit(s) remaining.
                  </div>
                )}
                {isOutOfStock && (
                  <div className="out-of-stock-alert">
                    <strong>Currently Depleted:</strong> 0 units available.
                  </div>
                )}

                <div className="blood-card-footer">
                  <Button
                    variant={isOutOfStock ? 'secondary' : 'primary'}
                    size="sm"
                    disabled={isOutOfStock}
                    onClick={() => handleReserveClick(unit)}
                  >
                    {isOutOfStock ? 'Unavailable' : 'Reserve Units'}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Reserve Blood Modal */}
      {selectedUnit && (
        <Modal
          isOpen={reserveModalOpen}
          onClose={() => setReserveModalOpen(false)}
          title={`Reserve Blood Group ${selectedUnit.blood_group} — ${selectedUnit.bloodbank_name}`}
        >
          <form onSubmit={handleReserveSubmit}>
            <p className="muted" style={{ marginBottom: '1.25rem' }}>
              Holding inventory for patient transfusion. Your reservation request will be validated and verified by blood bank personnel.
            </p>

            <FormField
              label="Units Requested"
              id="units-requested"
              required
              hint={`Maximum available for this group: ${selectedUnit.available} unit(s)`}
            >
              <input
                type="number"
                id="units-requested"
                className="form-input"
                min="1"
                max={selectedUnit.available}
                value={unitsRequested}
                onChange={(e) => setUnitsRequested(e.target.value)}
                required
              />
            </FormField>

            <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
              <Button variant="secondary" onClick={() => setReserveModalOpen(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" loading={submitting}>
                Confirm Reservation
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

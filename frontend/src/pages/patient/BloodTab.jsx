import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api';
import { useToast } from '../../hooks/useToast';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { Modal, ConfirmDialog } from '../../components/Modal';
import { FormField } from '../../components/FormField';
import { EmptyState } from '../../components/EmptyState';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function BloodTab({ coords, reservations = [], onRefresh }) {
  const { addToast } = useToast();

  const [selectedGroup, setSelectedGroup] = useState('');
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(false);

  // Reservation modal state
  const [reserveModalOpen, setReserveModalOpen] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [unitsRequested, setUnitsRequested] = useState(1);
  const [reserving, setReserving] = useState(false);

  // Cancellation state
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  const fetchUnits = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedGroup) params.blood_group = selectedGroup;
      if (coords.lat && coords.lng) {
        params.lat = coords.lat;
        params.lng = coords.lng;
      }
      const data = await api.searchBloodUnits(params);
      setUnits(data || []);
    } catch (err) {
      console.error('Failed to load blood units:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedGroup, coords.lat, coords.lng]);

  useEffect(() => {
    fetchUnits();
  }, [fetchUnits]);

  const handleOpenReserve = (unit) => {
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

    setReserving(true);
    try {
      await api.reserveBlood(selectedUnit.unit_id, qty);
      addToast('Blood units reserved! Blood bank staff will verify and prepare your request.', 'success');
      setReserveModalOpen(false);
      fetchUnits();
      onRefresh();
    } catch (err) {
      addToast(err.message || 'Failed to submit reservation', 'error');
    } finally {
      setReserving(false);
    }
  };

  const handleCancelReservation = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await api.cancelReservation(cancelTarget.reservation_id);
      addToast('Reservation cancelled successfully', 'success');
      setCancelTarget(null);
      fetchUnits();
      onRefresh();
    } catch (err) {
      addToast(err.message || 'Failed to cancel reservation', 'error');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="tab-pane blood-tab">
      {/* Search & Reserve Section */}
      <div className="card blood-search-card" style={{ marginBottom: '2rem' }}>
        <h3>Find & Reserve Blood Units</h3>
        <p className="muted">Search certified blood banks by group and reserve units for urgent medical procedures.</p>

        <div className="blood-chips-row" style={{ marginTop: '1rem' }}>
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

        <div className="blood-results-grid" style={{ marginTop: '1.5rem' }}>
          {loading ? (
            <p className="muted">Loading blood bank inventories...</p>
          ) : units.length === 0 ? (
            <p className="muted">No blood units found matching your selection.</p>
          ) : (
            units.slice(0, 6).map((unit) => (
              <div key={unit.unit_id} className="blood-mini-card">
                <div className="mini-badge">{unit.blood_group}</div>
                <div className="mini-details">
                  <strong>{unit.bloodbank_name}</strong>
                  <span className="muted">{unit.address}</span>
                  {unit.distance_km !== null && (
                    <span className="mini-dist">📍 {unit.distance_km} km away</span>
                  )}
                  <span className="mini-avail">
                    <strong>{unit.available}</strong> units available
                  </span>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={unit.available < 1}
                  onClick={() => handleOpenReserve(unit)}
                >
                  Reserve
                </Button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* My Reservations Card */}
      <div className="card my-reservations-card">
        <h4 style={{ marginBottom: '1rem' }}>My Blood Unit Reservations</h4>
        {reservations.length === 0 ? (
          <EmptyState
            title="No active blood reservations"
            message="You have not reserved any blood units yet."
          />
        ) : (
          <div className="reservations-table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Reservation ID</th>
                  <th>Date</th>
                  <th>Blood Group</th>
                  <th>Units</th>
                  <th>Blood Bank</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reservations.map((res) => {
                  const canCancel = ['PENDING', 'APPROVED'].includes(res.status);
                  return (
                    <tr key={res.reservation_id}>
                      <td>#{res.reservation_id}</td>
                      <td>{new Date(res.created_at).toLocaleDateString()}</td>
                      <td><span className="badge badge-danger">{res.blood_group}</span></td>
                      <td><strong>{res.units_requested}</strong></td>
                      <td>
                        {res.bloodbank_name}
                        {res.bloodbank_phone && (
                          <div className="muted" style={{ fontSize: '0.8rem' }}>{res.bloodbank_phone}</div>
                        )}
                      </td>
                      <td><Badge status={res.status} size="sm" /></td>
                      <td>
                        {canCancel && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCancelTarget(res)}
                          >
                            Cancel
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reserve Modal */}
      {selectedUnit && (
        <Modal
          isOpen={reserveModalOpen}
          onClose={() => setReserveModalOpen(false)}
          title={`Reserve Blood Group ${selectedUnit.blood_group} — ${selectedUnit.bloodbank_name}`}
        >
          <form onSubmit={handleReserveSubmit}>
            <p className="muted" style={{ marginBottom: '1rem' }}>
              Reserve units for patient surgery or emergency transfusion.
            </p>
            <FormField
              label="Quantity (Units Requested)"
              id="patient-units-req"
              required
              hint={`Max available: ${selectedUnit.available} units`}
            >
              <input
                type="number"
                id="patient-units-req"
                className="form-input"
                min="1"
                max={selectedUnit.available}
                value={unitsRequested}
                onChange={(e) => setUnitsRequested(e.target.value)}
                required
              />
            </FormField>

            <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
              <Button variant="secondary" onClick={() => setReserveModalOpen(false)} disabled={reserving}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" loading={reserving}>
                Confirm Reservation
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Cancel Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleCancelReservation}
        title="Cancel Blood Reservation"
        message={`Are you sure you want to cancel your reservation for ${cancelTarget?.units_requested} unit(s) of ${cancelTarget?.blood_group}?`}
        confirmText="Yes, Cancel Reservation"
        loading={cancelling}
      />
    </div>
  );
}

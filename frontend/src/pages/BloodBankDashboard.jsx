import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { usePolling } from '../hooks/usePolling';
import { MapView } from '../components/MapView';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { Modal } from '../components/Modal';
import { FormField } from '../components/FormField';
import { Tabs } from '../components/Tabs';
import { Spinner } from '../components/Spinner';
import { EmptyState } from '../components/EmptyState';

const ALL_BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function BloodBankDashboard() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const bloodbankId = user?.bloodbank_id;

  const [activeTab, setActiveTab] = useState('inventory');
  const [bankInfo, setBankInfo] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);

  // Unit edit modal state
  const [editingUnit, setEditingUnit] = useState(null);
  const [editQty, setEditQty] = useState(0);
  const [editAvail, setEditAvail] = useState(0);
  const [unitSaving, setUnitSaving] = useState(false);

  // Add missing group modal state
  const [addGroupModalOpen, setAddGroupModalOpen] = useState(false);
  const [newGroup, setNewGroup] = useState('A+');
  const [newQty, setNewQty] = useState(10);
  const [newAvail, setNewAvail] = useState(10);
  const [addingGroup, setAddingGroup] = useState(false);

  // Profile edit state
  const [profileForm, setProfileForm] = useState({
    name: '',
    address: '',
    phone: '',
    latitude: 26.9124,
    longitude: 75.7873,
  });
  const [profileSaving, setProfileSaving] = useState(false);

  const loadBankData = useCallback(async () => {
    if (!bloodbankId) return;
    try {
      const [banks, unitsData, resData] = await Promise.all([
        api.listBloodBanks(),
        api.searchBloodUnits(),
        api.myReservations(),
      ]);

      const currentBank = (banks || []).find((b) => b.bloodbank_id === bloodbankId);
      if (currentBank) {
        setBankInfo(currentBank);
        setProfileForm({
          name: currentBank.name || '',
          address: currentBank.address || '',
          phone: currentBank.phone || '',
          latitude: currentBank.latitude || 26.9124,
          longitude: currentBank.longitude || 75.7873,
        });
      }

      // Filter units belonging to this blood bank
      const myUnits = (unitsData || []).filter((u) => u.bloodbank_id === bloodbankId);
      setInventory(myUnits);
      setReservations(resData || []);
    } catch (err) {
      console.error('Failed to load blood bank data:', err);
    } finally {
      setLoading(false);
    }
  }, [bloodbankId]);

  useEffect(() => {
    loadBankData();
  }, [loadBankData]);

  // Auto-refresh reservations queue every 15 seconds
  usePolling(loadBankData, 15000, Boolean(bloodbankId));

  // Edit Unit
  const handleOpenEditUnit = (unit) => {
    setEditingUnit(unit);
    setEditQty(unit.quantity);
    setEditAvail(unit.available);
  };

  const handleSaveUnit = async (e) => {
    e.preventDefault();
    if (!editingUnit) return;
    const q = Number(editQty);
    const a = Number(editAvail);
    if (a > q) {
      addToast('Available units cannot exceed total quantity', 'error');
      return;
    }

    setUnitSaving(true);
    try {
      await api.updateBloodUnit(editingUnit.unit_id, {
        quantity: q,
        available: a,
      });
      addToast(`Updated inventory for ${editingUnit.blood_group}`, 'success');
      setEditingUnit(null);
      loadBankData();
    } catch (err) {
      addToast(err.message || 'Failed to update unit', 'error');
    } finally {
      setUnitSaving(false);
    }
  };

  // Add missing blood group
  const handleAddGroupSubmit = async (e) => {
    e.preventDefault();
    const q = Number(newQty);
    const a = Number(newAvail);
    if (a > q) {
      addToast('Available units cannot exceed total quantity', 'error');
      return;
    }

    setAddingGroup(true);
    try {
      await api.createBloodUnit({
        bloodbank_id: bloodbankId,
        blood_group: newGroup,
        quantity: q,
        available: a,
      });
      addToast(`Blood group ${newGroup} added to inventory`, 'success');
      setAddGroupModalOpen(false);
      loadBankData();
    } catch (err) {
      addToast(err.message || 'Failed to add blood group', 'error');
    } finally {
      setAddingGroup(false);
    }
  };

  // Process Reservation (APPROVE, REJECT, FULFIL)
  const handleReservationStatus = async (reservationId, status) => {
    try {
      await api.updateReservation(reservationId, status);
      addToast(`Reservation status changed to ${status}`, 'success');
      loadBankData();
    } catch (err) {
      addToast(err.message || 'Failed to update reservation', 'error');
    }
  };

  // Save Profile
  const handleProfileSave = async (e) => {
    e.preventDefault();
    setProfileSaving(true);
    try {
      await api.updateBloodBank(bloodbankId, profileForm);
      addToast('Blood bank profile updated successfully', 'success');
      loadBankData();
    } catch (err) {
      addToast(err.message || 'Failed to update profile', 'error');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleMapPin = (latlng) => {
    setProfileForm((prev) => ({
      ...prev,
      latitude: Number(latlng.lat.toFixed(5)),
      longitude: Number(latlng.lng.toFixed(5)),
    }));
    addToast('Pinned GPS coordinates on map', 'info', 2000);
  };

  if (!bloodbankId) {
    return (
      <div className="page">
        <div className="card text-center" style={{ maxWidth: '500px', margin: '4rem auto' }}>
          <h3>Unlinked Blood Bank Account</h3>
          <p className="muted">This account is not linked to any blood bank facility. Please contact a platform administrator.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page page-loading-screen">
        <Spinner size="lg" />
        <p className="muted">Loading blood bank operations...</p>
      </div>
    );
  }

  // Find blood groups not yet represented in inventory
  const existingGroups = new Set(inventory.map((u) => u.blood_group));
  const missingGroups = ALL_BLOOD_GROUPS.filter((g) => !existingGroups.has(g));

  const tabsConfig = [
    { id: 'inventory', label: 'Blood Inventory', count: inventory.length },
    { id: 'reservations', label: 'Patient Reservations', count: reservations.filter(r => r.status === 'PENDING').length || undefined },
    { id: 'profile', label: 'Facility Profile' },
  ];

  return (
    <div className="page bloodbank-dashboard-page">
      <div className="dashboard-banner card">
        <div className="banner-greeting">
          <span className="badge badge-danger">Blood Bank Operations</span>
          <h2>{bankInfo?.name || 'Blood Bank Portal'}</h2>
          <p className="muted">
            {bankInfo?.address} · Helpline: {bankInfo?.phone || 'Not configured'}
          </p>
        </div>

        {missingGroups.length > 0 && (
          <div className="banner-quick-actions">
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setNewGroup(missingGroups[0]);
                setNewQty(10);
                setNewAvail(10);
                setAddGroupModalOpen(true);
              }}
            >
              + Add Missing Blood Group
            </Button>
          </div>
        )}
      </div>

      <div className="dashboard-tabs-container">
        <Tabs tabs={tabsConfig} activeTab={activeTab} onChange={setActiveTab} />
      </div>

      <div className="dashboard-tab-content">
        {/* Tab 1: Inventory Grid */}
        {activeTab === 'inventory' && (
          <div className="tab-pane inventory-tab">
            <div className="tab-header-row">
              <div>
                <h3>Blood Group Stock Inventory</h3>
                <p className="muted">
                  Manage inventory counts for all 8 blood groups. Low stock warning alerts below 5 units available.
                </p>
              </div>
            </div>

            <div className="blood-inventory-grid">
              {inventory.map((unit) => {
                const isLow = unit.available > 0 && unit.available < 5;
                const isOut = unit.available === 0;

                return (
                  <div key={unit.unit_id} className={`card inventory-item-card ${isLow ? 'low-stock-card' : ''}`}>
                    <div className="inv-card-header">
                      <div className="inv-group-circle">{unit.blood_group}</div>
                      <div>
                        {isOut && <span className="badge badge-danger">Depleted</span>}
                        {isLow && <span className="badge badge-warning">Low Stock</span>}
                        {!isOut && !isLow && <span className="badge badge-success">In Stock</span>}
                      </div>
                    </div>

                    <div className="inv-stats-box">
                      <div className="inv-stat">
                        <span className="inv-stat-label">Available:</span>
                        <strong className={`inv-stat-value ${isOut ? 'text-danger' : (isLow ? 'text-warning' : 'text-success')}`}>
                          {unit.available} units
                        </strong>
                      </div>
                      <div className="inv-stat">
                        <span className="inv-stat-label">Total Quantity:</span>
                        <span className="inv-stat-value">{unit.quantity} units</span>
                      </div>
                    </div>

                    <div className="inv-card-footer">
                      <Button variant="outline" size="sm" onClick={() => handleOpenEditUnit(unit)}>
                        Update Inventory
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 2: Reservations Queue */}
        {activeTab === 'reservations' && (
          <div className="tab-pane reservations-queue-tab">
            <div className="tab-header-row">
              <div>
                <h3>Patient Blood Reservations Queue</h3>
                <p className="muted">
                  Approving a reservation atomically decreases available stock. Fulfill completes the order. Auto-refreshes every 15s.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={loadBankData}>
                ↻ Refresh Queue
              </Button>
            </div>

            {reservations.length === 0 ? (
              <EmptyState
                title="No patient reservations"
                message="No reservations have been placed with this blood bank."
              />
            ) : (
              <div className="card table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Reservation ID</th>
                      <th>Patient Name & Phone</th>
                      <th>Blood Group</th>
                      <th>Units Requested</th>
                      <th>Placed At</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reservations.map((res) => (
                      <tr key={res.reservation_id}>
                        <td>#{res.reservation_id}</td>
                        <td>
                          <strong>{res.patient_name || 'Patient'}</strong>
                          {res.patient_phone && (
                            <div className="muted" style={{ fontSize: '0.8rem' }}>Tel: {res.patient_phone}</div>
                          )}
                        </td>
                        <td>
                          <span className="badge badge-danger">{res.blood_group}</span>
                        </td>
                        <td><strong>{res.units_requested}</strong> units</td>
                        <td>{new Date(res.created_at).toLocaleString()}</td>
                        <td><Badge status={res.status} size="sm" /></td>
                        <td>
                          <div className="action-buttons-cell">
                            {res.status === 'PENDING' && (
                              <>
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={() => handleReservationStatus(res.reservation_id, 'APPROVED')}
                                >
                                  Approve
                                </Button>
                                <Button
                                  variant="danger"
                                  size="sm"
                                  onClick={() => handleReservationStatus(res.reservation_id, 'REJECTED')}
                                >
                                  Reject
                                </Button>
                              </>
                            )}
                            {res.status === 'APPROVED' && (
                              <>
                                <Button
                                  variant="success"
                                  size="sm"
                                  onClick={() => handleReservationStatus(res.reservation_id, 'FULFILLED')}
                                >
                                  Fulfill Transfusion
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleReservationStatus(res.reservation_id, 'REJECTED')}
                                >
                                  Cancel / Restore
                                </Button>
                              </>
                            )}
                            {['FULFILLED', 'REJECTED', 'CANCELLED'].includes(res.status) && (
                              <span className="muted" style={{ fontSize: '0.85rem' }}>Completed</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Profile Editor */}
        {activeTab === 'profile' && (
          <div className="tab-pane profile-tab">
            <div className="card profile-edit-card">
              <h3>Blood Bank Facility Information</h3>
              <p className="muted">Update official facility contact numbers, physical address, and GPS coordinates.</p>

              <form onSubmit={handleProfileSave} style={{ marginTop: '1.5rem' }}>
                <div className="form-grid-2">
                  <FormField label="Blood Bank Name" id="bb-name" required>
                    <input
                      type="text"
                      id="bb-name"
                      className="form-input"
                      value={profileForm.name}
                      onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                      required
                    />
                  </FormField>

                  <FormField label="Helpline / Contact Phone" id="bb-phone">
                    <input
                      type="text"
                      id="bb-phone"
                      className="form-input"
                      value={profileForm.phone}
                      onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                    />
                  </FormField>
                </div>

                <FormField label="Street Address" id="bb-address" required>
                  <input
                    type="text"
                    id="bb-address"
                    className="form-input"
                    value={profileForm.address}
                    onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                    required
                  />
                </FormField>

                <div className="coords-picker-section" style={{ marginTop: '1.5rem' }}>
                  <label className="form-label">GPS Location (Click on map to pin coordinates):</label>
                  <div className="picked-coords-box" style={{ marginBottom: '0.75rem' }}>
                    <code>Latitude: {profileForm.latitude}, Longitude: {profileForm.longitude}</code>
                  </div>
                  <MapView
                    center={[profileForm.latitude, profileForm.longitude]}
                    zoom={13}
                    markers={[{
                      lat: profileForm.latitude,
                      lng: profileForm.longitude,
                      iconType: 'BLOODBANK',
                      popup: <strong>{profileForm.name}</strong>,
                    }]}
                    onMapClick={handleMapPin}
                    height="280px"
                  />
                </div>

                <div style={{ marginTop: '2rem' }}>
                  <Button variant="primary" type="submit" loading={profileSaving}>
                    Save Facility Profile
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* Edit Unit Modal */}
      {editingUnit && (
        <Modal
          isOpen={Boolean(editingUnit)}
          onClose={() => setEditingUnit(null)}
          title={`Update Inventory — Group ${editingUnit.blood_group}`}
        >
          <form onSubmit={handleSaveUnit}>
            <FormField
              label="Total Units Quantity"
              id="edit-unit-qty"
              required
            >
              <input
                type="number"
                id="edit-unit-qty"
                min="0"
                className="form-input"
                value={editQty}
                onChange={(e) => setEditQty(e.target.value)}
                required
              />
            </FormField>

            <FormField
              label="Available Units"
              id="edit-unit-avail"
              required
              hint="Must be less than or equal to total quantity"
            >
              <input
                type="number"
                id="edit-unit-avail"
                min="0"
                max={editQty}
                className="form-input"
                value={editAvail}
                onChange={(e) => setEditAvail(e.target.value)}
                required
              />
            </FormField>

            <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
              <Button variant="secondary" onClick={() => setEditingUnit(null)} disabled={unitSaving}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" loading={unitSaving}>
                Save Changes
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Add Missing Blood Group Modal */}
      <Modal
        isOpen={addGroupModalOpen}
        onClose={() => setAddGroupModalOpen(false)}
        title="Add Missing Blood Group to Inventory"
      >
        <form onSubmit={handleAddGroupSubmit}>
          <FormField label="Blood Group" id="add-bg-group" required>
            <select
              id="add-bg-group"
              className="form-input"
              value={newGroup}
              onChange={(e) => setNewGroup(e.target.value)}
            >
              {missingGroups.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </FormField>

          <FormField label="Total Units" id="add-bg-qty" required>
            <input
              type="number"
              id="add-bg-qty"
              min="0"
              className="form-input"
              value={newQty}
              onChange={(e) => setNewQty(e.target.value)}
              required
            />
          </FormField>

          <FormField label="Available Units" id="add-bg-avail" required>
            <input
              type="number"
              id="add-bg-avail"
              min="0"
              max={newQty}
              className="form-input"
              value={newAvail}
              onChange={(e) => setNewAvail(e.target.value)}
              required
            />
          </FormField>

          <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
            <Button variant="secondary" onClick={() => setAddGroupModalOpen(false)} disabled={addingGroup}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={addingGroup}>
              Add to Stock
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

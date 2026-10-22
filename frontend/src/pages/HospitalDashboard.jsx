import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { usePolling } from '../hooks/usePolling';
import { MapView } from '../components/MapView';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { Modal, ConfirmDialog } from '../components/Modal';
import { FormField } from '../components/FormField';
import { Tabs } from '../components/Tabs';
import { Spinner } from '../components/Spinner';
import { EmptyState } from '../components/EmptyState';

export default function HospitalDashboard() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const hospitalId = user?.hospital_id;

  const [activeTab, setActiveTab] = useState('resources');
  const [hospital, setHospital] = useState(null);
  const [admissions, setAdmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Doctor modal state
  const [doctorModalOpen, setDoctorModalOpen] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState(null);
  const [docName, setDocName] = useState('');
  const [docSpec, setDocSpec] = useState('');
  const [docQual, setDocQual] = useState('');
  const [docAvail, setDocAvail] = useState(true);
  const [doctorSubmitting, setDoctorSubmitting] = useState(false);
  const [deleteDoctorTarget, setDeleteDoctorTarget] = useState(null);

  // Waiting time modal state
  const [wtModalOpen, setWtModalOpen] = useState(false);
  const [wtDept, setWtDept] = useState('');
  const [wtMinutes, setWtMinutes] = useState(30);
  const [wtSubmitting, setWtSubmitting] = useState(false);

  // Profile edit state
  const [profileForm, setProfileForm] = useState({
    name: '',
    address: '',
    latitude: 28.6139,
    longitude: 77.2090,
    specialties: '',
    insurance_info: '',
    phone: '',
    email: '',
    description: '',
  });
  const [profileSaving, setProfileSaving] = useState(false);

  // Load hospital & admission queue
  const loadHospitalData = useCallback(async () => {
    if (!hospitalId) return;
    try {
      const [hospData, admData] = await Promise.all([
        api.getHospital(hospitalId),
        api.myAdmissions(),
      ]);
      setHospital(hospData);
      setAdmissions(admData || []);

      if (hospData) {
        setProfileForm({
          name: hospData.name || '',
          address: hospData.address || '',
          latitude: hospData.latitude || 28.6139,
          longitude: hospData.longitude || 77.2090,
          specialties: hospData.specialties || '',
          insurance_info: hospData.insurance_info || '',
          phone: hospData.phone || '',
          email: hospData.email || '',
          description: hospData.description || '',
        });
      }
    } catch (err) {
      console.error('Failed to load hospital operations:', err);
    } finally {
      setLoading(false);
    }
  }, [hospitalId]);

  useEffect(() => {
    loadHospitalData();
  }, [loadHospitalData]);

  // Auto-refresh admissions queue every 15 seconds
  usePolling(loadHospitalData, 15000, Boolean(hospitalId));

  // Resource count adjustment (+/- stepper)
  const handleUpdateResource = async (res, deltaAvail) => {
    const newAvail = Math.max(0, Math.min(res.total, res.available + deltaAvail));
    if (newAvail === res.available) return;

    try {
      await api.updateResource(hospitalId, res.resource_id, {
        total: res.total,
        available: newAvail,
      });
      addToast(`Updated ${res.type} available to ${newAvail}`, 'success', 2000);
      loadHospitalData();
    } catch (err) {
      addToast(err.message || 'Failed to update resource', 'error');
    }
  };

  const handleTotalResourceChange = async (res, newTotal) => {
    const totalNum = Math.max(0, Number(newTotal) || 0);
    const newAvail = Math.min(totalNum, res.available);

    try {
      await api.updateResource(hospitalId, res.resource_id, {
        total: totalNum,
        available: newAvail,
      });
      addToast(`Updated ${res.type} total capacity to ${totalNum}`, 'success');
      loadHospitalData();
    } catch (err) {
      addToast(err.message || 'Failed to update resource', 'error');
    }
  };

  // Admission actions (Accept, Reject, Complete)
  const handleAdmissionStatus = async (admissionId, status) => {
    try {
      await api.updateAdmissionStatus(admissionId, status);
      addToast(`Admission status updated to ${status}`, 'success');
      loadHospitalData();
    } catch (err) {
      addToast(err.message || 'Failed to process admission', 'error');
    }
  };

  // Doctor CRUD
  const handleOpenAddDoctor = () => {
    setEditingDoctor(null);
    setDocName('');
    setDocSpec('');
    setDocQual('MBBS, MD');
    setDocAvail(true);
    setDoctorModalOpen(true);
  };

  const handleOpenEditDoctor = (doc) => {
    setEditingDoctor(doc);
    setDocName(doc.name);
    setDocSpec(doc.specialization || '');
    setDocQual(doc.qualification || '');
    setDocAvail(Boolean(doc.available));
    setDoctorModalOpen(true);
  };

  const handleDoctorSubmit = async (e) => {
    e.preventDefault();
    if (!docName.trim()) return;

    setDoctorSubmitting(true);
    try {
      if (editingDoctor) {
        await api.updateDoctor(hospitalId, editingDoctor.doctor_id, {
          name: docName.trim(),
          specialization: docSpec.trim() || undefined,
          qualification: docQual.trim() || undefined,
          available: docAvail,
        });
        addToast('Doctor details updated', 'success');
      } else {
        await api.addDoctor(hospitalId, {
          name: docName.trim(),
          specialization: docSpec.trim() || undefined,
          qualification: docQual.trim() || undefined,
          available: docAvail,
        });
        addToast('Doctor added to hospital roster', 'success');
      }
      setDoctorModalOpen(false);
      loadHospitalData();
    } catch (err) {
      addToast(err.message || 'Failed to save doctor', 'error');
    } finally {
      setDoctorSubmitting(false);
    }
  };

  const handleDeleteDoctor = async () => {
    if (!deleteDoctorTarget) return;
    try {
      await api.deleteDoctor(hospitalId, deleteDoctorTarget.doctor_id);
      addToast('Doctor removed from hospital roster', 'success');
      setDeleteDoctorTarget(null);
      loadHospitalData();
    } catch (err) {
      addToast(err.message || 'Failed to delete doctor', 'error');
    }
  };

  // Waiting Time update
  const handleWaitingSubmit = async (e) => {
    e.preventDefault();
    if (!wtDept.trim()) return;

    setWtSubmitting(true);
    try {
      await api.updateWaitingTime(hospitalId, {
        department: wtDept.trim(),
        minutes: Number(wtMinutes),
      });
      addToast('Waiting time updated', 'success');
      setWtModalOpen(false);
      loadHospitalData();
    } catch (err) {
      addToast(err.message || 'Failed to update waiting time', 'error');
    } finally {
      setWtSubmitting(false);
    }
  };

  // Profile save
  const handleProfileSave = async (e) => {
    e.preventDefault();
    setProfileSaving(true);
    try {
      await api.updateHospitalProfile(hospitalId, profileForm);
      addToast('Hospital profile updated successfully', 'success');
      loadHospitalData();
    } catch (err) {
      addToast(err.message || 'Failed to save profile', 'error');
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
    addToast('Pinned new GPS coordinates on map', 'info', 2000);
  };

  if (!hospitalId) {
    return (
      <div className="page">
        <div className="card text-center" style={{ maxWidth: '500px', margin: '4rem auto' }}>
          <h3>Unlinked Hospital Account</h3>
          <p className="muted">This user account is not linked to any hospital facility ID. Please contact a platform administrator.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page page-loading-screen">
        <Spinner size="lg" />
        <p className="muted">Loading hospital operations console...</p>
      </div>
    );
  }

  const tabsConfig = [
    { id: 'resources', label: 'Beds & Life Support', icon: '🛏️' },
    { id: 'admissions', label: 'Admissions Queue', icon: '🚨', count: admissions.filter(a => a.status === 'PENDING').length || undefined },
    { id: 'doctors', label: 'Doctors Roster', icon: '🧑‍⚕️', count: hospital?.doctors?.length },
    { id: 'waiting-time', label: 'Department Wait Times', icon: '⏱️' },
    { id: 'profile', label: 'Facility Profile', icon: '⚙️' },
  ];

  return (
    <div className="page hospital-dashboard-page">
      <div className="dashboard-banner card">
        <div className="banner-greeting">
          <span className="badge badge-teal">Hospital Operations Console</span>
          <h2>{hospital?.name || 'Hospital Command'}</h2>
          <p className="muted">
            {hospital?.address} · Emergency Duty Desk: {hospital?.phone || 'Not configured'}
          </p>
        </div>
      </div>

      <div className="dashboard-tabs-container">
        <Tabs tabs={tabsConfig} activeTab={activeTab} onChange={setActiveTab} />
      </div>

      <div className="dashboard-tab-content">
        {/* Tab 1: Resources Management */}
        {activeTab === 'resources' && (
          <div className="tab-pane resources-tab">
            <div className="tab-header-row">
              <div>
                <h3>Hospital Resource Inventory</h3>
                <p className="muted">
                  Update active available beds, ICU units, and ventilators in real time. Available counts cannot exceed total capacity.
                </p>
              </div>
            </div>

            <div className="resource-cards-grid">
              {hospital?.resources?.map((res) => {
                const pct = res.total > 0 ? Math.round((res.available / res.total) * 100) : 0;

                return (
                  <div key={res.resource_id} className="card resource-manage-card">
                    <div className="res-card-top">
                      <span className="res-type-pill">{res.type} Units</span>
                      <span className="res-status-text">
                        {res.available} Available / {res.total} Total
                      </span>
                    </div>

                    <div className="progress-bar-track">
                      <div
                        className={`progress-bar-fill ${pct < 20 ? 'fill-danger' : (pct < 50 ? 'fill-warning' : 'fill-success')}`}
                        style={{ width: `${Math.min(100, Math.max(4, pct))}%` }}
                      />
                    </div>

                    <div className="stepper-controls-row">
                      <span className="stepper-label">Quick Adjust Available:</span>
                      <div className="stepper-buttons">
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={res.available <= 0}
                          onClick={() => handleUpdateResource(res, -1)}
                        >
                          -1
                        </Button>
                        <span className="stepper-current-val">{res.available}</span>
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={res.available >= res.total}
                          onClick={() => handleUpdateResource(res, 1)}
                        >
                          +1
                        </Button>
                      </div>
                    </div>

                    <div className="capacity-edit-row">
                      <label htmlFor={`total-${res.resource_id}`}>Edit Total Capacity:</label>
                      <input
                        type="number"
                        id={`total-${res.resource_id}`}
                        min="0"
                        className="form-input input-narrow"
                        defaultValue={res.total}
                        onBlur={(e) => handleTotalResourceChange(res, e.target.value)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 2: Admissions Queue */}
        {activeTab === 'admissions' && (
          <div className="tab-pane admissions-queue-tab">
            <div className="tab-header-row">
              <div>
                <h3>Incoming Emergency Admissions Queue</h3>
                <p className="muted">
                  Sorted automatically with <strong>CRITICAL</strong> cases at the top, followed by queue arrival time. Auto-refreshes every 15s.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={loadHospitalData}>
                ↻ Refresh Queue
              </Button>
            </div>

            {admissions.length === 0 ? (
              <EmptyState
                title="Admissions queue is empty"
                message="No emergency admission requests currently pending for this hospital."
              />
            ) : (
              <div className="queue-table-wrap card">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Queue Priority</th>
                      <th>Patient Name & Contact</th>
                      <th>Condition / Clinical Reason</th>
                      <th>Department</th>
                      <th>Received At</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {admissions.map((adm) => (
                      <tr key={adm.admission_id} className={adm.severity === 'CRITICAL' ? 'critical-row' : ''}>
                        <td>
                          <Badge status={adm.severity} label={adm.severity} size="sm" />
                        </td>
                        <td>
                          <strong>{adm.patient_name || 'Patient'}</strong>
                          {adm.patient_phone && (
                            <div className="muted" style={{ fontSize: '0.8rem' }}>📞 {adm.patient_phone}</div>
                          )}
                        </td>
                        <td>
                          <span className="reason-text">{adm.reason || 'General emergency'}</span>
                        </td>
                        <td>{adm.preferred_department || 'General ER'}</td>
                        <td>{new Date(adm.created_at).toLocaleTimeString()}</td>
                        <td>
                          <Badge status={adm.status} size="sm" />
                        </td>
                        <td>
                          <div className="action-buttons-cell">
                            {adm.status === 'PENDING' && (
                              <>
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={() => handleAdmissionStatus(adm.admission_id, 'ACCEPTED')}
                                >
                                  Accept (Hold Bed)
                                </Button>
                                <Button
                                  variant="danger"
                                  size="sm"
                                  onClick={() => handleAdmissionStatus(adm.admission_id, 'REJECTED')}
                                >
                                  Reject
                                </Button>
                              </>
                            )}
                            {adm.status === 'ACCEPTED' && (
                              <Button
                                variant="success"
                                size="sm"
                                onClick={() => handleAdmissionStatus(adm.admission_id, 'COMPLETED')}
                              >
                                Check In & Complete
                              </Button>
                            )}
                            {['REJECTED', 'COMPLETED', 'CANCELLED'].includes(adm.status) && (
                              <span className="muted" style={{ fontSize: '0.85rem' }}>Closed</span>
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

        {/* Tab 3: Doctors Roster */}
        {activeTab === 'doctors' && (
          <div className="tab-pane doctors-tab">
            <div className="tab-header-row">
              <div>
                <h3>Physicians & Specialists Roster</h3>
                <p className="muted">Manage doctor profiles, qualifications, and duty availability.</p>
              </div>
              <Button variant="primary" size="sm" onClick={handleOpenAddDoctor}>
                + Add Doctor
              </Button>
            </div>

            <div className="card">
              <table className="table">
                <thead>
                  <tr>
                    <th>Doctor Name</th>
                    <th>Specialization</th>
                    <th>Qualifications</th>
                    <th>Duty Availability</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {hospital?.doctors?.map((doc) => (
                    <tr key={doc.doctor_id}>
                      <td><strong>{doc.name}</strong></td>
                      <td>{doc.specialization || 'General Emergency'}</td>
                      <td className="muted">{doc.qualification || 'MBBS'}</td>
                      <td>
                        <Badge
                          status={doc.available ? 'AVAILABLE' : 'OFFLINE'}
                          label={doc.available ? 'On Duty' : 'Off Duty'}
                          size="sm"
                        />
                      </td>
                      <td>
                        <div className="action-buttons-cell">
                          <Button variant="outline" size="sm" onClick={() => handleOpenEditDoctor(doc)}>
                            Edit
                          </Button>
                          <Button variant="danger" size="sm" onClick={() => setDeleteDoctorTarget(doc)}>
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 4: Waiting Time Editor */}
        {activeTab === 'waiting-time' && (
          <div className="tab-pane waiting-times-tab">
            <div className="tab-header-row">
              <div>
                <h3>Department Waiting Time Configuration</h3>
                <p className="muted">
                  Report baseline minutes for each clinical department. The platform computes live dynamic estimates based on occupancy and triage queue.
                </p>
              </div>
              <Button variant="primary" size="sm" onClick={() => { setWtDept(''); setWtMinutes(30); setWtModalOpen(true); }}>
                + Add / Update Department
              </Button>
            </div>

            <div className="card">
              <table className="table">
                <thead>
                  <tr>
                    <th>Department</th>
                    <th>Reported Baseline</th>
                    <th>Computed Dynamic Estimate</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {hospital?.waiting_times?.map((wt) => (
                    <tr key={wt.estimate_id}>
                      <td><strong>{wt.department}</strong></td>
                      <td>{wt.reported_minutes} minutes</td>
                      <td>
                        <span className="estimated-wait-badge">⏱️ {wt.estimated_minutes} minutes</span>
                      </td>
                      <td>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setWtDept(wt.department);
                            setWtMinutes(wt.reported_minutes);
                            setWtModalOpen(true);
                          }}
                        >
                          Update Time
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 5: Profile Editor */}
        {activeTab === 'profile' && (
          <div className="tab-pane profile-tab">
            <div className="card profile-edit-card">
              <h3>Facility Profile & Contact Information</h3>
              <p className="muted">Update address, emergency phone, insurance networks, and GPS coordinates.</p>

              <form onSubmit={handleProfileSave} style={{ marginTop: '1.5rem' }}>
                <div className="form-grid-2">
                  <FormField label="Hospital Name" id="prof-name" required>
                    <input
                      type="text"
                      id="prof-name"
                      className="form-input"
                      value={profileForm.name}
                      onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                      required
                    />
                  </FormField>

                  <FormField label="Emergency Desk Phone" id="prof-phone">
                    <input
                      type="text"
                      id="prof-phone"
                      className="form-input"
                      value={profileForm.phone}
                      onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                    />
                  </FormField>

                  <FormField label="Official Contact Email" id="prof-email">
                    <input
                      type="email"
                      id="prof-email"
                      className="form-input"
                      value={profileForm.email}
                      onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                    />
                  </FormField>

                  <FormField label="Street Address" id="prof-address" required>
                    <input
                      type="text"
                      id="prof-address"
                      className="form-input"
                      value={profileForm.address}
                      onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                      required
                    />
                  </FormField>
                </div>

                <FormField label="Specialties (Comma Separated)" id="prof-specs">
                  <input
                    type="text"
                    id="prof-specs"
                    className="form-input"
                    value={profileForm.specialties}
                    onChange={(e) => setProfileForm({ ...profileForm, specialties: e.target.value })}
                  />
                </FormField>

                <FormField label="Accepted Insurances / TPAs (Comma Separated)" id="prof-ins">
                  <input
                    type="text"
                    id="prof-ins"
                    className="form-input"
                    value={profileForm.insurance_info}
                    onChange={(e) => setProfileForm({ ...profileForm, insurance_info: e.target.value })}
                  />
                </FormField>

                <FormField label="Facility Description" id="prof-desc">
                  <textarea
                    id="prof-desc"
                    className="form-input"
                    rows={3}
                    value={profileForm.description}
                    onChange={(e) => setProfileForm({ ...profileForm, description: e.target.value })}
                  />
                </FormField>

                {/* Map Coordinate Picker */}
                <div className="coords-picker-section" style={{ marginTop: '1.5rem' }}>
                  <label className="form-label">Hospital GPS Location (Click on map to pin coordinates):</label>
                  <div className="picked-coords-box" style={{ marginBottom: '0.75rem' }}>
                    <code>Latitude: {profileForm.latitude}, Longitude: {profileForm.longitude}</code>
                  </div>
                  <MapView
                    center={[profileForm.latitude, profileForm.longitude]}
                    zoom={13}
                    markers={[{
                      lat: profileForm.latitude,
                      lng: profileForm.longitude,
                      iconType: 'HOSPITAL',
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

      {/* Doctor Modal */}
      <Modal
        isOpen={doctorModalOpen}
        onClose={() => setDoctorModalOpen(false)}
        title={editingDoctor ? 'Edit Doctor Profile' : 'Add Doctor to Roster'}
      >
        <form onSubmit={handleDoctorSubmit}>
          <FormField label="Doctor Full Name" id="doc-name" required>
            <input
              type="text"
              id="doc-name"
              className="form-input"
              placeholder="e.g. Dr. Priya Nair"
              value={docName}
              onChange={(e) => setDocName(e.target.value)}
              required
            />
          </FormField>

          <FormField label="Specialization" id="doc-spec" required>
            <input
              type="text"
              id="doc-spec"
              className="form-input"
              placeholder="e.g. Cardiology, Trauma Surgery"
              value={docSpec}
              onChange={(e) => setDocSpec(e.target.value)}
              required
            />
          </FormField>

          <FormField label="Medical Qualifications" id="doc-qual">
            <input
              type="text"
              id="doc-qual"
              className="form-input"
              placeholder="e.g. MBBS, MD, DM, FRCS"
              value={docQual}
              onChange={(e) => setDocQual(e.target.value)}
            />
          </FormField>

          <div style={{ marginTop: '1rem' }}>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={docAvail}
                onChange={(e) => setDocAvail(e.target.checked)}
              />
              <span>Currently On Duty / Available for Consultations</span>
            </label>
          </div>

          <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
            <Button variant="secondary" onClick={() => setDoctorModalOpen(false)} disabled={doctorSubmitting}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={doctorSubmitting}>
              {editingDoctor ? 'Save Changes' : 'Add Doctor'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Doctor Confirm */}
      <ConfirmDialog
        isOpen={Boolean(deleteDoctorTarget)}
        onClose={() => setDeleteDoctorTarget(null)}
        onConfirm={handleDeleteDoctor}
        title="Remove Doctor"
        message={`Are you sure you want to remove ${deleteDoctorTarget?.name} from the active roster?`}
        confirmText="Remove Doctor"
      />

      {/* Waiting Time Modal */}
      <Modal
        isOpen={wtModalOpen}
        onClose={() => setWtModalOpen(false)}
        title="Update Department Waiting Time"
      >
        <form onSubmit={handleWaitingSubmit}>
          <FormField label="Department Name" id="wt-dept" required>
            <input
              type="text"
              id="wt-dept"
              className="form-input"
              placeholder="e.g. Emergency, Cardiology, Orthopedics"
              value={wtDept}
              onChange={(e) => setWtDept(e.target.value)}
              required
            />
          </FormField>

          <FormField label="Reported Baseline Wait (Minutes)" id="wt-min" required>
            <input
              type="number"
              id="wt-min"
              min="0"
              className="form-input"
              value={wtMinutes}
              onChange={(e) => setWtMinutes(e.target.value)}
              required
            />
          </FormField>

          <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
            <Button variant="secondary" onClick={() => setWtModalOpen(false)} disabled={wtSubmitting}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={wtSubmitting}>
              Save Waiting Time
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

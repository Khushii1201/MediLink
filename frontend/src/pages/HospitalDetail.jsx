import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { MapView } from '../components/MapView';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { Modal } from '../components/Modal';
import { FormField } from '../components/FormField';
import { Spinner } from '../components/Spinner';

export default function HospitalDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useToast();

  const [hospital, setHospital] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Admission request modal state
  const [admissionModalOpen, setAdmissionModalOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [severity, setSeverity] = useState('MEDIUM');
  const [preferredDept, setPreferredDept] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;
    api.getHospital(id)
      .then((data) => {
        if (isMounted) setHospital(data);
      })
      .catch((err) => {
        if (isMounted) setError(err.message || 'Hospital not found');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [id]);

  const handleAdmissionClick = () => {
    if (!user) {
      const returnUrl = encodeURIComponent(window.location.pathname);
      navigate(`/login?redirect=${returnUrl}`);
      return;
    }
    if (user.role !== 'PATIENT') {
      addToast('Only registered patient accounts can submit emergency admission requests.', 'warning');
      return;
    }
    setAdmissionModalOpen(true);
  };

  const handleAdmissionSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      addToast('Please describe the medical condition or reason for admission.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await api.requestAdmission({
        hospital_id: Number(id),
        reason: reason.trim(),
        severity,
        preferred_department: preferredDept || null,
      });
      addToast('Emergency admission request submitted successfully!', 'success');
      setAdmissionModalOpen(false);
      setReason('');
      navigate('/patient');
    } catch (err) {
      addToast(err.message || 'Failed to submit admission request', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="page page-loading-screen">
        <Spinner size="lg" />
        <p className="muted">Loading facility profile...</p>
      </div>
    );
  }

  if (error || !hospital) {
    return (
      <div className="page">
        <div className="card text-center" style={{ maxWidth: '500px', margin: '4rem auto' }}>
          <h3>Facility Not Found</h3>
          <p className="muted">{error || 'Could not retrieve information for this hospital.'}</p>
          <Button variant="primary" onClick={() => navigate('/hospitals')} style={{ marginTop: '1rem' }}>
            Back to Directory
          </Button>
        </div>
      </div>
    );
  }

  const mapMarker = hospital.latitude && hospital.longitude ? [{
    id: hospital.hospital_id,
    lat: hospital.latitude,
    lng: hospital.longitude,
    iconType: 'HOSPITAL',
    popup: <strong>{hospital.name}</strong>,
  }] : [];

  return (
    <div className="page hospital-detail-page">
      {/* Header Bar */}
      <div className="detail-hero-card card">
        <div className="detail-hero-content">
          <div className="hero-meta-badge">
            <span className="badge badge-success">Verified Facility</span>
            <span>24/7 Emergency Care</span>
          </div>
          <h1 className="detail-hospital-title">{hospital.name}</h1>
          <p className="detail-hospital-address">{hospital.address}</p>
          {hospital.description && (
            <p className="detail-hospital-desc">{hospital.description}</p>
          )}

          <div className="detail-contact-tags">
            {hospital.phone && (
              <span className="contact-tag">
                Emergency Desk: <strong>{hospital.phone}</strong>
              </span>
            )}
            {hospital.email && (
              <span className="contact-tag">
                Email: <strong>{hospital.email}</strong>
              </span>
            )}
          </div>
        </div>

        <div className="detail-hero-action">
          <Button variant="danger" size="lg" onClick={handleAdmissionClick}>
            <span>Request Emergency Admission</span>
          </Button>
          <p className="muted" style={{ fontSize: '0.8rem', marginTop: '0.5rem', textAlign: 'center' }}>
            Direct triage queue submission
          </p>
        </div>
      </div>

      <div className="detail-grid-layout">
        {/* Left Column: Resources, Doctors, Waiting Times */}
        <div className="detail-left-col">
          {/* Resources Card */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div className="card-header">
              <div>
                <h3 className="card-title">Live Resource Capacity</h3>
                <p className="card-subtitle">Verified in-hospital beds and life support units</p>
              </div>
            </div>
            <div className="resource-bars-container">
              {hospital.resources && hospital.resources.length > 0 ? (
                hospital.resources.map((res) => {
                  const pct = res.total > 0 ? Math.round((res.available / res.total) * 100) : 0;
                  return (
                    <div key={res.resource_id} className="resource-bar-row">
                      <div className="res-row-meta">
                        <span className="res-type-badge">{res.type} Units</span>
                        <span className="res-counts">
                          <strong>{res.available}</strong> available of {res.total} total
                        </span>
                      </div>
                      <div className="progress-bar-track large-track">
                        <div
                          className={`progress-bar-fill ${pct < 20 ? 'fill-danger' : (pct < 50 ? 'fill-warning' : 'fill-success')}`}
                          style={{ width: `${Math.min(100, Math.max(4, pct))}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="muted">No resource records found for this facility.</p>
              )}
            </div>
          </div>

          {/* Waiting Times Card */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div className="card-header">
              <div>
                <h3 className="card-title">Department Waiting Time Estimates</h3>
                <p className="card-subtitle">Calculated using staff-reported baseline, active occupancy, and admission queues</p>
              </div>
            </div>
            {hospital.waiting_times && hospital.waiting_times.length > 0 ? (
              <div className="waiting-times-table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Department</th>
                      <th>Reported Baseline</th>
                      <th>Dynamic Estimate</th>
                      <th>Occupancy Adjustment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hospital.waiting_times.map((wt) => (
                      <tr key={wt.estimate_id}>
                        <td><strong>{wt.department}</strong></td>
                        <td>{wt.reported_minutes} min</td>
                        <td>
                          <span className="estimated-wait-badge">
                            {wt.estimated_minutes} min
                          </span>
                        </td>
                        <td className="muted" style={{ fontSize: '0.85rem' }}>
                          +{Math.round((wt.factors?.occupancy_factor || 0) * 100)}% load factor
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="estimate-disclaimer">
                  <em>Note: Waiting-time values are operational estimates provided for coordination and transparency; not a clinical or triage prioritization guarantee.</em>
                </p>
              </div>
            ) : (
              <p className="muted">No department waiting times logged yet.</p>
            )}
          </div>

          {/* Doctors On Duty */}
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">Specialist Doctors & Medical Officers</h3>
                <p className="card-subtitle">Assigned consultants and duty physicians</p>
              </div>
            </div>
            {hospital.doctors && hospital.doctors.length > 0 ? (
              <div className="doctors-table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Doctor Name</th>
                      <th>Specialization</th>
                      <th>Qualification</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hospital.doctors.map((doc) => (
                      <tr key={doc.doctor_id}>
                        <td><strong>{doc.name}</strong></td>
                        <td>{doc.specialization || 'General Practitioner'}</td>
                        <td className="muted">{doc.qualification || 'MBBS'}</td>
                        <td>
                          <Badge
                            status={doc.available ? 'AVAILABLE' : 'OFFLINE'}
                            label={doc.available ? 'On Duty' : 'Off Duty'}
                            size="sm"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted">No doctors currently listed for this hospital.</p>
            )}
          </div>
        </div>

        {/* Right Column: Facility Map & Insurance Info */}
        <div className="detail-right-col">
          {/* Map Card */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h4 style={{ marginBottom: '0.75rem' }}>Location & Access</h4>
            <MapView
              center={[hospital.latitude || 26.9124, hospital.longitude || 75.7873]}
              zoom={13}
              markers={mapMarker}
              height="280px"
            />
            <p className="muted" style={{ fontSize: '0.85rem', marginTop: '0.75rem' }}>
              GPS: {hospital.latitude}, {hospital.longitude}
            </p>
          </div>

          {/* Insurance Coverage */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h4 style={{ marginBottom: '0.75rem' }}>Insurance Networks</h4>
            {hospital.insurance_info ? (
              <div className="insurance-tags-wrap">
                {hospital.insurance_info.split(',').map((ins) => (
                  <span key={ins} className="badge badge-info">{ins.trim()}</span>
                ))}
              </div>
            ) : (
              <p className="muted">General billing / Cashless TPA supported upon admission inquiry.</p>
            )}
          </div>

          {/* Specialties */}
          <div className="card">
            <h4 style={{ marginBottom: '0.75rem' }}>Key Medical Specialties</h4>
            {hospital.specialties ? (
              <div className="specialty-pills-wrap">
                {hospital.specialties.split(',').map((spec) => (
                  <span key={spec} className="specialty-chip">{spec.trim()}</span>
                ))}
              </div>
            ) : (
              <p className="muted">Multi-specialty emergency & critical care hospital.</p>
            )}
          </div>
        </div>
      </div>

      {/* Emergency Admission Request Modal */}
      <Modal
        isOpen={admissionModalOpen}
        onClose={() => setAdmissionModalOpen(false)}
        title={`Request Emergency Admission — ${hospital.name}`}
      >
        <form onSubmit={handleAdmissionSubmit}>
          <FormField
            label="Severity Level"
            id="admission-severity"
            required
            hint="CRITICAL requests receive immediate triage queue priority"
          >
            <select
              id="admission-severity"
              className="form-input"
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
            >
              <option value="CRITICAL">CRITICAL — Immediate Life Threat (Trauma, Cardiac, Stroke)</option>
              <option value="MEDIUM">MEDIUM — Urgent Admission Required</option>
              <option value="LOW">LOW — Stable / Scheduled Emergency Check</option>
            </select>
          </FormField>

          <FormField
            label="Preferred Department (Optional)"
            id="admission-dept"
          >
            <input
              type="text"
              id="admission-dept"
              className="form-input"
              placeholder="e.g. Emergency, Cardiology, Trauma, ICU"
              value={preferredDept}
              onChange={(e) => setPreferredDept(e.target.value)}
            />
          </FormField>

          <FormField
            label="Reason for Admission / Clinical Condition"
            id="admission-reason"
            required
            hint="Describe the patient's symptoms, vital condition, and injury details"
          >
            <textarea
              id="admission-reason"
              className="form-input"
              rows={4}
              placeholder="e.g. Acute chest discomfort, severe dyspnea, suspected myocardial infarction..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
          </FormField>

          <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
            <Button variant="secondary" onClick={() => setAdmissionModalOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="danger" type="submit" loading={submitting}>
              Submit Emergency Request
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

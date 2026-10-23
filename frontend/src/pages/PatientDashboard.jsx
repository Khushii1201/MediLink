import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { useGeolocation } from '../hooks/useGeolocation';
import { Tabs } from '../components/Tabs';
import { Modal } from '../components/Modal';
import { FormField } from '../components/FormField';
import { Button } from '../components/Button';

import FindCareTab from './patient/FindCareTab';
import AdmissionsTab from './patient/AdmissionsTab';
import AmbulanceTab from './patient/AmbulanceTab';
import BloodTab from './patient/BloodTab';

export default function PatientDashboard() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const { coords } = useGeolocation(true);

  const [activeTab, setActiveTab] = useState('find-care');
  const [admissions, setAdmissions] = useState([]);
  const [ambulanceRequests, setAmbulanceRequests] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [hospitalsList, setHospitalsList] = useState([]);

  // Admission request modal state
  const [admissionModalOpen, setAdmissionModalOpen] = useState(false);
  const [targetHospital, setTargetHospital] = useState(null);
  const [reason, setReason] = useState('');
  const [severity, setSeverity] = useState('MEDIUM');
  const [preferredDept, setPreferredDept] = useState('');
  const [submittingAdmission, setSubmittingAdmission] = useState(false);

  const loadPatientData = useCallback(async () => {
    try {
      const [admData, ambData, resData, hospData] = await Promise.all([
        api.myAdmissions().catch(() => []),
        api.myAmbulanceRequests().catch(() => []),
        api.myReservations().catch(() => []),
        api.searchHospitals().catch(() => []),
      ]);
      setAdmissions(admData || []);
      setAmbulanceRequests(ambData || []);
      setReservations(resData || []);
      setHospitalsList(hospData || []);
    } catch (err) {
      console.error('Failed to load patient data:', err);
    }
  }, []);

  useEffect(() => {
    loadPatientData();
  }, [loadPatientData]);

  const handleOpenNewAdmission = (prefillHospital = null) => {
    if (prefillHospital) {
      setTargetHospital(prefillHospital);
    } else if (hospitalsList.length > 0) {
      setTargetHospital(hospitalsList[0]);
    }
    setReason('');
    setSeverity('MEDIUM');
    setPreferredDept('');
    setAdmissionModalOpen(true);
  };

  const handleAdmissionSubmit = async (e) => {
    e.preventDefault();
    if (!targetHospital?.hospital_id) {
      addToast('Please select a hospital', 'error');
      return;
    }
    if (!reason.trim()) {
      addToast('Please describe the admission reason', 'error');
      return;
    }

    setSubmittingAdmission(true);
    try {
      await api.requestAdmission({
        hospital_id: targetHospital.hospital_id,
        reason: reason.trim(),
        severity,
        preferred_department: preferredDept.trim() || undefined,
      });
      addToast('Emergency admission request submitted to hospital queue!', 'success');
      setAdmissionModalOpen(false);
      loadPatientData();
      setActiveTab('admissions');
    } catch (err) {
      addToast(err.message || 'Failed to submit admission request', 'error');
    } finally {
      setSubmittingAdmission(false);
    }
  };

  const tabsConfig = [
    { id: 'find-care', label: 'Find Care & Recommendations' },
    { id: 'admissions', label: 'My Admissions', count: admissions.length },
    { id: 'ambulance', label: 'Emergency Ambulance', count: ambulanceRequests.filter(r => ['REQUESTED', 'ACCEPTED', 'EN_ROUTE'].includes(r.status)).length || undefined },
    { id: 'blood', label: 'Blood Units & Reservations', count: reservations.length },
  ];

  return (
    <div className="page patient-dashboard-page">
      <div className="dashboard-banner card">
        <div className="banner-greeting">
          <span className="badge badge-success">Patient Portal</span>
          <h2>Welcome, {user?.name || 'Patient'}</h2>
          <p className="muted">
            Coordinate healthcare resources across Jaipur and surrounding regions. Pinpoint available beds, track ambulances, and reserve blood.
          </p>
        </div>
        <div className="banner-quick-actions">
          <Button variant="danger" size="md" onClick={() => setActiveTab('ambulance')}>
            <span>Dispatch Ambulance</span>
          </Button>
          <Button variant="outline" size="md" onClick={() => handleOpenNewAdmission()}>
            <span>+ Request Admission</span>
          </Button>
        </div>
      </div>

      <div className="dashboard-tabs-container">
        <Tabs tabs={tabsConfig} activeTab={activeTab} onChange={setActiveTab} />
      </div>

      <div className="dashboard-tab-content">
        {activeTab === 'find-care' && (
          <FindCareTab
            coords={coords}
            onRequestAdmission={handleOpenNewAdmission}
          />
        )}

        {activeTab === 'admissions' && (
          <AdmissionsTab
            admissions={admissions}
            onRefresh={loadPatientData}
            onOpenNewRequest={() => handleOpenNewAdmission()}
          />
        )}

        {activeTab === 'ambulance' && (
          <AmbulanceTab
            coords={coords}
            requests={ambulanceRequests}
            onRefresh={loadPatientData}
          />
        )}

        {activeTab === 'blood' && (
          <BloodTab
            coords={coords}
            reservations={reservations}
            onRefresh={loadPatientData}
          />
        )}
      </div>

      {/* Emergency Admission Request Modal */}
      <Modal
        isOpen={admissionModalOpen}
        onClose={() => setAdmissionModalOpen(false)}
        title="Submit Emergency Admission Request"
      >
        <form onSubmit={handleAdmissionSubmit}>
          <FormField label="Target Hospital" id="adm-hosp" required>
            <select
              id="adm-hosp"
              className="form-input"
              value={targetHospital?.hospital_id || ''}
              onChange={(e) => {
                const h = hospitalsList.find((x) => x.hospital_id === Number(e.target.value));
                setTargetHospital(h || null);
              }}
              required
            >
              {hospitalsList.map((h) => (
                <option key={h.hospital_id} value={h.hospital_id}>
                  {h.name} — {h.address}
                </option>
              ))}
            </select>
          </FormField>

          <FormField
            label="Triage Severity Level"
            id="adm-severity"
            required
            hint="CRITICAL requests receive immediate priority at the top of the hospital queue"
          >
            <select
              id="adm-severity"
              className="form-input"
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
            >
              <option value="CRITICAL">CRITICAL — Immediate Life Threat (Cardiac, Trauma, Stroke, Respiratory Arrest)</option>
              <option value="MEDIUM">MEDIUM — Urgent Admission / Severe Symptoms</option>
              <option value="LOW">LOW — Stable / Scheduled Emergency Check</option>
            </select>
          </FormField>

          <FormField label="Preferred Department (Optional)" id="adm-pref-dept">
            <input
              type="text"
              id="adm-pref-dept"
              className="form-input"
              placeholder="e.g. Emergency, Cardiology, Trauma, ICU"
              value={preferredDept}
              onChange={(e) => setPreferredDept(e.target.value)}
            />
          </FormField>

          <FormField
            label="Reason for Admission / Clinical Symptoms"
            id="adm-reason-text"
            required
            hint="Describe symptoms, vital conditions, or trauma details"
          >
            <textarea
              id="adm-reason-text"
              className="form-input"
              rows={4}
              placeholder="e.g. Severe chest pain radiating to left arm, shortness of breath, onset 30 mins ago..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
          </FormField>

          <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
            <Button variant="secondary" onClick={() => setAdmissionModalOpen(false)} disabled={submittingAdmission}>
              Cancel
            </Button>
            <Button variant="danger" type="submit" loading={submittingAdmission}>
              Submit Request to Hospital
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

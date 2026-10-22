import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

export default function HospitalDashboard() {
  const { user } = useAuth();
  const [hospital, setHospital] = useState(null);
  const [admissions, setAdmissions] = useState([]);
  const [error, setError] = useState('');
  const [newDoctor, setNewDoctor] = useState({ name: '', specialization: '' });
  const [newWait, setNewWait] = useState({ department: '', minutes: '' });
  const [profile, setProfile] = useState(null);

  const load = () => {
    api.getHospital(user.hospital_id).then((data) => { setHospital(data); setProfile(data); }).catch((e) => setError(e.message));
    api.myAdmissions().then(setAdmissions).catch((e) => setError(e.message));
  };
  useEffect(() => { load(); }, []);

  async function updateResource(resourceId, field, value) {
    try {
      await api.updateResource(user.hospital_id, resourceId, { [field]: Number(value) });
      load();
    } catch (e) { setError(e.message); }
  }

  async function toggleDoctor(doctorId, available) {
    try { await api.updateDoctor(user.hospital_id, doctorId, { available: !available }); load(); }
    catch (e) { setError(e.message); }
  }

  async function addDoctor() {
    try {
      await api.addDoctor(user.hospital_id, { ...newDoctor, available: true });
      setNewDoctor({ name: '', specialization: '' });
      load();
    } catch (e) { setError(e.message); }
  }

  async function saveWaitingTime() {
    try {
      await api.updateWaitingTime(user.hospital_id, { department: newWait.department, minutes: Number(newWait.minutes) });
      setNewWait({ department: '', minutes: '' });
      load();
    } catch (e) { setError(e.message); }
  }

  async function processAdmission(id, status) {
    try { await api.updateAdmissionStatus(id, status); load(); } catch (e) { setError(e.message); }
  }

  async function saveProfile() {
    try {
      const saved = await api.updateHospitalProfile(user.hospital_id, profile);
      setHospital({ ...hospital, ...saved });
      setProfile(saved);
      setError('');
    } catch (e) { setError(e.message); }
  }

  if (!hospital) return <div className="page">{error ? <p className="error">{error}</p> : 'Loading…'}</div>;

  return (
    <div className="page">
      <h2>{hospital.name} — hospital dashboard</h2>
      {error && <p className="error">{error}</p>}

      <div className="panel">
        <h3>Hospital profile</h3>
        <div className="inline-form">
          <input aria-label="Hospital name" placeholder="Hospital name" value={profile?.name || ''} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
          <input aria-label="Address" placeholder="Address" value={profile?.address || ''} onChange={(e) => setProfile({ ...profile, address: e.target.value })} />
          <input aria-label="Specialties" placeholder="Specialties" value={profile?.specialties || ''} onChange={(e) => setProfile({ ...profile, specialties: e.target.value })} />
          <input aria-label="Insurance information" placeholder="Insurance information" value={profile?.insurance_info || ''} onChange={(e) => setProfile({ ...profile, insurance_info: e.target.value })} />
          <input aria-label="Latitude" type="number" placeholder="Latitude" value={profile?.latitude ?? ''} onChange={(e) => setProfile({ ...profile, latitude: e.target.value === '' ? null : Number(e.target.value) })} />
          <input aria-label="Longitude" type="number" placeholder="Longitude" value={profile?.longitude ?? ''} onChange={(e) => setProfile({ ...profile, longitude: e.target.value === '' ? null : Number(e.target.value) })} />
          <button className="btn-primary" onClick={saveProfile}>Save profile</button>
        </div>
      </div>

      <div className="panel">
        <h3>Resources</h3>
        <table className="table">
          <thead><tr><th>Type</th><th>Total</th><th>Available</th><th></th></tr></thead>
          <tbody>
            {hospital.resources.map((r) => (
              <ResourceRow key={r.resource_id} resource={r} onUpdate={updateResource} />
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel">
        <h3>Doctors</h3>
        <table className="table">
          <thead><tr><th>Name</th><th>Specialization</th><th>Available</th><th></th></tr></thead>
          <tbody>
            {hospital.doctors.map((d) => (
              <tr key={d.doctor_id}>
                <td>{d.name}</td><td>{d.specialization}</td>
                <td><span className={`badge ${d.available ? 'accepted' : 'rejected'}`}>{d.available ? 'Available' : 'Unavailable'}</span></td>
                <td><button className="btn-secondary" onClick={() => toggleDoctor(d.doctor_id, d.available)}>Toggle</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="inline-form">
          <input placeholder="Doctor name" value={newDoctor.name} onChange={(e) => setNewDoctor({ ...newDoctor, name: e.target.value })} />
          <input placeholder="Specialization" value={newDoctor.specialization} onChange={(e) => setNewDoctor({ ...newDoctor, specialization: e.target.value })} />
          <button className="btn-primary" onClick={addDoctor} disabled={!newDoctor.name}>Add doctor</button>
        </div>
      </div>

      <div className="panel">
        <h3>Waiting times</h3>
        <table className="table">
          <thead><tr><th>Department</th><th>Minutes</th></tr></thead>
          <tbody>
            {hospital.waiting_times.map((w) => <tr key={w.estimate_id}><td>{w.department}</td><td>{w.minutes}</td></tr>)}
          </tbody>
        </table>
        <div className="inline-form">
          <input placeholder="Department" value={newWait.department} onChange={(e) => setNewWait({ ...newWait, department: e.target.value })} />
          <input placeholder="Minutes" type="number" value={newWait.minutes} onChange={(e) => setNewWait({ ...newWait, minutes: e.target.value })} />
          <button className="btn-primary" onClick={saveWaitingTime} disabled={!newWait.department || !newWait.minutes}>Save</button>
        </div>
      </div>

      <div className="panel">
        <h3>Emergency admission requests</h3>
        <table className="table">
          <thead><tr><th>Patient</th><th>Reason</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {admissions.map((a) => (
              <tr key={a.admission_id}>
                <td>{a.patient_name} ({a.patient_phone})</td><td>{a.reason}</td>
                <td><span className={`badge ${a.status.toLowerCase()}`}>{a.status}</span></td>
                <td>
                  {a.status === 'PENDING' && (
                    <>
                      <button className="btn-secondary" onClick={() => processAdmission(a.admission_id, 'ACCEPTED')}>Accept</button>
                      <button className="btn-link" onClick={() => processAdmission(a.admission_id, 'REJECTED')}>Reject</button>
                    </>
                  )}
                  {a.status === 'ACCEPTED' && (
                    <button className="btn-secondary" onClick={() => processAdmission(a.admission_id, 'COMPLETED')}>Mark completed</button>
                  )}
                </td>
              </tr>
            ))}
            {admissions.length === 0 && <tr><td colSpan={4} className="muted">No requests yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ResourceRow({ resource, onUpdate }) {
  const [available, setAvailable] = useState(resource.available);
  return (
    <tr>
      <td>{resource.type}</td>
      <td>{resource.total}</td>
      <td><input type="number" style={{ width: 70 }} value={available} onChange={(e) => setAvailable(e.target.value)} /></td>
      <td><button className="btn-secondary" onClick={() => onUpdate(resource.resource_id, 'available', available)}>Save</button></td>
    </tr>
  );
}

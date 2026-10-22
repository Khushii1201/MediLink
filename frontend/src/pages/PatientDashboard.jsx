import { useEffect, useState } from 'react';
import { api } from '../api';

const TABS = ['Search & Recommend', 'Admissions', 'Ambulance', 'Blood Bank'];

export default function PatientDashboard() {
  const [tab, setTab] = useState(TABS[0]);
  return (
    <div className="page">
      <h2>Patient dashboard</h2>
      <div className="tabs">
        {TABS.map((t) => (
          <button key={t} className={tab === t ? 'tab active' : 'tab'} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>
      {tab === 'Search & Recommend' && <SearchAndRecommend />}
      {tab === 'Admissions' && <Admissions />}
      {tab === 'Ambulance' && <Ambulance />}
      {tab === 'Blood Bank' && <BloodBank />}
    </div>
  );
}

function SearchAndRecommend() {
  const [hospitals, setHospitals] = useState([]);
  const [recs, setRecs] = useState(null);
  const [error, setError] = useState('');
  const [coords, setCoords] = useState(null);

  useEffect(() => {
    api.searchHospitals({}).then(setHospitals).catch((e) => setError(e.message));
    navigator.geolocation?.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setCoords({ lat: 28.6139, lng: 77.2090 }) // Delhi fallback
    );
  }, []);

  async function getRecommendations() {
    try {
      const params = coords || { lat: 28.6139, lng: 77.2090 };
      const data = await api.getRecommendations(params);
      setRecs(data);
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div>
      <div className="panel">
        <h3>AI-assisted hospital recommendation</h3>
        <p className="muted">Ranks hospitals using distance, bed availability, and waiting time. Estimates only — not a clinical decision.</p>
        <button className="btn-primary" onClick={getRecommendations}>Get recommendations</button>
        {recs && (
          <table className="table">
            <thead><tr><th>Hospital</th><th>Distance</th><th>Beds</th><th>Avg wait</th><th>Score</th></tr></thead>
            <tbody>
              {recs.recommendations.map((r) => (
                <tr key={r.hospital_id}>
                  <td>{r.name}</td>
                  <td>{r.distance_km ?? '—'} km</td>
                  <td>{r.bed_availability}</td>
                  <td>{r.avg_waiting_minutes} min</td>
                  <td><strong>{r.score}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="panel">
        <h3>Hospitals</h3>
        {error && <p className="error">{error}</p>}
        <div className="card-grid">
          {hospitals.map((h) => <HospitalCard key={h.hospital_id} hospital={h} />)}
        </div>
      </div>
    </div>
  );
}

function HospitalCard({ hospital }) {
  const [reason, setReason] = useState('');
  const [status, setStatus] = useState('');

  async function requestAdmission() {
    try {
      await api.requestAdmission({ hospital_id: hospital.hospital_id, reason });
      setStatus('Admission request submitted.');
      setReason('');
    } catch (e) {
      setStatus(e.message);
    }
  }

  return (
    <div className="card">
      <h3>{hospital.name}</h3>
      <p className="muted">{hospital.address}</p>
      <p className="muted">{hospital.specialties}</p>
      <div className="resource-row">
        {hospital.resources?.map((r) => <span key={r.type} className="pill">{r.type}: {r.available}/{r.total}</span>)}
      </div>
      <div className="inline-form">
        <input placeholder="Reason for admission" value={reason} onChange={(e) => setReason(e.target.value)} />
        <button className="btn-secondary" onClick={requestAdmission} disabled={!reason}>Request admission</button>
      </div>
      {status && <p className="hint">{status}</p>}
    </div>
  );
}

function Admissions() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');

  const load = () => api.myAdmissions().then(setRows).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  return (
    <div className="panel">
      <h3>My admission requests</h3>
      {error && <p className="error">{error}</p>}
      <table className="table">
        <thead><tr><th>Hospital</th><th>Reason</th><th>Status</th><th>Requested</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.admission_id}>
              <td>{r.hospital_name}</td><td>{r.reason}</td>
              <td><span className={`badge ${r.status.toLowerCase()}`}>{r.status}</span></td>
              <td>{new Date(r.created_at).toLocaleString()}</td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={4} className="muted">No requests yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function Ambulance() {
  const [rows, setRows] = useState([]);
  const [pickup, setPickup] = useState('');
  const [error, setError] = useState('');

  const load = () => api.myAmbulanceRequests().then(setRows).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  async function submit() {
    try {
      await api.requestAmbulance(pickup);
      setPickup('');
      load();
    } catch (e) { setError(e.message); }
  }

  return (
    <div className="panel">
      <h3>Request an ambulance</h3>
      <div className="inline-form">
        <input placeholder="Pickup location" value={pickup} onChange={(e) => setPickup(e.target.value)} />
        <button className="btn-primary" onClick={submit} disabled={!pickup}>Request</button>
      </div>
      {error && <p className="error">{error}</p>}
      <table className="table">
        <thead><tr><th>Pickup</th><th>Status</th><th>Ambulance</th><th>Requested</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.request_id}>
              <td>{r.pickup_location}</td>
              <td><span className={`badge ${r.status.toLowerCase()}`}>{r.status}</span></td>
              <td>{r.ambulance ? `${r.ambulance.vehicle_no} (${r.ambulance.status})` : 'Not yet assigned'}</td>
              <td>{new Date(r.created_at).toLocaleString()}</td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={4} className="muted">No ambulance requests yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function BloodBank() {
  const [group, setGroup] = useState('');
  const [units, setUnits] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [error, setError] = useState('');

  const loadReservations = () => api.myReservations().then(setReservations).catch((e) => setError(e.message));
  useEffect(() => { loadReservations(); }, []);

  async function search() {
    try { setUnits(await api.searchBloodUnits(group)); } catch (e) { setError(e.message); }
  }

  async function reserve(unitId) {
    try {
      await api.reserveBlood(unitId, 1);
      loadReservations();
    } catch (e) { setError(e.message); }
  }

  return (
    <div>
      <div className="panel">
        <h3>Blood availability</h3>
        <div className="inline-form">
          <select value={group} onChange={(e) => setGroup(e.target.value)}>
            <option value="">All groups</option>
            {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
          <button className="btn-primary" onClick={search}>Search</button>
        </div>
        {error && <p className="error">{error}</p>}
        <table className="table">
          <thead><tr><th>Blood bank</th><th>Group</th><th>Available</th><th></th></tr></thead>
          <tbody>
            {units.map((u) => (
              <tr key={u.unit_id}>
                <td>{u.bloodbank_name}</td><td>{u.blood_group}</td><td>{u.available}</td>
                <td><button className="btn-secondary" disabled={u.available < 1} onClick={() => reserve(u.unit_id)}>Reserve 1 unit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel">
        <h3>My reservations</h3>
        <table className="table">
          <thead><tr><th>Group</th><th>Blood bank</th><th>Units</th><th>Status</th></tr></thead>
          <tbody>
            {reservations.map((r) => (
              <tr key={r.reservation_id}>
                <td>{r.blood_group}</td><td>{r.bloodbank_name}</td><td>{r.units_requested}</td>
                <td><span className={`badge ${r.status.toLowerCase()}`}>{r.status}</span></td>
              </tr>
            ))}
            {reservations.length === 0 && <tr><td colSpan={4} className="muted">No reservations yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

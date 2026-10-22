import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

export default function AmbulanceDashboard() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [location, setLocation] = useState({ latitude: '', longitude: '' });
  const [ambulance, setAmbulance] = useState(null);
  const [error, setError] = useState('');

  const load = () => {
    api.myAmbulanceRequests().then(setRequests).catch((e) => setError(e.message));
    api.listAmbulances().then((rows) => setAmbulance(rows.find((row) => row.ambulance_id === user.ambulance_id) || null)).catch((e) => setError(e.message));
  };
  useEffect(() => { load(); }, []);

  async function updateStatus(id, status) {
    try { await api.updateAmbulanceRequest(id, status); load(); } catch (e) { setError(e.message); }
  }

  async function updateLocation() {
    try {
      await api.updateAmbulanceLocation(user.ambulance_id, {
        latitude: Number(location.latitude), longitude: Number(location.longitude),
      });
      setError('');
    } catch (e) { setError(e.message); }
  }

  async function saveAmbulance() {
    try {
      const saved = await api.updateAmbulanceProfile(ambulance.ambulance_id, { vehicle_no: ambulance.vehicle_no, status: ambulance.status });
      setAmbulance(saved);
      setError('');
    } catch (e) { setError(e.message); }
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) return setError('Location is not supported by this browser.');
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      setLocation({ latitude: coords.latitude, longitude: coords.longitude });
      setError('');
    }, () => setError('Location permission was denied or unavailable.'));
  }

  return (
    <div className="page">
      <h2>Ambulance operator dashboard</h2>
      {error && <p className="error">{error}</p>}

      <div className="panel">
        <h3>Ambulance details</h3>
        {ambulance ? <div className="inline-form">
          <input aria-label="Vehicle number" value={ambulance.vehicle_no} onChange={(e) => setAmbulance({ ...ambulance, vehicle_no: e.target.value })} />
          <select aria-label="Vehicle status" value={ambulance.status} onChange={(e) => setAmbulance({ ...ambulance, status: e.target.value })}>
            <option value="AVAILABLE">Available</option><option value="ON_TRIP">On trip</option><option value="OFFLINE">Offline</option>
          </select>
          <button className="btn-primary" onClick={saveAmbulance}>Save details</button>
        </div> : <p className="muted">No ambulance is assigned to this operator account.</p>}
      </div>

      <div className="panel">
        <h3>Update live location (GPS)</h3>
        <div className="inline-form">
          <input placeholder="Latitude" value={location.latitude} onChange={(e) => setLocation({ ...location, latitude: e.target.value })} />
          <input placeholder="Longitude" value={location.longitude} onChange={(e) => setLocation({ ...location, longitude: e.target.value })} />
          <button className="btn-secondary" onClick={useCurrentLocation}>Use current location</button>
          <button className="btn-primary" onClick={updateLocation}>Update</button>
        </div>
      </div>

      <div className="panel">
        <h3>Assigned trip requests</h3>
        <table className="table">
          <thead><tr><th>Pickup</th><th>Status</th><th>Requested</th><th></th></tr></thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.request_id}>
                <td>{r.pickup_location}</td>
                <td><span className={`badge ${r.status.toLowerCase()}`}>{r.status}</span></td>
                <td>{new Date(r.created_at).toLocaleString()}</td>
                <td>
                  {r.status === 'ACCEPTED' && <button className="btn-secondary" onClick={() => updateStatus(r.request_id, 'EN_ROUTE')}>Start trip</button>}
                  {r.status === 'EN_ROUTE' && <button className="btn-secondary" onClick={() => updateStatus(r.request_id, 'COMPLETED')}>Complete</button>}
                </td>
              </tr>
            ))}
            {requests.length === 0 && <tr><td colSpan={4} className="muted">No assigned requests.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

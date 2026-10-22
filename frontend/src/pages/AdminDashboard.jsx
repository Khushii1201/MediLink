import { useEffect, useState } from 'react';
import { api } from '../api';

export default function AdminDashboard() {
  const [analytics, setAnalytics] = useState(null);
  const [users, setUsers] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [ambulances, setAmbulances] = useState([]);
  const [banks, setBanks] = useState([]);
  const [units, setUnits] = useState([]);
  const [admissions, setAdmissions] = useState([]);
  const [ambulanceRequests, setAmbulanceRequests] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [newHospital, setNewHospital] = useState({ name: '', address: '', latitude: '', longitude: '', specialties: '' });
  const [newAmbulance, setNewAmbulance] = useState({ vehicle_no: '' });
  const [newBank, setNewBank] = useState({ name: '', address: '' });
  const [error, setError] = useState('');

  const load = () => {
    api.adminAnalytics().then(setAnalytics).catch((e) => setError(e.message));
    api.adminUsers().then(setUsers).catch((e) => setError(e.message));
    api.searchHospitals({}).then(setHospitals).catch((e) => setError(e.message));
    api.listAmbulances().then(setAmbulances).catch((e) => setError(e.message));
    api.listBloodBanks().then(setBanks).catch((e) => setError(e.message));
    api.searchBloodUnits().then(setUnits).catch((e) => setError(e.message));
    api.myAdmissions().then(setAdmissions).catch((e) => setError(e.message));
    api.myAmbulanceRequests().then(setAmbulanceRequests).catch((e) => setError(e.message));
    api.myReservations().then(setReservations).catch((e) => setError(e.message));
  };
  useEffect(() => { load(); }, []);

  async function removeUser(id) {
    if (!confirm('Remove this user?')) return;
    try { await api.adminDeleteUser(id); load(); } catch (e) { setError(e.message); }
  }

  async function createHospital(event) {
    event.preventDefault();
    try {
      await api.createHospital({ ...newHospital, latitude: newHospital.latitude ? Number(newHospital.latitude) : null, longitude: newHospital.longitude ? Number(newHospital.longitude) : null });
      setNewHospital({ name: '', address: '', latitude: '', longitude: '', specialties: '' });
      load();
    } catch (e) { setError(e.message); }
  }

  async function createAmbulance(event) {
    event.preventDefault();
    try { await api.createAmbulance(newAmbulance); setNewAmbulance({ vehicle_no: '' }); load(); }
    catch (e) { setError(e.message); }
  }

  async function createBank(event) {
    event.preventDefault();
    try { await api.createBloodBank(newBank); setNewBank({ name: '', address: '' }); load(); }
    catch (e) { setError(e.message); }
  }

  async function saveHospital(hospital) {
    try { await api.updateHospitalProfile(hospital.hospital_id, hospital); load(); }
    catch (e) { setError(e.message); }
  }

  async function saveAmbulance(ambulance) {
    try { await api.updateAmbulanceProfile(ambulance.ambulance_id, ambulance); load(); }
    catch (e) { setError(e.message); }
  }

  async function saveBank(bank) {
    try { await api.updateBloodBank(bank.bloodbank_id, bank); load(); }
    catch (e) { setError(e.message); }
  }

  async function changeAdmission(id, status) {
    try { await api.updateAdmissionStatus(id, status); load(); }
    catch (e) { setError(e.message); }
  }

  async function changeAmbulanceRequest(id, status) {
    try { await api.updateAmbulanceRequest(id, status); load(); }
    catch (e) { setError(e.message); }
  }

  async function changeReservation(id, status) {
    try { await api.updateReservation(id, status); load(); }
    catch (e) { setError(e.message); }
  }

  if (!analytics) return <div className="page">{error ? <p className="error">{error}</p> : 'Loading…'}</div>;

  return (
    <div className="page">
      <h2>Administrator dashboard</h2>
      {error && <p className="error">{error}</p>}

      <div className="stat-grid">
        <Stat label="Users" value={analytics.totals.users} />
        <Stat label="Hospitals" value={analytics.totals.hospitals} />
        <Stat label="Ambulances" value={analytics.totals.ambulances} />
        <Stat label="Blood banks" value={analytics.totals.blood_banks} />
      </div>

      <div className="panel">
        <h3>Provider directory</h3>
        <h4>Hospitals</h4>
        <table className="table"><thead><tr><th>Name</th><th>Address</th><th>Coordinates</th><th></th></tr></thead><tbody>
          {hospitals.map((hospital) => <tr key={hospital.hospital_id}>
            <td><input aria-label="Hospital name" value={hospital.name} onChange={(e) => setHospitals(hospitals.map((row) => row.hospital_id === hospital.hospital_id ? { ...row, name: e.target.value } : row))} /></td>
            <td><input aria-label="Hospital address" value={hospital.address || ''} onChange={(e) => setHospitals(hospitals.map((row) => row.hospital_id === hospital.hospital_id ? { ...row, address: e.target.value } : row))} /></td>
            <td>{hospital.latitude ?? '—'}, {hospital.longitude ?? '—'}</td>
            <td><button className="btn-secondary" onClick={() => saveHospital(hospital)}>Save</button></td>
          </tr>)}
        </tbody></table>
        <form className="inline-form" onSubmit={createHospital}>
          <input aria-label="New hospital name" placeholder="Hospital name" value={newHospital.name} onChange={(e) => setNewHospital({ ...newHospital, name: e.target.value })} required />
          <input aria-label="New hospital address" placeholder="Address" value={newHospital.address} onChange={(e) => setNewHospital({ ...newHospital, address: e.target.value })} />
          <input aria-label="Hospital latitude" type="number" step="any" placeholder="Latitude" value={newHospital.latitude} onChange={(e) => setNewHospital({ ...newHospital, latitude: e.target.value })} />
          <input aria-label="Hospital longitude" type="number" step="any" placeholder="Longitude" value={newHospital.longitude} onChange={(e) => setNewHospital({ ...newHospital, longitude: e.target.value })} />
          <input aria-label="Hospital specialties" placeholder="Specialties" value={newHospital.specialties} onChange={(e) => setNewHospital({ ...newHospital, specialties: e.target.value })} />
          <button className="btn-primary">Add hospital</button>
        </form>

        <h4>Ambulance fleet</h4>
        <table className="table"><thead><tr><th>Vehicle</th><th>Status</th><th>Location</th><th></th></tr></thead><tbody>
          {ambulances.map((ambulance) => <tr key={ambulance.ambulance_id}>
            <td><input aria-label="Vehicle number" value={ambulance.vehicle_no} onChange={(e) => setAmbulances(ambulances.map((row) => row.ambulance_id === ambulance.ambulance_id ? { ...row, vehicle_no: e.target.value } : row))} /></td>
            <td><select aria-label="Ambulance status" value={ambulance.status} onChange={(e) => setAmbulances(ambulances.map((row) => row.ambulance_id === ambulance.ambulance_id ? { ...row, status: e.target.value } : row))}><option>AVAILABLE</option><option>ON_TRIP</option><option>OFFLINE</option></select></td>
            <td>{ambulance.latitude ?? '—'}, {ambulance.longitude ?? '—'}</td>
            <td><button className="btn-secondary" onClick={() => saveAmbulance(ambulance)}>Save</button></td>
          </tr>)}
        </tbody></table>
        <form className="inline-form" onSubmit={createAmbulance}>
          <input aria-label="New vehicle number" placeholder="Vehicle number" value={newAmbulance.vehicle_no} onChange={(e) => setNewAmbulance({ vehicle_no: e.target.value })} required />
          <button className="btn-primary">Add ambulance</button>
        </form>

        <h4>Blood banks</h4>
        <table className="table"><thead><tr><th>Name</th><th>Address</th><th></th></tr></thead><tbody>
          {banks.map((bank) => <tr key={bank.bloodbank_id}>
            <td><input aria-label="Blood bank name" value={bank.name} onChange={(e) => setBanks(banks.map((row) => row.bloodbank_id === bank.bloodbank_id ? { ...row, name: e.target.value } : row))} /></td>
            <td><input aria-label="Blood bank address" value={bank.address || ''} onChange={(e) => setBanks(banks.map((row) => row.bloodbank_id === bank.bloodbank_id ? { ...row, address: e.target.value } : row))} /></td>
            <td><button className="btn-secondary" onClick={() => saveBank(bank)}>Save</button></td>
          </tr>)}
        </tbody></table>
        <form className="inline-form" onSubmit={createBank}>
          <input aria-label="New blood bank name" placeholder="Blood bank name" value={newBank.name} onChange={(e) => setNewBank({ ...newBank, name: e.target.value })} required />
          <input aria-label="New blood bank address" placeholder="Address" value={newBank.address} onChange={(e) => setNewBank({ ...newBank, address: e.target.value })} />
          <button className="btn-primary">Add blood bank</button>
        </form>
      </div>

      <div className="panel">
        <h3>System operations</h3>
        <h4>Admission requests</h4>
        <table className="table"><thead><tr><th>Patient</th><th>Hospital</th><th>Reason</th><th>Status</th><th>Actions</th></tr></thead><tbody>
          {admissions.map((row) => <tr key={row.admission_id}><td>{row.patient_name}</td><td>{row.hospital_name}</td><td>{row.reason}</td><td>{row.status}</td><td>
            {row.status === 'PENDING' && <><button className="btn-secondary" onClick={() => changeAdmission(row.admission_id, 'ACCEPTED')}>Accept</button><button className="btn-link" onClick={() => changeAdmission(row.admission_id, 'REJECTED')}>Reject</button></>}
            {row.status === 'ACCEPTED' && <button className="btn-secondary" onClick={() => changeAdmission(row.admission_id, 'COMPLETED')}>Complete</button>}
          </td></tr>)}
          {!admissions.length && <tr><td colSpan={5} className="muted">No admission requests.</td></tr>}
        </tbody></table>

        <h4>Ambulance requests</h4>
        <table className="table"><thead><tr><th>Pickup</th><th>Vehicle</th><th>Status</th><th>Actions</th></tr></thead><tbody>
          {ambulanceRequests.map((row) => <tr key={row.request_id}><td>{row.pickup_location}</td><td>{row.ambulance?.vehicle_no || 'Unassigned'}</td><td>{row.status}</td><td>
            {row.status === 'REQUESTED' && <button className="btn-secondary" onClick={() => changeAmbulanceRequest(row.request_id, 'ACCEPTED')}>Accept</button>}
            {row.status === 'ACCEPTED' && <button className="btn-secondary" onClick={() => changeAmbulanceRequest(row.request_id, 'EN_ROUTE')}>Start</button>}
            {row.status === 'EN_ROUTE' && <button className="btn-secondary" onClick={() => changeAmbulanceRequest(row.request_id, 'COMPLETED')}>Complete</button>}
            {!['COMPLETED', 'CANCELLED'].includes(row.status) && <button className="btn-link" onClick={() => changeAmbulanceRequest(row.request_id, 'CANCELLED')}>Cancel</button>}
          </td></tr>)}
          {!ambulanceRequests.length && <tr><td colSpan={4} className="muted">No ambulance requests.</td></tr>}
        </tbody></table>

        <h4>Blood reservations</h4>
        <table className="table"><thead><tr><th>Patient</th><th>Blood group</th><th>Units</th><th>Status</th><th>Actions</th></tr></thead><tbody>
          {reservations.map((row) => <tr key={row.reservation_id}><td>{row.patient_name}</td><td>{row.blood_group}</td><td>{row.units_requested}</td><td>{row.status}</td><td>
            {row.status === 'PENDING' && <><button className="btn-secondary" onClick={() => changeReservation(row.reservation_id, 'APPROVED')}>Approve</button><button className="btn-link" onClick={() => changeReservation(row.reservation_id, 'REJECTED')}>Reject</button></>}
            {row.status === 'APPROVED' && <button className="btn-secondary" onClick={() => changeReservation(row.reservation_id, 'FULFILLED')}>Fulfill</button>}
          </td></tr>)}
          {!reservations.length && <tr><td colSpan={5} className="muted">No blood reservations.</td></tr>}
        </tbody></table>

        <h4>Blood inventory</h4>
        <table className="table"><thead><tr><th>Bank</th><th>Group</th><th>Quantity</th><th>Available</th><th></th></tr></thead><tbody>
          {units.map((unit) => <AdminUnitRow key={unit.unit_id} unit={unit} onSave={async (patch) => { try { await api.updateBloodUnit(unit.unit_id, patch); load(); } catch (e) { setError(e.message); } }} />)}
        </tbody></table>
      </div>

      <div className="panel">
        <h3>Admissions by status</h3>
        <StatusBars rows={analytics.admissionsByStatus} />
      </div>
      <div className="panel">
        <h3>Ambulance requests by status</h3>
        <StatusBars rows={analytics.ambulanceRequestsByStatus} />
      </div>
      <div className="panel">
        <h3>Blood reservations by status</h3>
        <StatusBars rows={analytics.reservationsByStatus} />
      </div>

      <div className="panel">
        <h3>Hospital bed/ICU/ventilator occupancy</h3>
        <table className="table">
          <thead><tr><th>Hospital</th><th>Type</th><th>Total</th><th>Available</th><th>Occupancy</th></tr></thead>
          <tbody>
            {analytics.bedOccupancy.map((r, i) => (
              <tr key={i}><td>{r.hospital_name}</td><td>{r.type}</td><td>{r.total}</td><td>{r.available}</td><td>{r.occupancy_pct}%</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel">
        <h3>Average waiting time by hospital</h3>
        <table className="table">
          <thead><tr><th>Hospital</th><th>Avg minutes</th></tr></thead>
          <tbody>
            {analytics.avgWaitByHospital.map((r, i) => <tr key={i}><td>{r.hospital_name}</td><td>{r.avg_minutes}</td></tr>)}
          </tbody>
        </table>
      </div>

      <div className="panel">
        <h3>Registered users</h3>
        <table className="table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th></th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.user_id}>
                <td>{u.name}</td><td>{u.email}</td><td>{u.role}</td>
                <td><button className="btn-link" onClick={() => removeUser(u.user_id)}>Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return <div className="stat-card"><div className="stat-value">{value}</div><div className="stat-label">{label}</div></div>;
}

function StatusBars({ rows }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="bar-chart">
      {rows.map((r) => (
        <div key={r.status} className="bar-row">
          <span className="bar-label">{r.status}</span>
          <div className="bar-track"><div className="bar-fill" style={{ width: `${(r.count / max) * 100}%` }} /></div>
          <span className="bar-count">{r.count}</span>
        </div>
      ))}
      {rows.length === 0 && <p className="muted">No data yet.</p>}
    </div>
  );
}

function AdminUnitRow({ unit, onSave }) {
  const [quantity, setQuantity] = useState(unit.quantity);
  const [available, setAvailable] = useState(unit.available);
  return <tr>
    <td>{unit.bloodbank_name}</td><td>{unit.blood_group}</td>
    <td><input aria-label={`${unit.blood_group} total units`} type="number" min="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></td>
    <td><input aria-label={`${unit.blood_group} available units`} type="number" min="0" value={available} onChange={(e) => setAvailable(e.target.value)} /></td>
    <td><button className="btn-secondary" onClick={() => onSave({ quantity: Number(quantity), available: Number(available) })}>Save</button></td>
  </tr>;
}

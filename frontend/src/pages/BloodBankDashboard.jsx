import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

export default function BloodBankDashboard() {
  const { user } = useAuth();
  const [units, setUnits] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [newUnit, setNewUnit] = useState({ blood_group: 'A+', quantity: '', available: '' });
  const [bank, setBank] = useState(null);
  const [error, setError] = useState('');

  const load = () => {
    api.searchBloodUnits().then((all) => setUnits(all.filter((u) => u.bloodbank_name && u))).catch((e) => setError(e.message));
    api.myReservations().then(setReservations).catch((e) => setError(e.message));
    api.listBloodBanks().then((rows) => setBank(rows.find((row) => row.bloodbank_id === user.bloodbank_id) || null)).catch((e) => setError(e.message));
  };
  useEffect(() => { load(); }, []);

  async function updateUnit(unitId, field, value) {
    try { await api.updateBloodUnit(unitId, { [field]: Number(value) }); load(); } catch (e) { setError(e.message); }
  }

  async function processReservation(id, status) {
    try { await api.updateReservation(id, status); load(); } catch (e) { setError(e.message); }
  }

  async function saveBank() {
    try {
      const saved = await api.updateBloodBank(bank.bloodbank_id, { name: bank.name, address: bank.address });
      setBank(saved);
      setError('');
    } catch (e) { setError(e.message); }
  }

  async function addUnit() {
    try {
      await api.createBloodUnit({ ...newUnit, quantity: Number(newUnit.quantity), available: Number(newUnit.available) });
      setNewUnit({ blood_group: 'A+', quantity: '', available: '' });
      load();
    } catch (e) { setError(e.message); }
  }

  const myUnits = units.filter((u) => u.bloodbank_id === user.bloodbank_id);

  return (
    <div className="page">
      <h2>Blood bank dashboard</h2>
      {error && <p className="error">{error}</p>}

      <div className="panel">
        <h3>Blood bank profile</h3>
        {bank && <div className="inline-form">
          <input aria-label="Blood bank name" value={bank.name} onChange={(e) => setBank({ ...bank, name: e.target.value })} />
          <input aria-label="Address" placeholder="Address" value={bank.address || ''} onChange={(e) => setBank({ ...bank, address: e.target.value })} />
          <button className="btn-primary" onClick={saveBank}>Save profile</button>
        </div>}
      </div>

      <div className="panel">
        <h3>Inventory</h3>
        <table className="table">
          <thead><tr><th>Group</th><th>Quantity</th><th>Available</th><th></th></tr></thead>
          <tbody>
            {myUnits.map((u) => <UnitRow key={u.unit_id} unit={u} onUpdate={updateUnit} />)}
          </tbody>
        </table>
        <div className="inline-form">
          <select aria-label="Blood group" value={newUnit.blood_group} onChange={(e) => setNewUnit({ ...newUnit, blood_group: e.target.value })}>
            {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((group) => <option key={group}>{group}</option>)}
          </select>
          <input aria-label="Quantity" type="number" min="0" placeholder="Quantity" value={newUnit.quantity} onChange={(e) => setNewUnit({ ...newUnit, quantity: e.target.value })} />
          <input aria-label="Available units" type="number" min="0" placeholder="Available" value={newUnit.available} onChange={(e) => setNewUnit({ ...newUnit, available: e.target.value })} />
          <button className="btn-primary" onClick={addUnit} disabled={!newUnit.quantity || !newUnit.available}>Add stock</button>
        </div>
      </div>

      <div className="panel">
        <h3>Reservation requests</h3>
        <table className="table">
          <thead><tr><th>Patient</th><th>Group</th><th>Units</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {reservations.map((r) => (
              <tr key={r.reservation_id}>
                <td>{r.patient_name}</td><td>{r.blood_group}</td><td>{r.units_requested}</td>
                <td><span className={`badge ${r.status.toLowerCase()}`}>{r.status}</span></td>
                <td>
                  {r.status === 'PENDING' && (
                    <>
                      <button className="btn-secondary" onClick={() => processReservation(r.reservation_id, 'APPROVED')}>Approve</button>
                      <button className="btn-link" onClick={() => processReservation(r.reservation_id, 'REJECTED')}>Reject</button>
                    </>
                  )}
                  {r.status === 'APPROVED' && <button className="btn-secondary" onClick={() => processReservation(r.reservation_id, 'FULFILLED')}>Mark fulfilled</button>}
                </td>
              </tr>
            ))}
            {reservations.length === 0 && <tr><td colSpan={5} className="muted">No reservation requests.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UnitRow({ unit, onUpdate }) {
  const [available, setAvailable] = useState(unit.available);
  return (
    <tr>
      <td>{unit.blood_group}</td><td>{unit.quantity}</td>
      <td><input type="number" style={{ width: 70 }} value={available} onChange={(e) => setAvailable(e.target.value)} /></td>
      <td><button className="btn-secondary" onClick={() => onUpdate(unit.unit_id, 'available', available)}>Save</button></td>
    </tr>
  );
}

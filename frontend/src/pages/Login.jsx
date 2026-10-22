import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

const DASHBOARD_PATH = {
  PATIENT: '/patient',
  HOSPITAL: '/hospital',
  AMBULANCE: '/ambulance',
  BLOODBANK: '/bloodbank',
  ADMIN: '/admin',
};

const DEMO_ACCOUNTS = [
  ['admin@medilink.com', 'Admin'],
  ['patient@medilink.com', 'Patient'],
  ['hospital@medilink.com', 'Hospital staff'],
  ['ambulance@medilink.com', 'Ambulance operator'],
  ['bloodbank@medilink.com', 'Blood bank staff'],
];

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      const { token, user } = await api.login(email, password);
      login(token, user);
      navigate(DASHBOARD_PATH[user.role] || '/');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="page narrow">
      <h2>Log in</h2>
      <form className="form-card" onSubmit={submit}>
        <label>Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn-primary" type="submit">Log in</button>
      </form>
      <p className="muted">No account? <Link to="/register">Sign up</Link></p>

      <div className="demo-box">
        <strong>Demo accounts</strong> (password: <code>password123</code>)
        <ul>
          {DEMO_ACCOUNTS.map(([e, label]) => (
            <li key={e}><button className="btn-link" onClick={() => { setEmail(e); setPassword('password123'); }}>{label} — {e}</button></li>
          ))}
        </ul>
      </div>
    </div>
  );
}

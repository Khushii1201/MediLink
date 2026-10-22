import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', role: 'PATIENT' });
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  function update(field, value) { setForm((f) => ({ ...f, [field]: value })); }

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      const { token, user } = await api.register(form);
      login(token, user);
      navigate('/');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="page narrow">
      <h2>Create an account</h2>
      <form className="form-card" onSubmit={submit}>
        <label>Full name
          <input value={form.name} onChange={(e) => update('name', e.target.value)} required />
        </label>
        <label>Email
          <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} required />
        </label>
        <label>Phone
          <input value={form.phone} onChange={(e) => update('phone', e.target.value)} />
        </label>
        <label>Password
          <input type="password" value={form.password} onChange={(e) => update('password', e.target.value)} required minLength={6} />
        </label>
        <label>Role
          <select value={form.role} onChange={(e) => update('role', e.target.value)}>
            <option value="PATIENT">Patient</option>
            <option value="HOSPITAL">Hospital staff</option>
            <option value="AMBULANCE">Ambulance operator</option>
            <option value="BLOODBANK">Blood bank staff</option>
            <option value="ADMIN">Administrator</option>
          </select>
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn-primary" type="submit">Sign up</button>
      </form>
      <p className="muted">Already have an account? <Link to="/login">Log in</Link></p>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/Button';
import { FormField } from '../components/FormField';

const DASHBOARD_PATH = {
  PATIENT: '/patient',
  HOSPITAL: '/hospital',
  AMBULANCE: '/ambulance',
  BLOODBANK: '/bloodbank',
  ADMIN: '/admin',
};

const DEMO_ACCOUNTS = [
  { email: 'admin@medilink.com', role: 'ADMIN', label: 'Platform Administrator' },
  { email: 'patient@medilink.com', role: 'PATIENT', label: 'Registered Patient' },
  { email: 'hospital@medilink.com', role: 'HOSPITAL', label: 'Hospital Ops (AIIMS)' },
  { email: 'ambulance@medilink.com', role: 'AMBULANCE', label: 'Ambulance Operator' },
  { email: 'bloodbank@medilink.com', role: 'BLOODBANK', label: 'Blood Bank Ops (Red Cross)' },
];

export default function Login() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const showDemo = import.meta.env.VITE_SHOW_DEMO !== 'false';

  useEffect(() => {
    const roleParam = (searchParams.get('role') || '').toUpperCase();
    if (roleParam) {
      const match = DEMO_ACCOUNTS.find((a) => a.role === roleParam);
      if (match) {
        setEmail(match.email);
        setPassword('password123');
      }
    }
  }, [searchParams]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { token, user } = await api.login(email.trim(), password);
      login(token, user);

      const redirectPath = searchParams.get('redirect');
      if (redirectPath && redirectPath.startsWith('/')) {
        navigate(redirectPath);
      } else {
        navigate(DASHBOARD_PATH[user.role] || '/');
      }
    } catch (err) {
      setError(err.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  }

  const fillDemo = (demoEmail) => {
    setEmail(demoEmail);
    setPassword('password123');
    setError('');
  };

  return (
    <div className="page auth-page">
      <div className="card auth-card">
        <div className="auth-card-header text-center">
          <div className="brand-logo" style={{ justifyContent: 'center', marginBottom: '0.75rem' }}>
            <span className="brand-icon" aria-hidden="true">✚</span>
            <span className="brand-text">MediLink</span>
          </div>
          <h2>Sign in to your account</h2>
          <p className="muted">Access healthcare resource portals and coordination tools</p>
        </div>

        {error && (
          <div className="alert alert-danger" role="alert">
            <span>{error}</span>
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          <FormField label="Email address" id="login-email" required>
            <input
              type="email"
              id="login-email"
              className="form-input"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </FormField>

          <FormField label="Password" id="login-password" required>
            <div className="password-input-wrap">
              <input
                type={showPassword ? 'text' : 'password'}
                id="login-password"
                className="form-input"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                className="btn-toggle-pw"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </FormField>

          <Button variant="primary" type="submit" size="lg" loading={loading} className="full-width" style={{ marginTop: '0.5rem' }}>
            Sign In
          </Button>
        </form>

        <p className="auth-switch-text text-center">
          Don't have an account? <Link to="/register">Create patient account</Link>
        </p>

        {showDemo && (
          <div className="demo-login-box">
            <div className="demo-box-header">
              <span className="badge badge-warning">Demo Quick Fill</span>
              <span className="demo-hint">Click any role to pre-fill test credentials:</span>
            </div>
            <div className="demo-accounts-list">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  className="demo-account-chip"
                  onClick={() => fillDemo(acc.email)}
                >
                  <span className="demo-role-name">{acc.label}</span>
                  <span className="demo-role-email">{acc.email}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

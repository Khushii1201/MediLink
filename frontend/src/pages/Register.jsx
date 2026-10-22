import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/Button';
import { FormField } from '../components/FormField';

export default function Register() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    setLoading(true);
    try {
      // Public registration is patient-only
      const { token, user } = await api.register({
        name: name.trim(),
        email: email.trim(),
        password,
        phone: phone.trim() || undefined,
      });

      login(token, user);

      const redirectPath = searchParams.get('redirect');
      if (redirectPath && redirectPath.startsWith('/')) {
        navigate(redirectPath);
      } else {
        navigate('/patient');
      }
    } catch (err) {
      setError(err.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page auth-page">
      <div className="card auth-card">
        <div className="auth-card-header text-center">
          <div className="brand-logo" style={{ justifyContent: 'center', marginBottom: '0.75rem' }}>
            <span className="brand-icon" aria-hidden="true">✚</span>
            <span className="brand-text">MediLink</span>
          </div>
          <h2>Create Patient Account</h2>
          <p className="muted">Register to search hospital beds, request ambulances, and reserve blood</p>
        </div>

        {error && (
          <div className="alert alert-danger" role="alert">
            <span>{error}</span>
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          <FormField label="Full Name" id="reg-name" required>
            <input
              type="text"
              id="reg-name"
              className="form-input"
              placeholder="e.g. Priya Sharma"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
            />
          </FormField>

          <FormField label="Email Address" id="reg-email" required>
            <input
              type="email"
              id="reg-email"
              className="form-input"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </FormField>

          <FormField label="Phone Number (Optional)" id="reg-phone" hint="For emergency dispatch and admission updates">
            <input
              type="tel"
              id="reg-phone"
              className="form-input"
              placeholder="+91-9876543210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
            />
          </FormField>

          <FormField label="Password" id="reg-password" required hint="At least 8 characters">
            <div className="password-input-wrap">
              <input
                type={showPassword ? 'text' : 'password'}
                id="reg-password"
                className="form-input"
                placeholder="Create a secure password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
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

          <div className="staff-registration-notice">
            <span>Hospital, ambulance, or blood bank staff? Staff accounts are provisioned by your system administrator.</span>
          </div>

          <Button variant="primary" type="submit" size="lg" loading={loading} className="full-width" style={{ marginTop: '0.75rem' }}>
            Register as Patient
          </Button>
        </form>

        <p className="auth-switch-text text-center">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}

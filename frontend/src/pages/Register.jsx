import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/Button';
import { FormField } from '../components/FormField';
import { Modal } from '../components/Modal';
import { Badge } from '../components/Badge';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const ROLE_DEFINITIONS = [
  {
    role: 'PATIENT',
    title: 'Patient / Citizen',
    badge: 'Self-Registered',
    badgeVariant: 'success',
    icon: '👤',
    summary: 'Public healthcare seekers needing immediate emergency assistance, bed reservation, or blood units.',
    responsibilities: [
      'Search emergency hospitals with real-time bed, ICU, and ventilator capacity',
      'Submit emergency admission requests with triage severity (Critical / Medium / Low)',
      'Request nearest available ambulance with live GPS tracking and dynamic ETA',
      'Search regional blood banks and place hold reservations on rare blood units',
    ],
    accountType: 'Instant Public Self-Registration',
  },
  {
    role: 'HOSPITAL',
    title: 'Hospital Staff & Triage Ops',
    badge: 'Admin Provisioned',
    badgeVariant: 'info',
    icon: '🏥',
    summary: 'Clinical triage nurses, ward managers, and hospital administrators bound to a specific facility.',
    responsibilities: [
      'Update real-time General Beds, ICU, and Ventilators via atomic stepper counters',
      'Manage incoming admissions queue (Critical emergency cases prioritized first)',
      'Accept or reject admissions (accepting automatically secures and decrements beds)',
      'Update live department emergency waiting times and manage doctor duty rosters',
    ],
    accountType: 'Institutional Account (Provisioned by Superadmin or Facility Lead)',
  },
  {
    role: 'AMBULANCE',
    title: 'Ambulance Operator / Fleet Owner',
    badge: 'Fleet Verified',
    badgeVariant: 'warning',
    icon: '🚑',
    summary: 'Emergency vehicle drivers and private/public ambulance fleet managers bound to a registered vehicle.',
    responsibilities: [
      'Toggle vehicle operational readiness (Available, On Trip, Offline)',
      'Receive nearest-vehicle dispatches routed by Haversine proximity algorithms',
      'Broadcast real-time GPS coordinates for continuous patient map tracking',
      'Update trip lifecycle stages (Accepted → En Route → Patient Dropped Off)',
    ],
    accountType: 'Fleet Account (Issued during vehicle onboarding & license registration)',
  },
  {
    role: 'BLOODBANK',
    title: 'Blood Bank Staff & Technicians',
    badge: 'Staff Provisioned',
    badgeVariant: 'danger',
    icon: '🩸',
    summary: 'Certified technicians and inventory managers managing regional blood center supplies.',
    responsibilities: [
      'Maintain live inventory counts for all 8 standard blood groups (A+, B+, O+, AB+, etc.)',
      'Monitor safety threshold alerts when inventory drops below critical limits (< 5 units)',
      'Review, approve, and fulfill patient emergency blood reservation tickets',
      'Manage blood bank operational hours, address, and emergency hotline info',
    ],
    accountType: 'Medical Center Account (Provisioned by Authorized Blood Bank Admin)',
  },
  {
    role: 'ADMIN',
    title: 'Platform System Administrator',
    badge: 'Superuser Access',
    badgeVariant: 'primary',
    icon: '🛡️',
    summary: 'Health department directors and platform administrators with global governance authority.',
    responsibilities: [
      'Onboard and verify hospitals, ambulance vehicles, and licensed blood banks',
      'Provision, activate, or deactivate institutional staff credentials',
      'Monitor citywide healthcare resource distribution and emergency response health',
      'Audit regulatory compliance through immutable system activity logs',
    ],
    accountType: 'Master Platform Governance (Root System Credential)',
  },
];

export default function Register() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();

  // Tab State: 'patient' or 'staff'
  const [activeTab, setActiveTab] = useState('patient');

  // Form Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);

  // Status & Modals
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showRoleModal, setShowRoleModal] = useState(false);

  // Password strength calculation
  const passwordCriteria = useMemo(() => {
    return {
      length: password.length >= 8,
      hasNumber: /\d/.test(password),
      hasMixedCase: /[a-z]/.test(password) && /[A-Z]/.test(password),
      hasSpecial: /[^A-Za-z0-9]/.test(password),
    };
  }, [password]);

  const passwordScore = useMemo(() => {
    if (!password) return 0;
    let score = 0;
    if (passwordCriteria.length) score += 1;
    if (passwordCriteria.hasNumber) score += 1;
    if (passwordCriteria.hasMixedCase) score += 1;
    if (passwordCriteria.hasSpecial) score += 1;
    return score;
  }, [password, passwordCriteria]);

  const passwordMatch = useMemo(() => {
    if (!confirmPassword) return null;
    return password === confirmPassword;
  }, [password, confirmPassword]);

  const getStrengthMeta = () => {
    switch (passwordScore) {
      case 0:
      case 1:
        return { label: 'Weak', className: 'active-weak', color: 'var(--danger-text)' };
      case 2:
      case 3:
        return { label: 'Good', className: 'active-fair', color: 'var(--warning-text)' };
      case 4:
        return { label: 'Strong', className: 'active-strong', color: 'var(--success-text)' };
      default:
        return { label: '', className: '', color: '' };
    }
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter your confirmation password.');
      return;
    }

    if (!agreeTerms) {
      setError('Please acknowledge the Terms of Service and emergency coordination consent to continue.');
      return;
    }

    setLoading(true);
    try {
      // Public registration creates a secure PATIENT role account
      const { token, user } = await api.register({
        name: name.trim(),
        email: email.trim(),
        password,
        phone: phone.trim() || undefined,
      });

      // Save optional emergency medical profile metadata locally
      if (bloodGroup) {
        try {
          localStorage.setItem(`medilink_patient_blood_group_${user.user_id}`, bloodGroup);
          localStorage.setItem('medilink_patient_blood_group', bloodGroup);
        } catch {
          // ignore localStorage failure in private browsing
        }
      }

      login(token, user);

      const redirectPath = searchParams.get('redirect');
      if (redirectPath && redirectPath.startsWith('/')) {
        navigate(redirectPath);
      } else {
        navigate('/patient');
      }
    } catch (err) {
      setError(err.message || 'Failed to create account. Please verify your details.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page auth-page">
      <div className="card auth-card auth-card-wide">
        {/* Header */}
        <div className="auth-card-header text-center">
          <div className="brand-logo" style={{ justifyContent: 'center', marginBottom: '0.5rem' }}>
            <span className="brand-icon" aria-hidden="true">✚</span>
            <span className="brand-text">MediLink</span>
          </div>

          <div className="auth-header-badge">
            <span>🛡️ Centralized Healthcare Dispatch Network</span>
          </div>

          <h2>{activeTab === 'patient' ? 'Create Patient Account' : 'Healthcare Provider & Fleet Access'}</h2>
          <p className="muted" style={{ maxWidth: '480px', margin: '0 auto' }}>
            {activeTab === 'patient'
              ? 'Instant public registration for patients and families to access verified emergency beds, ambulance dispatch, and blood units.'
              : 'Institutional access for hospital staff, ambulance owners, blood banks, and health authorities.'}
          </p>
        </div>

        {/* Role Selector Tabs */}
        <div className="auth-role-tabs" role="tablist">
          <button
            type="button"
            className={`auth-role-tab ${activeTab === 'patient' ? 'active' : ''}`}
            onClick={() => setActiveTab('patient')}
            role="tab"
            aria-selected={activeTab === 'patient'}
          >
            <span>👤 Patient Registration</span>
          </button>
          <button
            type="button"
            className={`auth-role-tab ${activeTab === 'staff' ? 'active' : ''}`}
            onClick={() => setActiveTab('staff')}
            role="tab"
            aria-selected={activeTab === 'staff'}
          >
            <span>🏢 Staff & Fleet Portal</span>
          </button>
        </div>

        {/* TAB 1: PATIENT REGISTRATION FORM */}
        {activeTab === 'patient' && (
          <>
            {error && (
              <div className="alert alert-danger" role="alert" style={{ marginBottom: '14px' }}>
                <span>{error}</span>
              </div>
            )}

            <form className="auth-form" onSubmit={handleSubmit}>
              <div className="form-row-2col">
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
              </div>

              <div className="form-row-2col">
                <FormField
                  label="Phone Number"
                  id="reg-phone"
                  hint="For SMS emergency dispatch updates"
                >
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

                <FormField
                  label="Blood Group (Optional)"
                  id="reg-blood"
                  hint="Pre-fills emergency blood matching"
                >
                  <select
                    id="reg-blood"
                    className="form-input"
                    value={bloodGroup}
                    onChange={(e) => setBloodGroup(e.target.value)}
                  >
                    <option value="">Select blood group (optional)</option>
                    {BLOOD_GROUPS.map((grp) => (
                      <option key={grp} value={grp}>
                        Group {grp}
                      </option>
                    ))}
                  </select>
                </FormField>
              </div>

              {/* Password Field with Strength Meter */}
              <FormField
                label="Password"
                id="reg-password"
                required
                hint="Minimum 8 characters"
              >
                <div className="password-input-wrap">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="reg-password"
                    className="form-input"
                    placeholder="Create a strong password"
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

                {password.length > 0 && (
                  <div className="password-meter-wrap">
                    <div className="password-meter-bars">
                      {[1, 2, 3, 4].map((step) => (
                        <div
                          key={step}
                          className={`password-meter-segment ${
                            passwordScore >= step ? getStrengthMeta().className : ''
                          }`}
                        />
                      ))}
                    </div>
                    <div className="password-meter-header">
                      <span>Password strength:</span>
                      <strong style={{ color: getStrengthMeta().color }}>
                        {getStrengthMeta().label}
                      </strong>
                    </div>

                    <div className="password-reqs-list">
                      <span className={`password-req-item ${passwordCriteria.length ? 'met' : ''}`}>
                        {passwordCriteria.length ? '✓' : '•'} 8+ characters
                      </span>
                      <span className={`password-req-item ${passwordCriteria.hasNumber ? 'met' : ''}`}>
                        {passwordCriteria.hasNumber ? '✓' : '•'} Number (0-9)
                      </span>
                      <span className={`password-req-item ${passwordCriteria.hasMixedCase ? 'met' : ''}`}>
                        {passwordCriteria.hasMixedCase ? '✓' : '•'} Upper & lowercase
                      </span>
                    </div>
                  </div>
                )}
              </FormField>

              {/* Confirm Password Field with Match Validation */}
              <FormField label="Confirm Password" id="reg-confirm-password" required>
                <div className="password-input-wrap">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    id="reg-confirm-password"
                    className="form-input"
                    placeholder="Re-enter your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="btn-toggle-pw"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? 'Hide' : 'Show'}
                  </button>
                </div>

                {confirmPassword.length > 0 && (
                  <div className={`match-feedback ${passwordMatch ? 'matched' : 'unmatched'}`}>
                    {passwordMatch ? (
                      <span>✓ Passwords match</span>
                    ) : (
                      <span>✗ Passwords do not match</span>
                    )}
                  </div>
                )}
              </FormField>

              {/* Healthcare & Privacy Consent */}
              <label className="auth-consent-wrap">
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  required
                />
                <span>
                  I agree to MediLink's Terms of Service and consent to emergency medical triage and
                  GPS coordination for ambulance routing.
                </span>
              </label>

              <Button
                variant="primary"
                type="submit"
                size="lg"
                loading={loading}
                className="full-width"
                style={{ marginTop: '0.5rem' }}
                disabled={password.length < 8 || password !== confirmPassword || !agreeTerms}
              >
                Create Patient Account
              </Button>
            </form>

            {/* Trust and Feature Strip */}
            <div className="auth-trust-strip">
              <span className="auth-trust-item">🔒 256-Bit Encrypted</span>
              <span className="auth-trust-item">⚡ 24/7 Nearest Dispatch</span>
              <span className="auth-trust-item">🏥 Verified Bed Registry</span>
            </div>
          </>
        )}

        {/* TAB 2: STAFF & PROVIDER ONBOARDING GUIDE */}
        {activeTab === 'staff' && (
          <div className="staff-portal-panel">
            <div className="staff-provision-banner">
              <span className="icon" aria-hidden="true">🛡️</span>
              <div>
                <h4>Institutional Staff & Fleet Verification</h4>
                <p>
                  To protect emergency healthcare integrity, hospital beds, ambulance dispatch sirens,
                  and blood unit custody cannot be operated via public self-signup. All provider
                  accounts are provisioned by accredited administrators and linked to licensed facilities.
                </p>
              </div>
            </div>

            <div className="staff-roles-grid">
              {ROLE_DEFINITIONS.filter((r) => r.role !== 'PATIENT').map((role) => (
                <div key={role.role} className="staff-role-card">
                  <div>
                    <div className="staff-role-header">
                      <div className="staff-role-title">
                        <span>{role.icon}</span>
                        <span>{role.title}</span>
                      </div>
                      <Badge variant={role.badgeVariant} size="sm">
                        {role.role}
                      </Badge>
                    </div>

                    <p className="staff-role-desc">{role.summary}</p>

                    <ul className="staff-role-features">
                      {role.responsibilities.slice(0, 2).map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  <Link
                    to={`/login?role=${role.role.toLowerCase()}`}
                    className="staff-role-link-btn"
                  >
                    Sign in to {role.title} →
                  </Link>
                </div>
              ))}
            </div>

            <div className="staff-cta-bar">
              <Button
                variant="primary"
                size="lg"
                className="full-width"
                onClick={() => navigate('/login')}
              >
                Go to Staff Portal Login
              </Button>
            </div>
          </div>
        )}

        {/* Shared Bottom Links */}
        <div className="role-guide-btn-wrap">
          <button
            type="button"
            className="role-guide-toggle-btn"
            onClick={() => setShowRoleModal(true)}
          >
            <span>📖 What does each role do? View Complete Role & Permission Matrix</span>
          </button>
        </div>

        <p className="auth-switch-text text-center" style={{ marginTop: '12px' }}>
          Already have an account? <Link to="/login">Sign in here</Link>
        </p>
      </div>

      {/* COMPREHENSIVE ROLE & PERMISSIONS MATRIX MODAL */}
      <Modal
        isOpen={showRoleModal}
        onClose={() => setShowRoleModal(false)}
        title="MediLink System Roles & Permissions Guide"
        maxWidth="740px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
            <Button variant="primary" onClick={() => setShowRoleModal(false)}>
              Close Guide
            </Button>
          </div>
        }
      >
        <p className="muted" style={{ marginBottom: '16px', fontSize: '0.85rem' }}>
          MediLink is structured into 5 specialized roles to ensure swift coordination between
          citizens, emergency clinical teams, vehicle operators, and regional blood reserves.
        </p>

        {/* Role Comparison Table */}
        <div className="role-matrix-table-wrap">
          <table className="role-matrix-table">
            <thead>
              <tr>
                <th>Capability / Feature</th>
                <th>Patient</th>
                <th>Hospital Staff</th>
                <th>Ambulance Owner</th>
                <th>Blood Bank</th>
                <th>Super Admin</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Public Self-Registration</strong></td>
                <td><span className="role-check">✅ Yes</span></td>
                <td><span className="role-dash">— Admin</span></td>
                <td><span className="role-dash">— Fleet</span></td>
                <td><span className="role-dash">— Admin</span></td>
                <td><span className="role-dash">— Root</span></td>
              </tr>
              <tr>
                <td><strong>Discover Hospitals & Leaflet Map</strong></td>
                <td><span className="role-check">✅</span></td>
                <td><span className="role-check">✅</span></td>
                <td><span className="role-check">✅</span></td>
                <td><span className="role-check">✅</span></td>
                <td><span className="role-check">✅</span></td>
              </tr>
              <tr>
                <td><strong>Transparent Algorithmic Scoring</strong></td>
                <td><span className="role-check">✅</span></td>
                <td><span className="role-dash">—</span></td>
                <td><span className="role-dash">—</span></td>
                <td><span className="role-dash">—</span></td>
                <td><span className="role-check">✅</span></td>
              </tr>
              <tr>
                <td><strong>Emergency Admission Requests</strong></td>
                <td><span className="role-check">✅ Request</span></td>
                <td><span className="role-check">✅ Triage/Accept</span></td>
                <td><span className="role-dash">—</span></td>
                <td><span className="role-dash">—</span></td>
                <td><span className="role-check">✅ Oversee</span></td>
              </tr>
              <tr>
                <td><strong>Bed & ICU Stepper Inventory</strong></td>
                <td><span className="role-dash">— View only</span></td>
                <td><span className="role-check">✅ Edit Beds/ICU</span></td>
                <td><span className="role-dash">—</span></td>
                <td><span className="role-dash">—</span></td>
                <td><span className="role-check">✅ Manage all</span></td>
              </tr>
              <tr>
                <td><strong>Nearest Ambulance Dispatch</strong></td>
                <td><span className="role-check">✅ Book</span></td>
                <td><span className="role-dash">—</span></td>
                <td><span className="role-check">✅ Accept & Drive</span></td>
                <td><span className="role-dash">—</span></td>
                <td><span className="role-check">✅ Fleet Map</span></td>
              </tr>
              <tr>
                <td><strong>Live GPS Coordinates Broadcast</strong></td>
                <td><span className="role-dash">— Track only</span></td>
                <td><span className="role-dash">—</span></td>
                <td><span className="role-check">✅ Stream GPS</span></td>
                <td><span className="role-dash">—</span></td>
                <td><span className="role-check">✅ All vehicles</span></td>
              </tr>
              <tr>
                <td><strong>Blood Bank Inventory (8 Groups)</strong></td>
                <td><span className="role-dash">— Search stock</span></td>
                <td><span className="role-dash">—</span></td>
                <td><span className="role-dash">—</span></td>
                <td><span className="role-check">✅ Update counts</span></td>
                <td><span className="role-check">✅ View all</span></td>
              </tr>
              <tr>
                <td><strong>Blood Unit Hold & Dispensation</strong></td>
                <td><span className="role-check">✅ Reserve unit</span></td>
                <td><span className="role-dash">—</span></td>
                <td><span className="role-dash">—</span></td>
                <td><span className="role-check">✅ Approve/Fulfill</span></td>
                <td><span className="role-check">✅ Global audit</span></td>
              </tr>
              <tr>
                <td><strong>Staff Provisioning & Management</strong></td>
                <td><span className="role-dash">—</span></td>
                <td><span className="role-dash">—</span></td>
                <td><span className="role-dash">—</span></td>
                <td><span className="role-dash">—</span></td>
                <td><span className="role-check">✅ Create & Link</span></td>
              </tr>
              <tr>
                <td><strong>Immutable Audit Trail Stream</strong></td>
                <td><span className="role-dash">—</span></td>
                <td><span className="role-dash">—</span></td>
                <td><span className="role-dash">—</span></td>
                <td><span className="role-dash">—</span></td>
                <td><span className="role-check">✅ Complete Log</span></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Detailed Role Breakdown Cards */}
        <h4 style={{ margin: '18px 0 10px 0', fontSize: '0.95rem' }}>Detailed Role Breakdown</h4>

        {ROLE_DEFINITIONS.map((r) => (
          <div key={r.role} className="role-summary-card">
            <h4>
              {r.icon} {r.title} ({r.role})
            </h4>
            <p><strong>Primary Function:</strong> {r.summary}</p>
            <p style={{ marginTop: '4px' }}><strong>How It Gets Created:</strong> {r.accountType}</p>
          </div>
        ))}
      </Modal>
    </div>
  );
}

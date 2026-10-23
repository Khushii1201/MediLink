import { useEffect, useState, useMemo, useCallback } from 'react';
import { api } from '../api';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import Card from '../components/Card';
import Button from '../components/Button';
import Badge from '../components/Badge';
import Modal from '../components/Modal';
import Tabs from '../components/Tabs';
import StatCard from '../components/StatCard';
import FormField from '../components/FormField';
import EmptyState from '../components/EmptyState';
import Spinner from '../components/Spinner';

export default function AdminDashboard() {
  const { user: currentUser } = useAuth();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  // Data states
  const [analytics, setAnalytics] = useState(null);
  const [users, setUsers] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [ambulances, setAmbulances] = useState([]);
  const [bloodBanks, setBloodBanks] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);

  // Modals & form states
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [staffForm, setStaffForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    role: 'HOSPITAL',
    hospital_id: '',
    ambulance_id: '',
    bloodbank_id: '',
  });

  const [showHospitalModal, setShowHospitalModal] = useState(false);
  const [editingHospital, setEditingHospital] = useState(null);
  const [hospitalForm, setHospitalForm] = useState({
    name: '',
    address: '',
    city: 'New Delhi',
    latitude: '28.6139',
    longitude: '77.2090',
    phone: '',
    email: '',
    description: '',
    specialties: 'General Medicine, Emergency',
  });

  const [showAmbulanceModal, setShowAmbulanceModal] = useState(false);
  const [ambulanceForm, setAmbulanceForm] = useState({
    vehicle_no: '',
    driver_name: '',
    driver_phone: '',
    latitude: '28.6139',
    longitude: '77.2090',
  });

  const [showBankModal, setShowBankModal] = useState(false);
  const [bankForm, setBankForm] = useState({
    name: '',
    address: '',
    city: 'New Delhi',
    latitude: '28.6139',
    longitude: '77.2090',
    phone: '',
  });

  // Filters
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('ALL');
  const [auditEntityFilter, setAuditEntityFilter] = useState('ALL');
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [anData, uData, hData, aData, bData, auditData] = await Promise.all([
        api.adminAnalytics().catch(() => null),
        api.adminUsers().catch(() => []),
        api.searchHospitals({}).catch(() => []),
        api.listAmbulances().catch(() => []),
        api.listBloodBanks().catch(() => []),
        api.adminAuditLogs({ limit: 100 }).catch(() => []),
      ]);
      setAnalytics(anData);
      setUsers(uData);
      setHospitals(hData);
      setAmbulances(aData);
      setBloodBanks(bData);
      setAuditLogs(auditData);
    } catch (err) {
      showToast(err.message || 'Failed to load admin data', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const anomaliesList = analytics?.anomalies || [];

  const tabs = [
    { id: 'overview', label: 'System Overview' },
    { id: 'anomalies', label: `Alerts (${anomaliesList.length})` },
    { id: 'users', label: `Users (${users.length})` },
    { id: 'hospitals', label: `Hospitals (${hospitals.length})` },
    { id: 'ambulances', label: `Ambulances (${ambulances.length})` },
    { id: 'blood_banks', label: `Blood Banks (${bloodBanks.length})` },
    { id: 'audit', label: 'Audit Trail' },
  ];

  // Helper mappings
  const hospitalMap = useMemo(() => new Map(hospitals.map((h) => [h.hospital_id, h.name])), [hospitals]);
  const ambulanceMap = useMemo(() => new Map(ambulances.map((a) => [a.ambulance_id, a.vehicle_no])), [ambulances]);
  const bloodBankMap = useMemo(() => new Map(bloodBanks.map((b) => [b.bloodbank_id, b.name])), [bloodBanks]);

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchSearch =
        u.name?.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.email?.toLowerCase().includes(userSearch.toLowerCase());
      const matchRole = userRoleFilter === 'ALL' || u.role === userRoleFilter;
      return matchSearch && matchRole;
    });
  }, [users, userSearch, userRoleFilter]);

  // Filtered audit logs
  const filteredAudit = useMemo(() => {
    if (auditEntityFilter === 'ALL') return auditLogs;
    return auditLogs.filter((log) => log.entity === auditEntityFilter);
  }, [auditLogs, auditEntityFilter]);

  // Actions: User Management
  const handleToggleUserStatus = async (user) => {
    if (user.user_id === currentUser?.user_id) {
      showToast('You cannot deactivate your own administrative account', 'error');
      return;
    }
    const willDeactivate = user.active === 1;
    if (!window.confirm(`Are you sure you want to ${willDeactivate ? 'deactivate' : 'reactivate'} ${user.name}?`)) {
      return;
    }
    try {
      if (willDeactivate) {
        await api.adminDeactivateUser(user.user_id);
        showToast(`User ${user.name} deactivated`, 'info');
      } else {
        await api.adminReactivateUser(user.user_id);
        showToast(`User ${user.name} reactivated`, 'success');
      }
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleCreateStaff = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.adminCreateUser({
        name: staffForm.name,
        email: staffForm.email,
        password: staffForm.password,
        phone: staffForm.phone || null,
        role: staffForm.role,
        hospital_id: staffForm.role === 'HOSPITAL' ? Number(staffForm.hospital_id) : null,
        ambulance_id: staffForm.role === 'AMBULANCE' ? Number(staffForm.ambulance_id) : null,
        bloodbank_id: staffForm.role === 'BLOODBANK' ? Number(staffForm.bloodbank_id) : null,
      });
      showToast('Staff user provisioned successfully', 'success');
      setShowStaffModal(false);
      setStaffForm({
        name: '',
        email: '',
        password: '',
        phone: '',
        role: 'HOSPITAL',
        hospital_id: '',
        ambulance_id: '',
        bloodbank_id: '',
      });
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  // Actions: Hospital
  const handleSaveHospital = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: hospitalForm.name,
        address: hospitalForm.address,
        city: hospitalForm.city,
        latitude: Number(hospitalForm.latitude),
        longitude: Number(hospitalForm.longitude),
        phone: hospitalForm.phone || null,
        email: hospitalForm.email || null,
        description: hospitalForm.description || null,
        specialties: hospitalForm.specialties || '',
      };
      if (editingHospital) {
        await api.updateHospitalProfile(editingHospital.hospital_id, payload);
        showToast('Hospital updated successfully', 'success');
      } else {
        await api.createHospital(payload);
        showToast('Hospital created successfully', 'success');
      }
      setShowHospitalModal(false);
      setEditingHospital(null);
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteHospital = async (hospital) => {
    if (!window.confirm(`Delete ${hospital.name}? This will remove associated resources, doctors, and waiting times.`)) {
      return;
    }
    try {
      await api.deleteHospital(hospital.hospital_id);
      showToast('Hospital deleted', 'info');
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Actions: Ambulance
  const handleSaveAmbulance = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.createAmbulance({
        vehicle_no: ambulanceForm.vehicle_no,
        driver_name: ambulanceForm.driver_name,
        driver_phone: ambulanceForm.driver_phone,
        latitude: ambulanceForm.latitude ? Number(ambulanceForm.latitude) : null,
        longitude: ambulanceForm.longitude ? Number(ambulanceForm.longitude) : null,
      });
      showToast('Ambulance created successfully', 'success');
      setShowAmbulanceModal(false);
      setAmbulanceForm({
        vehicle_no: '',
        driver_name: '',
        driver_phone: '',
        latitude: '28.6139',
        longitude: '77.2090',
      });
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAmbulance = async (amb) => {
    if (!window.confirm(`Delete ambulance ${amb.vehicle_no}?`)) return;
    try {
      await api.adminDeleteAmbulance(amb.ambulance_id);
      showToast('Ambulance deleted', 'info');
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Actions: Blood Bank
  const handleSaveBank = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.createBloodBank({
        name: bankForm.name,
        address: bankForm.address,
        city: bankForm.city,
        latitude: bankForm.latitude ? Number(bankForm.latitude) : null,
        longitude: bankForm.longitude ? Number(bankForm.longitude) : null,
        phone: bankForm.phone || null,
      });
      showToast('Blood bank created successfully', 'success');
      setShowBankModal(false);
      setBankForm({
        name: '',
        address: '',
        city: 'New Delhi',
        latitude: '28.6139',
        longitude: '77.2090',
        phone: '',
      });
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBank = async (bank) => {
    if (!window.confirm(`Delete blood bank ${bank.name}? Associated blood units will be removed.`)) return;
    try {
      await api.adminDeleteBloodBank(bank.bloodbank_id);
      showToast('Blood bank deleted', 'info');
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  if (loading && !analytics) {
    return (
      <div className="container" style={{ padding: '60px 0', textAlign: 'center' }}>
        <Spinner size="lg" message="Loading administrative dashboard..." />
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: '32px 0 64px' }}>
      {/* Header */}
      <div className="flex-between" style={{ marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: 0, color: 'var(--color-text)' }}>
            System Administration
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--color-text-secondary)', fontSize: '0.95rem' }}>
            Coordinate regional network resources, provision staff accounts, and monitor audit trails.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button variant="secondary" onClick={loadData}>Refresh Data</Button>
          <Button variant="primary" onClick={() => setShowStaffModal(true)}>+ Provision Staff</Button>
        </div>
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && analytics && (
        <div style={{ display: 'grid', gap: '24px' }}>
          {/* KPI grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <StatCard label="Registered Users" value={analytics.totals.users} subtext="Patients and healthcare staff" />
            <StatCard label="Active Hospitals" value={analytics.totals.hospitals} subtext="Partnered care facilities" />
            <StatCard
              label="Fleet Utilisation"
              value={`${analytics.ambulanceUtilisation?.utilisation_pct || 0}%`}
              subtext={`${analytics.ambulanceUtilisation?.on_trip || 0} / ${analytics.totals.ambulances} on active trips`}
            />
            <StatCard
              label="Open Admissions"
              value={analytics.totals.open_admissions}
              subtext="Pending or accepted requests"
            />
            <StatCard
              label="Low Blood Stock"
              value={analytics.lowStockBlood?.length || 0}
              subtext="Stock items with < 5 units"
            />
          </div>

          {/* Charts Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '20px' }}>
            {/* Hospital Bed Occupancy SVG Chart */}
            <Card title="Hospital Bed Capacity & Occupancy">
              {analytics.bedOccupancy && analytics.bedOccupancy.length > 0 ? (
                <div style={{ display: 'grid', gap: '12px' }}>
                  {analytics.bedOccupancy.slice(0, 8).map((b, idx) => {
                    const occPct = Math.min(100, Math.max(0, b.occupancy_pct || 0));
                    return (
                      <div key={idx} style={{ fontSize: '0.875rem' }}>
                        <div className="flex-between" style={{ marginBottom: '4px' }}>
                          <span style={{ fontWeight: 600 }}>{b.hospital_name} ({b.type})</span>
                          <span style={{ color: 'var(--color-text-secondary)' }}>
                            {b.available} free / {b.total} total ({occPct}%)
                          </span>
                        </div>
                        <div style={{ height: '8px', background: 'var(--color-border)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${occPct}%`,
                              height: '100%',
                              backgroundColor: occPct > 85 ? 'var(--color-danger)' : occPct > 60 ? 'var(--color-warning)' : 'var(--color-primary)',
                              transition: 'width 0.4s ease',
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState title="No occupancy data available" />
              )}
            </Card>

            {/* Waiting Times & Role Breakdown */}
            <Card title="Emergency Waiting Times (Average)">
              {analytics.avgWaitByHospital && analytics.avgWaitByHospital.length > 0 ? (
                <div style={{ display: 'grid', gap: '12px' }}>
                  {analytics.avgWaitByHospital.map((item, idx) => (
                    <div key={idx} className="flex-between" style={{ padding: '8px 12px', background: 'var(--color-surface)', borderRadius: 'var(--radius-sm)' }}>
                      <span style={{ fontWeight: 500 }}>{item.hospital_name}</span>
                      <Badge variant={item.avg_minutes > 45 ? 'danger' : item.avg_minutes > 25 ? 'warning' : 'success'}>
                        {item.avg_minutes} mins avg
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title="No waiting time data available" />
              )}
            </Card>
          </div>

          {/* Breakdown cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
            <Card title="Admissions by Status">
              <div style={{ display: 'grid', gap: '8px' }}>
                {analytics.admissionsByStatus?.map((s) => (
                  <div key={s.status} className="flex-between" style={{ padding: '6px 0', borderBottom: '1px solid var(--color-border)' }}>
                    <Badge variant={s.status === 'COMPLETED' ? 'success' : s.status === 'PENDING' ? 'warning' : 'neutral'}>
                      {s.status}
                    </Badge>
                    <span style={{ fontWeight: 700 }}>{s.count}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card title="Ambulance Requests by Status">
              <div style={{ display: 'grid', gap: '8px' }}>
                {analytics.ambulanceRequestsByStatus?.map((s) => (
                  <div key={s.status} className="flex-between" style={{ padding: '6px 0', borderBottom: '1px solid var(--color-border)' }}>
                    <Badge variant={s.status === 'COMPLETED' ? 'success' : s.status === 'EN_ROUTE' ? 'primary' : 'neutral'}>
                      {s.status}
                    </Badge>
                    <span style={{ fontWeight: 700 }}>{s.count}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card title="Users by Role">
              <div style={{ display: 'grid', gap: '8px' }}>
                {analytics.usersByRole?.map((r) => (
                  <div key={r.role} className="flex-between" style={{ padding: '6px 0', borderBottom: '1px solid var(--color-border)' }}>
                    <span style={{ fontWeight: 500 }}>{r.role}</span>
                    <Badge variant="neutral">{r.count} accounts</Badge>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* TAB: ANOMALIES & OPERATIONAL ALERTS */}
      {activeTab === 'anomalies' && (
        <Card title={`Operational Anomaly & Bottleneck Alerts (${anomaliesList.length})`}>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: '16px', fontSize: '0.875rem' }}>
            Automated rule-based detection engine monitoring inventory consistency, prolonged queues, and vehicle fleet anomalies in real time.
          </p>
          {anomaliesList.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>✓</div>
              <strong>No operational anomalies detected</strong>
              <p style={{ margin: '4px 0 0', fontSize: '0.85rem' }}>All resource counts, bed allocations, dispatch queues, and blood reserves are operating within normal thresholds.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '12px' }}>
              {anomaliesList.map((a) => (
                <div
                  key={a.id}
                  style={{
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '12px 16px',
                    borderLeft: `4px solid ${
                      a.severity === 'CRITICAL' ? 'var(--color-danger)' :
                      a.severity === 'HIGH' ? 'var(--color-warning)' : 'var(--color-primary)'
                    }`,
                    backgroundColor: 'var(--color-surface)',
                  }}
                >
                  <div className="flex-between" style={{ marginBottom: '6px' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <Badge
                        status={a.severity === 'CRITICAL' ? 'CRITICAL' : a.severity === 'HIGH' ? 'MEDIUM' : 'LOW'}
                        label={a.severity}
                        size="sm"
                      />
                      <strong style={{ fontSize: '0.9rem' }}>{a.alert_type}</strong>
                    </div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                      Entity: {a.entity} #{a.entity_id}
                    </span>
                  </div>
                  <p style={{ margin: '0 0 6px 0', fontSize: '0.875rem' }}>{a.explanation}</p>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-primary)', fontWeight: 600 }}>
                    Recommended Action: {a.suggested_action}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* TAB 2: USERS */}
      {activeTab === 'users' && (
        <Card>
          <div className="flex-between" style={{ marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '12px', flex: 1, minWidth: '280px' }}>
              <input
                type="text"
                placeholder="Search by name or email..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                style={{ flex: 1, padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}
              />
              <select
                value={userRoleFilter}
                onChange={(e) => setUserRoleFilter(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}
              >
                <option value="ALL">All Roles</option>
                <option value="PATIENT">Patient</option>
                <option value="HOSPITAL">Hospital Staff</option>
                <option value="AMBULANCE">Ambulance Operator</option>
                <option value="BLOODBANK">Blood Bank</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
            <Button variant="primary" onClick={() => setShowStaffModal(true)}>+ Provision Staff</Button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                  <th style={{ padding: '10px 12px' }}>Name / Email</th>
                  <th style={{ padding: '10px 12px' }}>Role</th>
                  <th style={{ padding: '10px 12px' }}>Linked Facility</th>
                  <th style={{ padding: '10px 12px' }}>Status</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ padding: '24px', textAlign: 'center' }}>No users found</td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    let linkedName = '—';
                    if (u.role === 'HOSPITAL' && u.hospital_id) linkedName = hospitalMap.get(u.hospital_id) || `ID #${u.hospital_id}`;
                    if (u.role === 'AMBULANCE' && u.ambulance_id) linkedName = ambulanceMap.get(u.ambulance_id) || `ID #${u.ambulance_id}`;
                    if (u.role === 'BLOODBANK' && u.bloodbank_id) linkedName = bloodBankMap.get(u.bloodbank_id) || `ID #${u.bloodbank_id}`;

                    const isSelf = u.user_id === currentUser?.user_id;

                    return (
                      <tr key={u.user_id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ fontWeight: 600 }}>{u.name} {isSelf && <span style={{ color: 'var(--color-primary)' }}>(You)</span>}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>{u.email}</div>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <Badge variant={u.role === 'ADMIN' ? 'primary' : u.role === 'PATIENT' ? 'neutral' : 'info'}>
                            {u.role}
                          </Badge>
                        </td>
                        <td style={{ padding: '10px 12px', color: 'var(--color-text-secondary)' }}>
                          {linkedName}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <Badge variant={u.active ? 'success' : 'danger'}>
                            {u.active ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                          {!isSelf && (
                            <Button
                              variant={u.active ? 'danger' : 'secondary'}
                              size="sm"
                              onClick={() => handleToggleUserStatus(u)}
                            >
                              {u.active ? 'Deactivate' : 'Reactivate'}
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 3: HOSPITALS */}
      {activeTab === 'hospitals' && (
        <Card>
          <div className="flex-between" style={{ marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Hospital Facilities Directory</h3>
            <Button
              variant="primary"
              onClick={() => {
                setEditingHospital(null);
                setHospitalForm({
                  name: '',
                  address: '',
                  city: 'New Delhi',
                  latitude: '28.6139',
                  longitude: '77.2090',
                  phone: '',
                  email: '',
                  description: '',
                  specialties: 'General Medicine, Emergency',
                });
                setShowHospitalModal(true);
              }}
            >
              + Add Hospital
            </Button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                  <th style={{ padding: '10px 12px' }}>Hospital</th>
                  <th style={{ padding: '10px 12px' }}>Location</th>
                  <th style={{ padding: '10px 12px' }}>Contact</th>
                  <th style={{ padding: '10px 12px' }}>Specialties</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {hospitals.map((h) => (
                  <tr key={h.hospital_id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontWeight: 600 }}>{h.name}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                        {h.available_beds ?? 0} free beds • {h.doctor_count ?? 0} doctors
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--color-text-secondary)' }}>
                      {h.address}, {h.city}
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: '0.85rem' }}>
                      <div>{h.phone || '—'}</div>
                      <div style={{ color: 'var(--color-text-secondary)' }}>{h.email || '—'}</div>
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: '0.85rem' }}>
                      {h.specialties || 'General'}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setEditingHospital(h);
                            setHospitalForm({
                              name: h.name,
                              address: h.address,
                              city: h.city,
                              latitude: String(h.latitude),
                              longitude: String(h.longitude),
                              phone: h.phone || '',
                              email: h.email || '',
                              description: h.description || '',
                              specialties: h.specialties || '',
                            });
                            setShowHospitalModal(true);
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleDeleteHospital(h)}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 4: AMBULANCES */}
      {activeTab === 'ambulances' && (
        <Card>
          <div className="flex-between" style={{ marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Ambulance Fleet Directory</h3>
            <Button variant="primary" onClick={() => setShowAmbulanceModal(true)}>+ Add Ambulance</Button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                  <th style={{ padding: '10px 12px' }}>Vehicle Number</th>
                  <th style={{ padding: '10px 12px' }}>Driver</th>
                  <th style={{ padding: '10px 12px' }}>Status</th>
                  <th style={{ padding: '10px 12px' }}>Coordinates</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {ambulances.map((a) => (
                  <tr key={a.ambulance_id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{a.vehicle_no}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <div>{a.driver_name || 'Unassigned'}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>{a.driver_phone || '—'}</div>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <Badge variant={a.status === 'AVAILABLE' ? 'success' : a.status === 'ON_TRIP' ? 'warning' : 'neutral'}>
                        {a.status}
                      </Badge>
                    </td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                      {a.latitude ? `${Number(a.latitude).toFixed(4)}, ${Number(a.longitude).toFixed(4)}` : 'No GPS'}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      <Button variant="danger" size="sm" onClick={() => handleDeleteAmbulance(a)}>
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 5: BLOOD BANKS */}
      {activeTab === 'blood_banks' && (
        <Card>
          <div className="flex-between" style={{ marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Regional Blood Bank Network</h3>
            <Button variant="primary" onClick={() => setShowBankModal(true)}>+ Add Blood Bank</Button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                  <th style={{ padding: '10px 12px' }}>Name</th>
                  <th style={{ padding: '10px 12px' }}>Address</th>
                  <th style={{ padding: '10px 12px' }}>Phone</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {bloodBanks.map((b) => (
                  <tr key={b.bloodbank_id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{b.name}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--color-text-secondary)' }}>
                      {b.address}, {b.city}
                    </td>
                    <td style={{ padding: '10px 12px' }}>{b.phone || '—'}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      <Button variant="danger" size="sm" onClick={() => handleDeleteBank(b)}>
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 6: AUDIT TRAIL */}
      {activeTab === 'audit' && (
        <Card>
          <div className="flex-between" style={{ marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem' }}>System Audit Trail</h3>
              <p style={{ margin: '4px 0 0', color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
                Immutable event stream of security-relevant and resource status updates
              </p>
            </div>
            <select
              value={auditEntityFilter}
              onChange={(e) => setAuditEntityFilter(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}
            >
              <option value="ALL">All Entities</option>
              <option value="admissions">Admissions</option>
              <option value="ambulance_requests">Ambulances</option>
              <option value="reservations">Blood Reservations</option>
              <option value="hospitals">Hospitals</option>
              <option value="users">Users</option>
            </select>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                  <th style={{ padding: '8px 10px' }}>Timestamp</th>
                  <th style={{ padding: '8px 10px' }}>Actor</th>
                  <th style={{ padding: '8px 10px' }}>Action</th>
                  <th style={{ padding: '8px 10px' }}>Target</th>
                  <th style={{ padding: '8px 10px' }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {filteredAudit.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ padding: '24px', textAlign: 'center' }}>No audit records found</td>
                  </tr>
                ) : (
                  filteredAudit.map((log) => (
                    <tr key={log.log_id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '8px 10px', whiteSpace: 'nowrap', color: 'var(--color-text-secondary)' }}>
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        <div style={{ fontWeight: 600 }}>{log.user_name || 'System / Guest'}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>{log.user_email}</div>
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        <Badge variant="neutral">{log.action}</Badge>
                      </td>
                      <td style={{ padding: '8px 10px', textTransform: 'capitalize' }}>
                        {log.entity} #{log.entity_id}
                      </td>
                      <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontSize: '0.75rem', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {typeof log.details === 'object' ? JSON.stringify(log.details) : log.details || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* MODAL: PROVISION STAFF USER */}
      <Modal
        isOpen={showStaffModal}
        onClose={() => setShowStaffModal(false)}
        title="Provision Staff Account"
      >
        <form onSubmit={handleCreateStaff} style={{ display: 'grid', gap: '14px' }}>
          <FormField label="Full Name" required>
            <input
              type="text"
              required
              value={staffForm.name}
              onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
              placeholder="e.g., Dr. Ramesh Sharma"
            />
          </FormField>
          <FormField label="Email Address" required>
            <input
              type="email"
              required
              value={staffForm.email}
              onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
              placeholder="staff@medilink.org"
            />
          </FormField>
          <FormField label="Temporary Password" required helper="Must be at least 8 characters">
            <input
              type="password"
              required
              minLength={8}
              value={staffForm.password}
              onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })}
            />
          </FormField>
          <FormField label="Contact Phone">
            <input
              type="tel"
              value={staffForm.phone}
              onChange={(e) => setStaffForm({ ...staffForm, phone: e.target.value })}
              placeholder="+91 98765 43210"
            />
          </FormField>
          <FormField label="Assigned Role" required>
            <select
              value={staffForm.role}
              onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value })}
            >
              <option value="HOSPITAL">Hospital Staff</option>
              <option value="AMBULANCE">Ambulance Operator</option>
              <option value="BLOODBANK">Blood Bank Manager</option>
              <option value="ADMIN">System Administrator</option>
            </select>
          </FormField>

          {/* Conditional Entity Pickers */}
          {staffForm.role === 'HOSPITAL' && (
            <FormField label="Select Hospital" required>
              <select
                required
                value={staffForm.hospital_id}
                onChange={(e) => setStaffForm({ ...staffForm, hospital_id: e.target.value })}
              >
                <option value="">— Select Hospital —</option>
                {hospitals.map((h) => (
                  <option key={h.hospital_id} value={h.hospital_id}>{h.name}</option>
                ))}
              </select>
            </FormField>
          )}

          {staffForm.role === 'AMBULANCE' && (
            <FormField label="Select Ambulance" required>
              <select
                required
                value={staffForm.ambulance_id}
                onChange={(e) => setStaffForm({ ...staffForm, ambulance_id: e.target.value })}
              >
                <option value="">— Select Ambulance Vehicle —</option>
                {ambulances.map((a) => (
                  <option key={a.ambulance_id} value={a.ambulance_id}>{a.vehicle_no} ({a.driver_name || 'No driver'})</option>
                ))}
              </select>
            </FormField>
          )}

          {staffForm.role === 'BLOODBANK' && (
            <FormField label="Select Blood Bank" required>
              <select
                required
                value={staffForm.bloodbank_id}
                onChange={(e) => setStaffForm({ ...staffForm, bloodbank_id: e.target.value })}
              >
                <option value="">— Select Blood Bank Facility —</option>
                {bloodBanks.map((b) => (
                  <option key={b.bloodbank_id} value={b.bloodbank_id}>{b.name}</option>
                ))}
              </select>
            </FormField>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
            <Button variant="secondary" type="button" onClick={() => setShowStaffModal(false)}>Cancel</Button>
            <Button variant="primary" type="submit" loading={saving}>Create Account</Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: ADD / EDIT HOSPITAL */}
      <Modal
        isOpen={showHospitalModal}
        onClose={() => setShowHospitalModal(false)}
        title={editingHospital ? 'Edit Hospital Facility' : 'Add New Hospital Facility'}
      >
        <form onSubmit={handleSaveHospital} style={{ display: 'grid', gap: '14px' }}>
          <FormField label="Hospital Name" required>
            <input
              type="text"
              required
              value={hospitalForm.name}
              onChange={(e) => setHospitalForm({ ...hospitalForm, name: e.target.value })}
            />
          </FormField>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
            <FormField label="Street Address" required>
              <input
                type="text"
                required
                value={hospitalForm.address}
                onChange={(e) => setHospitalForm({ ...hospitalForm, address: e.target.value })}
              />
            </FormField>
            <FormField label="City" required>
              <input
                type="text"
                required
                value={hospitalForm.city}
                onChange={(e) => setHospitalForm({ ...hospitalForm, city: e.target.value })}
              />
            </FormField>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <FormField label="Latitude" required>
              <input
                type="number"
                step="any"
                required
                value={hospitalForm.latitude}
                onChange={(e) => setHospitalForm({ ...hospitalForm, latitude: e.target.value })}
              />
            </FormField>
            <FormField label="Longitude" required>
              <input
                type="number"
                step="any"
                required
                value={hospitalForm.longitude}
                onChange={(e) => setHospitalForm({ ...hospitalForm, longitude: e.target.value })}
              />
            </FormField>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <FormField label="Phone">
              <input
                type="tel"
                value={hospitalForm.phone}
                onChange={(e) => setHospitalForm({ ...hospitalForm, phone: e.target.value })}
              />
            </FormField>
            <FormField label="Email">
              <input
                type="email"
                value={hospitalForm.email}
                onChange={(e) => setHospitalForm({ ...hospitalForm, email: e.target.value })}
              />
            </FormField>
          </div>
          <FormField label="Specialties (comma-separated)">
            <input
              type="text"
              value={hospitalForm.specialties}
              onChange={(e) => setHospitalForm({ ...hospitalForm, specialties: e.target.value })}
              placeholder="Cardiology, Neurology, Emergency"
            />
          </FormField>
          <FormField label="Brief Description">
            <textarea
              rows="3"
              value={hospitalForm.description}
              onChange={(e) => setHospitalForm({ ...hospitalForm, description: e.target.value })}
            />
          </FormField>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
            <Button variant="secondary" type="button" onClick={() => setShowHospitalModal(false)}>Cancel</Button>
            <Button variant="primary" type="submit" loading={saving}>Save Hospital</Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: ADD AMBULANCE */}
      <Modal
        isOpen={showAmbulanceModal}
        onClose={() => setShowAmbulanceModal(false)}
        title="Add Ambulance Vehicle"
      >
        <form onSubmit={handleSaveAmbulance} style={{ display: 'grid', gap: '14px' }}>
          <FormField label="Vehicle Registration Number" required>
            <input
              type="text"
              required
              value={ambulanceForm.vehicle_no}
              onChange={(e) => setAmbulanceForm({ ...ambulanceForm, vehicle_no: e.target.value.toUpperCase() })}
              placeholder="DL 01 AB 1234"
            />
          </FormField>
          <FormField label="Driver Full Name">
            <input
              type="text"
              value={ambulanceForm.driver_name}
              onChange={(e) => setAmbulanceForm({ ...ambulanceForm, driver_name: e.target.value })}
              placeholder="e.g. Surender Kumar"
            />
          </FormField>
          <FormField label="Driver Phone">
            <input
              type="tel"
              value={ambulanceForm.driver_phone}
              onChange={(e) => setAmbulanceForm({ ...ambulanceForm, driver_phone: e.target.value })}
              placeholder="+91 98765 43210"
            />
          </FormField>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <FormField label="Base Latitude">
              <input
                type="number"
                step="any"
                value={ambulanceForm.latitude}
                onChange={(e) => setAmbulanceForm({ ...ambulanceForm, latitude: e.target.value })}
              />
            </FormField>
            <FormField label="Base Longitude">
              <input
                type="number"
                step="any"
                value={ambulanceForm.longitude}
                onChange={(e) => setAmbulanceForm({ ...ambulanceForm, longitude: e.target.value })}
              />
            </FormField>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
            <Button variant="secondary" type="button" onClick={() => setShowAmbulanceModal(false)}>Cancel</Button>
            <Button variant="primary" type="submit" loading={saving}>Save Vehicle</Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: ADD BLOOD BANK */}
      <Modal
        isOpen={showBankModal}
        onClose={() => setShowBankModal(false)}
        title="Add Blood Bank Facility"
      >
        <form onSubmit={handleSaveBank} style={{ display: 'grid', gap: '14px' }}>
          <FormField label="Blood Bank Name" required>
            <input
              type="text"
              required
              value={bankForm.name}
              onChange={(e) => setBankForm({ ...bankForm, name: e.target.value })}
              placeholder="e.g. Red Cross Regional Center"
            />
          </FormField>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
            <FormField label="Street Address" required>
              <input
                type="text"
                required
                value={bankForm.address}
                onChange={(e) => setBankForm({ ...bankForm, address: e.target.value })}
              />
            </FormField>
            <FormField label="City" required>
              <input
                type="text"
                required
                value={bankForm.city}
                onChange={(e) => setBankForm({ ...bankForm, city: e.target.value })}
              />
            </FormField>
          </div>
          <FormField label="Helpline Phone">
            <input
              type="tel"
              value={bankForm.phone}
              onChange={(e) => setBankForm({ ...bankForm, phone: e.target.value })}
              placeholder="+91 11 2335 9306"
            />
          </FormField>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <FormField label="Latitude">
              <input
                type="number"
                step="any"
                value={bankForm.latitude}
                onChange={(e) => setBankForm({ ...bankForm, latitude: e.target.value })}
              />
            </FormField>
            <FormField label="Longitude">
              <input
                type="number"
                step="any"
                value={bankForm.longitude}
                onChange={(e) => setBankForm({ ...bankForm, longitude: e.target.value })}
              />
            </FormField>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
            <Button variant="secondary" type="button" onClick={() => setShowBankModal(false)}>Cancel</Button>
            <Button variant="primary" type="submit" loading={saving}>Save Blood Bank</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

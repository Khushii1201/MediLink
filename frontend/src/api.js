const BASE = import.meta.env.VITE_API_URL || '/api';

function authHeaders() {
  const token = localStorage.getItem('medilink_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(auth ? authHeaders() : {}),
  };

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && auth) {
    localStorage.removeItem('medilink_token');
    localStorage.removeItem('medilink_user');
    if (!window.location.pathname.startsWith('/login')) {
      const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `/login?redirect=${returnUrl}`;
    }
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  // Public Stats
  getPublicStats: () => request('/public/stats', { auth: false }),

  // Auth
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password }, auth: false }),
  register: (payload) => request('/auth/register', { method: 'POST', body: payload, auth: false }),
  getMe: () => request('/auth/me'),

  // Hospitals
  searchHospitals: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/hospitals${qs ? `?${qs}` : ''}`, { auth: false });
  },
  getHospital: (id) => request(`/hospitals/${id}`, { auth: false }),
  getHospitalFilters: () => request('/hospitals/filters', { auth: false }),
  createHospital: (body) => request('/hospitals', { method: 'POST', body }),
  updateHospitalProfile: (id, body) => request(`/hospitals/${id}/profile`, { method: 'PUT', body }),
  deleteHospital: (id) => request(`/hospitals/${id}`, { method: 'DELETE' }),

  createHospitalResource: (hospitalId, body) => request(`/hospitals/${hospitalId}/resources`, { method: 'POST', body }),
  updateResource: (hospitalId, resourceId, body) => request(`/hospitals/${hospitalId}/resources/${resourceId}`, { method: 'PUT', body }),

  addDoctor: (hospitalId, body) => request(`/hospitals/${hospitalId}/doctors`, { method: 'POST', body }),
  updateDoctor: (hospitalId, doctorId, body) => request(`/hospitals/${hospitalId}/doctors/${doctorId}`, { method: 'PUT', body }),
  deleteDoctor: (hospitalId, doctorId) => request(`/hospitals/${hospitalId}/doctors/${doctorId}`, { method: 'DELETE' }),

  updateWaitingTime: (hospitalId, body) => request(`/hospitals/${hospitalId}/waiting-time`, { method: 'PUT', body }),

  // Admissions
  myAdmissions: () => request('/admissions'),
  requestAdmission: (body) => request('/admissions', { method: 'POST', body }),
  updateAdmissionStatus: (id, status) => request(`/admissions/${id}/status`, { method: 'PUT', body: { status } }),
  cancelAdmission: (id) => request(`/admissions/${id}/cancel`, { method: 'PUT' }),

  // Ambulances
  listAmbulances: () => request('/ambulances'),
  createAmbulance: (body) => request('/ambulances', { method: 'POST', body }),
  updateAmbulanceProfile: (id, body) => request(`/ambulances/${id}/profile`, { method: 'PUT', body }),
  myAmbulanceRequests: () => request('/ambulances/requests'),
  requestAmbulance: (body) => request('/ambulances/requests', { method: 'POST', body }),
  updateAmbulanceRequest: (id, body) => request(`/ambulances/requests/${id}`, { method: 'PUT', body }),
  updateAmbulanceLocation: (id, body) => request(`/ambulances/${id}/location`, { method: 'PUT', body }),
  trackAmbulance: (id) => request(`/ambulances/requests/${id}/track`),
  cancelAmbulanceRequest: (id) => request(`/ambulances/requests/${id}/cancel`, { method: 'PUT' }),

  // Blood Bank
  searchBloodUnits: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/bloodbank/units${qs ? `?${qs}` : ''}`, { auth: false });
  },
  listBloodBanks: () => request('/bloodbank/banks', { auth: false }),
  createBloodBank: (body) => request('/bloodbank/banks', { method: 'POST', body }),
  updateBloodBank: (id, body) => request(`/bloodbank/banks/${id}`, { method: 'PUT', body }),
  createBloodUnit: (body) => request('/bloodbank/units', { method: 'POST', body }),
  updateBloodUnit: (id, body) => request(`/bloodbank/units/${id}`, { method: 'PUT', body }),
  myReservations: () => request('/bloodbank/reservations'),
  reserveBlood: (unit_id, units_requested) => request('/bloodbank/reservations', { method: 'POST', body: { unit_id, units_requested } }),
  updateReservation: (id, status) => request(`/bloodbank/reservations/${id}`, { method: 'PUT', body: { status } }),
  cancelReservation: (id) => request(`/bloodbank/reservations/${id}/cancel`, { method: 'PUT' }),

  // Recommendations & Waiting Times
  getRecommendations: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/recommendations${qs ? `?${qs}` : ''}`);
  },
  getWaitingTimes: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/waiting-time${qs ? `?${qs}` : ''}`, { auth: false });
  },

  // Blood Compatibility & Expiry
  getBloodCompatibility: (recipient) => request(`/bloodbank/compatibility${recipient ? `?recipient=${encodeURIComponent(recipient)}` : ''}`, { auth: false }),
  expireBloodReservations: (max_age_hours = 24) => request('/bloodbank/reservations/expire', { method: 'POST', body: { max_age_hours } }),

  // Admin
  adminUsers: () => request('/admin/users'),
  adminCreateUser: (body) => request('/admin/users', { method: 'POST', body }),
  adminUpdateUser: (id, body) => request(`/admin/users/${id}`, { method: 'PUT', body }),
  adminDeactivateUser: (id) => request(`/admin/users/${id}`, { method: 'DELETE' }),
  adminReactivateUser: (id) => request(`/admin/users/${id}/reactivate`, { method: 'PUT' }),
  adminDeleteAmbulance: (id) => request(`/admin/ambulances/${id}`, { method: 'DELETE' }),
  adminDeleteBloodBank: (id) => request(`/admin/blood-banks/${id}`, { method: 'DELETE' }),
  adminAuditLogs: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/admin/audit${qs ? `?${qs}` : ''}`);
  },
  adminAnalytics: () => request('/admin/analytics'),
  adminAnomalies: () => request('/admin/anomalies'),
};

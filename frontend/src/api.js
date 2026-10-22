const BASE = '/api';

function authHeaders() {
  const token = localStorage.getItem('medilink_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(path, { method = 'GET', body, auth = true } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(auth ? authHeaders() : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password }, auth: false }),
  register: (payload) => request('/auth/register', { method: 'POST', body: payload, auth: false }),

  searchHospitals: (params) => request(`/hospitals?${new URLSearchParams(params)}`),
  getHospital: (id) => request(`/hospitals/${id}`),
  updateHospitalProfile: (id, body) => request(`/hospitals/${id}/profile`, { method: 'PUT', body }),
  createHospital: (body) => request('/hospitals', { method: 'POST', body }),
  updateResource: (hospitalId, resourceId, body) => request(`/hospitals/${hospitalId}/resources/${resourceId}`, { method: 'PUT', body }),
  addDoctor: (hospitalId, body) => request(`/hospitals/${hospitalId}/doctors`, { method: 'POST', body }),
  updateDoctor: (hospitalId, doctorId, body) => request(`/hospitals/${hospitalId}/doctors/${doctorId}`, { method: 'PUT', body }),
  updateWaitingTime: (hospitalId, body) => request(`/hospitals/${hospitalId}/waiting-time`, { method: 'PUT', body }),

  myAdmissions: () => request('/admissions'),
  requestAdmission: (body) => request('/admissions', { method: 'POST', body }),
  updateAdmissionStatus: (id, status) => request(`/admissions/${id}/status`, { method: 'PUT', body: { status } }),

  myAmbulanceRequests: () => request('/ambulances/requests'),
  listAmbulances: () => request('/ambulances'),
  createAmbulance: (body) => request('/ambulances', { method: 'POST', body }),
  updateAmbulanceProfile: (id, body) => request(`/ambulances/${id}/profile`, { method: 'PUT', body }),
  requestAmbulance: (pickup_location) => request('/ambulances/requests', { method: 'POST', body: { pickup_location } }),
  updateAmbulanceRequest: (id, status) => request(`/ambulances/requests/${id}`, { method: 'PUT', body: { status } }),
  updateAmbulanceLocation: (id, body) => request(`/ambulances/${id}/location`, { method: 'PUT', body }),

  searchBloodUnits: (blood_group) => request(`/bloodbank/units${blood_group ? `?blood_group=${encodeURIComponent(blood_group)}` : ''}`, { auth: false }),
  listBloodBanks: () => request('/bloodbank/banks', { auth: false }),
  createBloodBank: (body) => request('/bloodbank/banks', { method: 'POST', body }),
  updateBloodBank: (id, body) => request(`/bloodbank/banks/${id}`, { method: 'PUT', body }),
  createBloodUnit: (body) => request('/bloodbank/units', { method: 'POST', body }),
  updateBloodUnit: (id, body) => request(`/bloodbank/units/${id}`, { method: 'PUT', body }),
  myReservations: () => request('/bloodbank/reservations'),
  reserveBlood: (unit_id, units_requested) => request('/bloodbank/reservations', { method: 'POST', body: { unit_id, units_requested } }),
  updateReservation: (id, status) => request(`/bloodbank/reservations/${id}`, { method: 'PUT', body: { status } }),

  getRecommendations: (params) => request(`/recommendations?${new URLSearchParams(params)}`),
  getWaitingTimes: () => request('/waiting-time', { auth: false }),

  adminUsers: () => request('/admin/users'),
  adminDeleteUser: (id) => request(`/admin/users/${id}`, { method: 'DELETE' }),
  adminAnalytics: () => request('/admin/analytics'),
};

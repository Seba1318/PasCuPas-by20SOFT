// Câte o funcție pentru fiecare endpoint din planul 20SOFT (Endpoint-uri FastAPI).
// Paginile importă de aici, nu scriu căi direct. Documentația vie: http://localhost:8000/docs
import { api } from './client.js';

export const auth = {
  register: ({ email, password, password_confirm }) => api.post('/auth/register', { email, password, password_confirm }),
  verify: (token) => api.get('/auth/verify', { token }),
  login: ({ email, password }) => api.post('/auth/login', { email, password }),
  resendVerification: (email) => api.post('/auth/resend-verification', { email }),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: ({ token, password }) => api.post('/auth/reset-password', { token, password }),
};

export const users = {
  me: () => api.get('/users/me'),
  updateMe: (changes) => api.patch('/users/me', changes),
  uploadAvatar: (formData) => api.upload('/users/me/avatar', formData),
  deleteAvatar: () => api.del('/users/me/avatar'),
  getProfile: () => api.get('/users/me/profile'),
  saveProfile: (profile) => api.put('/users/me/profile', profile),
  exportData: () => api.get('/users/me/export'),
  deleteAccount: () => api.del('/users/me'),
};

export const places = {
  list: ({ bbox, category } = {}) => api.get('/places', { bbox, category }),
  get: (id) => api.get(`/places/${id}`),
  search: (q) => api.get('/search', { q }),
  works: ({ bbox } = {}) => api.get('/works', { bbox }),
};

export const routes = {
  // start și end sunt [lon, lat]; mode: 'walk' | 'transit'
  plan: ({ start, end, mode = 'walk' }) => api.post('/routes/plan', { start, end, mode }),
  check: ({ route }) => api.post('/routes/check', { route }),
};

export const transit = {
  stops: ({ bbox } = {}) => api.get('/transit/stops', { bbox }),
  arrivals: (stopId) => api.get(`/transit/stops/${stopId}/arrivals`),
  routes: () => api.get('/transit/routes'),
};

export const reports = {
  create: (formData) => api.upload('/reports', formData),
  list: ({ bbox, status } = {}) => api.get('/reports', { bbox, status }),
  get: (publicCode) => api.get(`/reports/${publicCode}`),
  mine: () => api.get('/reports/mine'),
  // kind: 'confirm' | 'inca_exista' | 'rezolvat'
  confirm: (id, kind) => api.post(`/reports/${id}/confirm`, { kind }),
};

export const admin = {
  reports: (filters) => api.get('/admin/reports', filters),
  works: () => api.get('/admin/works'),
  projects: () => api.get('/admin/projects'),
  // Listările de mai jos nu sunt în plan, dar ecranele X8 și X9 au nevoie de ele.
  edges: (filters) => api.get('/admin/edges', filters),
  vehicles: () => api.get('/admin/vehicles'),
  patchReport: (id, changes) => api.patch(`/admin/reports/${id}`, changes),
  createPlace: (place) => api.post('/admin/places', place),
  patchPlace: (id, changes) => api.patch(`/admin/places/${id}`, changes),
  deletePlace: (id) => api.del(`/admin/places/${id}`),
  patchEdge: (id, changes) => api.patch(`/admin/edges/${id}`, changes),
  createWork: (work) => api.post('/admin/works', work),
  patchWork: (id, changes) => api.patch(`/admin/works/${id}`, changes),
  deleteWork: (id) => api.del(`/admin/works/${id}`),
  createProject: (project) => api.post('/admin/projects', project),
  patchProject: (id, changes) => api.patch(`/admin/projects/${id}`, changes),
  deleteProject: (id) => api.del(`/admin/projects/${id}`),
  patchVehicle: (id, changes) => api.patch(`/admin/vehicles/${id}`, changes),
  statsHeatmap: () => api.get('/admin/stats/heatmap'),
  statsZones: () => api.get('/admin/stats/zones'),
  users: (filters) => api.get('/admin/users', filters),
  patchUser: (id, changes) => api.patch(`/admin/users/${id}`, changes),
  createInstitution: (institution) => api.post('/admin/institutions', institution),
  // Nu e în plan; X11 are nevoie de listă.
  institutions: () => api.get('/admin/institutions'),
};

export const chat = {
  ask: (question) => api.post('/chat', { question }),
};

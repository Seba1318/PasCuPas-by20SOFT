// Conturi doar pentru modul mock (VITE_USE_MOCKS=true). Nu există în backend.
export const MOCK_PASSWORD = 'parola-demo';

export const users = [
  { id: 1, email: 'andreea@exemplu.ro', display_name: 'Andreea', avatar_url: null, role: 'user', institution: null, is_verified: true, trust_level: 100, confirmed_reports_count: 3, created_at: '2026-09-14T10:00:00Z' },
  { id: 2, email: 'neconfirmat@exemplu.ro', role: 'user', institution: null, is_verified: false, trust_level: 100, confirmed_reports_count: 0, created_at: '2026-10-18T10:00:00Z' },
  { id: 3, email: 'primarie@exemplu.ro', role: 'admin', institution: { id: 1, name: 'Primăria Timișoara', type: 'primarie' }, is_verified: true, trust_level: 100, confirmed_reports_count: 0, created_at: '2026-09-01T10:00:00Z' },
  { id: 4, email: 'stpt@exemplu.ro', role: 'admin', institution: { id: 2, name: 'STPT', type: 'transport' }, is_verified: true, trust_level: 100, confirmed_reports_count: 0, created_at: '2026-09-01T10:00:00Z' },
  { id: 6, email: 'suspendat@exemplu.ro', role: 'user', institution: null, is_verified: true, trust_level: 0, suspended_until: '2027-01-25T00:00:00Z', confirmed_reports_count: 0, created_at: '2026-09-01T10:00:00Z' },
  { id: 5, email: 'super@exemplu.ro', role: 'superadmin', institution: null, is_verified: true, trust_level: 100, confirmed_reports_count: 0, created_at: '2026-09-01T10:00:00Z' },
];

export const defaultProfile = {
  avoid_stairs: true,
  max_kerb_cm: 3,
  max_incline_pct: 6,
  avoid_rough_surface: true,
  prefer_tactile: false,
  prefer_audio_signals: false,
  simplified_mode: false,
  needs_rest_every_m: 300,
  prefer_lit: false,
};

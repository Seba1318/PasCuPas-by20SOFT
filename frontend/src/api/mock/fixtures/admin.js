// Date de exemplu pentru panoul de administrare (Observații §11: nu sunt date reale).
// Scorurile urmează planul 20SOFT: AI 0–60, dată 0–20, locație 0–20.
export const reportScores = {
  123: { ai: 55, date: 20, location: 20, ai_notes: 'Poza arată o mașină în fața unei rampe.' },
  124: { ai: 42, date: 20, location: 10, ai_notes: 'Mașină pe trotuar, unghi neclar.' },
  125: { ai: 56, date: 20, location: 20, ai_notes: 'Ușa liftului închisă, afiș „defect”.' },
  98: { ai: 50, date: 20, location: 20, ai_notes: '' },
  71: { ai: 12, date: 0, location: 10, ai_notes: 'Poza nu arată un ghidaj tactil.' },
};

export const projects = [
  { id: 1, title: 'Semafoare sonore pe Bd. Vasile Pârvan', description: 'Montăm semnale sonore la trecerile dintre Piața Victoriei și Complex.', zone: 'Piața Victoriei – Complex', start_date: '2026-11-01', end_date: '2027-02-28', status: 'planificat', budget: null },
  { id: 2, title: 'Rampe la intrările UVT', description: '', zone: 'Bd. Vasile Pârvan 4', start_date: '2026-09-01', end_date: '2026-12-15', status: 'in_curs', budget: null },
  { id: 3, title: 'Ghidaj tactil în Piața Victoriei', description: '', zone: 'Piața Victoriei', start_date: '2026-10-01', end_date: '2026-11-30', status: 'in_curs', budget: null },
  { id: 4, title: 'Trotuare noi în Complexul Studențesc', description: '', zone: 'Aleea Studenților', start_date: '2026-03-01', end_date: '2026-06-30', status: 'finalizat', budget: null },
];

export const vehicles = [
  { id: 'T-01', route: '1', route_name: 'Tramvai 1', low_floor: true, has_ramp: true, ramp_ok: true, has_audio_announce: true, audio_ok: true, has_visual_display: true, open_reports: 0 },
  { id: 'T-02', route: '1', route_name: 'Tramvai 1', low_floor: true, has_ramp: true, ramp_ok: false, has_audio_announce: true, audio_ok: true, has_visual_display: true, open_reports: 2 },
  { id: 'T-03', route: '1', route_name: 'Tramvai 1', low_floor: true, has_ramp: true, ramp_ok: true, has_audio_announce: true, audio_ok: false, has_visual_display: true, open_reports: 1 },
  { id: 'TB-01', route: '14', route_name: 'Troleibuz 14', low_floor: true, has_ramp: true, ramp_ok: false, has_audio_announce: true, audio_ok: true, has_visual_display: false, open_reports: 1 },
  { id: 'TB-02', route: '14', route_name: 'Troleibuz 14', low_floor: true, has_ramp: true, ramp_ok: true, has_audio_announce: true, audio_ok: true, has_visual_display: true, open_reports: 0 },
];

// Câteva tronsoane din graf, ca să poată fi selectate și editate pe hartă (X8).
const edge = (id, name, coords, attrs) => ({
  type: 'Feature',
  id,
  geometry: { type: 'LineString', coordinates: coords },
  properties: { id, name, length_m: 230, has_stairs: false, kerb_height_cm: 2, incline_pct: 1, surface: 'asfalt', has_tactile: false, has_audio_signal: false, is_lit: true, has_bench: false, blocked: false, ...attrs },
});
export const edges = [
  edge(501, 'Bd. Vasile Pârvan, trotuarul de nord', [[21.2270, 45.7481], [21.2300, 45.7480]], { kerb_height_cm: 8, surface: 'pavele' }),
  edge(502, 'Bd. Vasile Pârvan, trotuarul de nord (est)', [[21.2300, 45.7480], [21.2340, 45.7479]], {}),
  edge(503, 'Aleea Studenților', [[21.2340, 45.7479], [21.2372, 45.7478]], { has_bench: true }),
  edge(504, 'Scări lângă Rectorat', [[21.2259, 45.7510], [21.2257, 45.7533]], { has_stairs: true, length_m: 60 }),
];

// Statistici pe zone (planul 20SOFT · „clasament al zonelor neglijate”, „timp mediu de rezolvare”).
export const zones = [
  { zone: 'Bd. Vasile Pârvan', open_count: 12, avg_resolution_days: 2.5, last_action_days: 2, note: 'Mai ales mașini pe trotuar' },
  { zone: 'Complexul Studențesc', open_count: 9, avg_resolution_days: 4, last_action_days: 21, note: 'Rampe blocate, borduri' },
  { zone: 'Piața Victoriei', open_count: 7, avg_resolution_days: 3, last_action_days: 4, note: 'Ghidaj tactil lipsă' },
  { zone: 'Aleea Studenților (est)', open_count: 5, avg_resolution_days: 5.5, last_action_days: 16, note: 'Lucrări fără ocolire' },
  { zone: 'Piața Eftimie Murgu', open_count: 3, avg_resolution_days: 6, last_action_days: 15, note: 'Lift defect la UMF' },
];

// Puncte pentru harta termică: [lon, lat, greutate], grupate în jurul zonelor de mai sus.
const around = ([lon, lat], n, spread, w) =>
  Array.from({ length: n }, (_, i) => [lon + Math.sin(i * 2.4) * spread, lat + Math.cos(i * 1.7) * spread * 0.7, w]);
export const heat = [
  ...around([21.2300, 45.7478], 14, 0.0012, 1),
  ...around([21.2380, 45.7472], 10, 0.0009, 1),
  ...around([21.2257, 45.7530], 8, 0.0007, 1),
  ...around([21.2236, 45.7522], 4, 0.0005, 0.8),
];

export const institutions = [
  { id: 1, name: 'Primăria Timișoara', type: 'primarie', accounts: 4, scopes: ['Rapoarte stradale', 'Lucrări', 'Proiecte', 'Dotări și locații'] },
  { id: 2, name: 'STPT', type: 'transport', accounts: 3, scopes: ['Vehicule', 'Stații', 'Rapoarte despre vehicule'] },
];

export const trustHistory = {
  1: [{ change: 'Cont creat · încredere ridicată (100)', at: '2026-09-14T10:00:00Z', by: 'automat' }],
};

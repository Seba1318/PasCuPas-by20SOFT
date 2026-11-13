// Rapoarte de exemplu (coduri și date din design, nu reale).
const report = (id, code, category, coordinates, extra) => ({
  type: 'Feature',
  id,
  geometry: { type: 'Point', coordinates },
  properties: {
    id,
    public_code: code,
    category,
    status: 'in_lucru',
    possibly_resolved: false,
    created_at: '2026-10-18T07:24:00Z',
    reporter: { name: 'Andreea', user_id: 1, avatar_url: null },
    photo_url: null,
    timeline: [
      { status: 'trimis', at: extra.created_at ?? '2026-10-18T07:24:00Z' },
      { status: 'in_lucru', at: '2026-10-18T12:02:00Z', by: 'Primăria Timișoara' },
    ],
    ...extra,
  },
});

export const reports = [
  report(123, 'TM-2026-000123', 'rampa_blocata', [21.2318, 45.7476], {
    location_text: 'Bd. Vasile Pârvan',
    description: 'O mașină e parcată exact în fața rampei.',
    confirmations: 3,
  }),
  report(124, 'TM-2026-000124', 'masina_trotuar', [21.2338, 45.7477], {
    location_text: 'Colț cu Bd. Vasile Pârvan',
    created_at: '2026-10-16T09:10:00Z',
    confirmations: 4,
    reporter: { name: 'Vlad', user_id: 99, avatar_url: null },
  }),
  report(125, 'TM-2026-000125', 'lift_defect', [21.2267, 45.7467], {
    location_text: 'Facultatea de AC',
    created_at: '2026-10-17T12:00:00Z',
    possibly_resolved: true,
    confirmations: 1,
  }),
  report(98, 'TM-2026-000098', 'lift_defect', [21.2268, 45.7468], {
    status: 'rezolvat', location_text: 'Facultatea de AC', created_at: '2026-10-03T08:00:00Z', resolved_at: '2026-10-08T10:00:00Z', confirmations: 2,
  }),
  report(71, 'TM-2026-000071', 'ghidaj_tactil', [21.2262, 45.7528], {
    status: 'respins', location_text: 'Piața Victoriei', created_at: '2026-09-21T08:00:00Z', confirmations: 0,
  }),
];

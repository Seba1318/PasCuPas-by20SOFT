// Date de exemplu pentru demo (Observații §11): pozițiile sunt aproximative
// și trebuie verificate cu OSM. Coordonatele sunt GeoJSON: [lon, lat].
const point = (id, name, category, coordinates, attributes = {}) => ({
  type: 'Feature',
  id,
  geometry: { type: 'Point', coordinates },
  properties: { id, name, category, attributes },
});

export const places = [
  point(1, 'Rectoratul UPT', 'building', [21.2257, 45.7536], {
    kind: 'Rectorat',
    updated_at: '2026-10-15T09:00:00Z',
    address: 'Piața Victoriei 2',
    step_free_entrance: true,
    lift: true,
    accessible_toilet: true,
    door_width_cm: 120,
  }),
  point(2, 'Universitatea de Vest', 'building', [21.2311, 45.7471], {
    kind: 'Universitate',
    updated_at: '2026-10-15T09:00:00Z',
    address: 'Bd. Vasile Pârvan 4',
    step_free_entrance: true,
    lift: true,
    accessible_toilet: false,
    door_width_cm: 90,
  }),
  point(3, 'Facultatea de Automatică și Calculatoare', 'building', [21.2265, 45.7470], {
    kind: 'Facultate',
    updated_at: '2026-10-15T09:00:00Z',
    address: 'Bd. Vasile Pârvan 2',
    step_free_entrance: true,
    entrance_note: 'Rampă la intrarea principală',
    lift: true,
    lift_note: 'Până la toate etajele',
    accessible_toilet: false,
    door_width_cm: 90,
  }),
  point(4, 'UMF „Victor Babeș”', 'building', [21.2236, 45.7525], {
    kind: 'Universitate',
    updated_at: '2026-10-15T09:00:00Z',
    address: 'Piața Eftimie Murgu 2',
    step_free_entrance: false,
    lift: true,
    accessible_toilet: null,
    door_width_cm: null,
  }),
  point(5, 'Căminul 1', 'building', [21.2389, 45.7469], {
    kind: 'Cămin',
    updated_at: '2026-10-15T09:00:00Z', address: 'Aleea Studenților' }),
  point(6, 'Cantina Complexului Studențesc', 'building', [21.2402, 45.7460], {
    kind: 'Cantină',
    updated_at: '2026-10-15T09:00:00Z',
    address: 'Aleea Studenților',
    step_free_entrance: true,
    accessible_toilet: true,
  }),
  point(10, 'Rampă la intrarea de est a Rectoratului', 'ramp', [21.2263, 45.7535]),
  point(11, 'Rampă la intrarea UVT', 'ramp', [21.2316, 45.7473]),
  point(12, 'Lift în pasajul Facultății de AC', 'lift', [21.2268, 45.7468]),
  point(13, 'Intrare accesibilă Cantina', 'entrance', [21.2399, 45.7462]),
  point(14, 'Toaletă accesibilă UVT', 'toilet', [21.2307, 45.7469]),
  point(15, 'Parcare pentru persoane cu dizabilități', 'parking', [21.2300, 45.7476]),
  point(16, 'Ghidaj tactil pe Bd. Vasile Pârvan', 'tactile', [21.2290, 45.7474]),
  point(17, 'Semafor sonor Piața Victoriei', 'audio_signal', [21.2262, 45.7528]),
  point(18, 'Bancă lângă Căminul 1', 'bench', [21.2382, 45.7472]),
  point(19, 'Bancă pe Aleea Studenților', 'bench', [21.2360, 45.7478]),
];

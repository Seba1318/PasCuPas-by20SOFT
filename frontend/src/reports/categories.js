// Categoriile de raport (design/E1; planul 20SOFT · Raportarea problemelor).
// `tint` e fundalul pastel al iconiței; `icon` e numele iconiței Lucide folosite în interfață.
export const CATEGORIES = [
  { id: 'rampa_blocata', label: 'Rampă blocată', tint: 'peach', icon: 'ramp' },
  { id: 'masina_trotuar', label: 'Mașină pe trotuar', tint: 'sky', icon: 'car' },
  { id: 'lift_defect', label: 'Lift defect', tint: 'lavender', icon: 'lift' },
  { id: 'lucrari', label: 'Lucrări', tint: 'warning-bg', icon: 'works' },
  { id: 'ghidaj_tactil', label: 'Ghidaj tactil lipsă', tint: 'mint', icon: 'tactile' },
  { id: 'bordura_inalta', label: 'Bordură înaltă', tint: 'peach', icon: 'kerb' },
  { id: 'semafor_sonor', label: 'Semafor sonor defect', tint: 'sky', icon: 'sound' },
  { id: 'dotare_vehicul', label: 'Dotare defectă în vehicul', tint: 'lavender', icon: 'bus', needsVehicle: true },
  { id: 'altceva', label: 'Altceva', tint: 'subtle', icon: 'other' },
];

export const categoryLabel = (id) => CATEGORIES.find((c) => c.id === id)?.label ?? 'Problemă';

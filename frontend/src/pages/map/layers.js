// Straturile activabile de pe hartă (design/C1, W5; planul 20SOFT · Harta cu dotări).
// `categories` sunt valorile places.category din API; locurile cu fișă (building) apar mereu.
export const LAYERS = [
  { id: 'rampe', label: 'Rampe', categories: ['ramp'] },
  { id: 'toalete', label: 'Toalete', categories: ['toilet'] },
  { id: 'lifturi', label: 'Lifturi', categories: ['lift'] },
  { id: 'banci', label: 'Bănci', categories: ['bench'] },
  { id: 'statii', label: 'Stații' },
  { id: 'probleme', label: 'Probleme' },
  { id: 'lucrari', label: 'Lucrări' },
  { id: 'intrari', label: 'Intrări accesibile', categories: ['entrance'] },
  { id: 'parcari', label: 'Parcări', categories: ['parking'] },
  { id: 'ghidaje', label: 'Ghidaje tactile', categories: ['tactile'] },
  { id: 'semafoare', label: 'Semafoare sonore', categories: ['audio_signal'] },
];

export const DEFAULT_LAYERS = new Set(['rampe', 'toalete', 'statii', 'probleme', 'lucrari']);

const ALWAYS = new Set(['building']);

export function visiblePlaces(features, active) {
  const allowed = new Set(ALWAYS);
  for (const layer of LAYERS) {
    if (active.has(layer.id)) layer.categories?.forEach((c) => allowed.add(c));
  }
  return features.filter((f) => allowed.has(f.properties.category));
}

export function toggleLayer(active, id) {
  const next = new Set(active);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

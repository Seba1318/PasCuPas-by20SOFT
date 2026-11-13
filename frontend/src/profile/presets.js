// Profilul de nevoi (planul 20SOFT · „Profilul de nevoi”, pag. 3–4).
// Fiecare tip bifat completează profilul cu valori inițiale, pe care utilizatorul le poate schimba.
import { formatPercent } from '../lib/format.js';

export const NEED_TYPES = [
  { id: 'mobility', spot: 'nMobility', label: 'Scaun cu rotile, cadru sau cârje', hint: 'Ocolim treptele, bordurile înalte și pantele.' },
  { id: 'vision', spot: 'nVision', label: 'Văd greu', hint: 'Ghidaje tactile, semafoare sonore, indicații vocale.' },
  { id: 'hearing', spot: 'nHearing', label: 'Aud greu', hint: 'Alerte vizuale mari, vibrații, fără sunet obligatoriu.' },
  { id: 'cognitive', spot: 'nSimple', label: 'Prefer indicații simple', hint: 'Un pas pe ecran, cuvinte puține, repere clare.' },
  { id: 'elderly', spot: 'nTired', label: 'Obosesc repede', hint: 'Drumuri scurte și bănci pe traseu.' },
  { id: 'stroller', spot: 'nTemp', label: 'Cărucior de copil sau accidentare temporară', hint: 'Trotuare late, rampe și lifturi.' },
];

// Câmpurile din accessibility_profiles. null = fără limită.
export const EMPTY_PROFILE = Object.freeze({
  avoid_stairs: false,
  max_kerb_cm: null,
  max_incline_pct: null,
  avoid_rough_surface: false,
  prefer_tactile: false,
  prefer_audio_signals: false,
  simplified_mode: false,
  needs_rest_every_m: null,
  prefer_lit: false,
});

const DEFAULTS = {
  mobility: { profile: { avoid_stairs: true, max_kerb_cm: 3, max_incline_pct: 6, avoid_rough_surface: true } },
  stroller: { profile: { avoid_stairs: true, max_kerb_cm: 6, max_incline_pct: 8 } },
  vision: { profile: { prefer_tactile: true, prefer_audio_signals: true }, ui: { highContrast: true, voice: true } },
  hearing: { ui: { vibration: true } },
  cognitive: { profile: { simplified_mode: true }, ui: { simplified: true } },
  elderly: { profile: { needs_rest_every_m: 300, max_incline_pct: 8 } },
};

const minOrNull = (a, b) => (a == null ? b : b == null ? a : Math.min(a, b));

export function buildProfile(needIds) {
  const profile = { ...EMPTY_PROFILE };
  const uiPrefs = {};
  for (const id of needIds) {
    const d = DEFAULTS[id];
    if (!d) continue;
    for (const [key, value] of Object.entries(d.profile ?? {})) {
      profile[key] = typeof value === 'number' ? minOrNull(profile[key], value) : profile[key] || value;
    }
    Object.assign(uiPrefs, d.ui);
  }
  return { profile, uiPrefs };
}

// Ce tipuri de nevoie se recunosc dintr-un profil salvat (pentru bifele din B1 la editare).
export function needsFromProfile(p) {
  const out = [];
  if (p.avoid_stairs && p.max_kerb_cm != null && p.max_kerb_cm <= 3) out.push('mobility');
  else if (p.avoid_stairs) out.push('stroller');
  if (p.prefer_tactile || p.prefer_audio_signals) out.push('vision');
  if (p.simplified_mode) out.push('cognitive');
  if (p.needs_rest_every_m) out.push('elderly');
  const order = NEED_TYPES.map((n) => n.id);
  return out.sort((a, b) => order.indexOf(a) - order.indexOf(b));
}

export function profileSummary(p) {
  const out = [];
  if (p.avoid_stairs) out.push('Fără trepte');
  if (p.max_kerb_cm != null) out.push(`Bordură max. ${p.max_kerb_cm} cm`);
  if (p.max_incline_pct != null) out.push(`Pantă max. ${formatPercent(p.max_incline_pct)}`);
  if (p.needs_rest_every_m) out.push(`Pauze la ${p.needs_rest_every_m} m`);
  if (p.avoid_rough_surface) out.push('Evită pietrișul');
  if (p.prefer_tactile) out.push('Ghidaje tactile');
  if (p.prefer_audio_signals) out.push('Semafoare sonore');
  if (p.prefer_lit) out.push('Străzi iluminate');
  return out.slice(0, 4);
}

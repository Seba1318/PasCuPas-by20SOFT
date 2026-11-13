// Logica fără interfață a planificării traseului (D1, W10, G1, G2, G9).
import { formatPercent } from '../../lib/format.js';

export function parseLonLat(text) {
  if (!text) return null;
  const [lon, lat] = String(text).split(',').map(Number);
  if (!Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lon) > 180 || Math.abs(lat) > 90) return null;
  return [lon, lat];
}

export const formatLonLat = ([lon, lat]) => `${lon.toFixed(6)},${lat.toFixed(6)}`;

// 404 = niciun traseu nu respectă profilul (G1); 422 = punct în afara zonei (G2).
export function planErrorKind(err) {
  if (err?.status === 404) return 'no_route';
  if (err?.status === 422) return 'out_of_area';
  return 'error';
}

export function routeTags(data, profile = {}) {
  const tags = [];
  if (profile.avoid_stairs) tags.push({ tone: 'success', text: 'Fără trepte' });
  for (const w of data.warnings ?? []) tags.push({ tone: 'warning', text: w.text });
  return tags;
}

export function loadingText(profile = {}) {
  const parts = [];
  if (profile.max_kerb_cm != null) parts.push(`cu borduri sub ${profile.max_kerb_cm} cm`);
  if (profile.max_incline_pct != null) parts.push(`pante sub ${formatPercent(profile.max_incline_pct)}`);
  if (!profile.avoid_stairs && !parts.length) return 'Căutăm cel mai scurt drum pe jos.';
  const start = profile.avoid_stairs ? 'Căutăm un drum fără trepte' : 'Căutăm un drum';
  return `${start}${parts.length ? `, ${parts.join(' și ')}` : ''}.`;
}

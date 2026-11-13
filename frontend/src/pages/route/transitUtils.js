// Etapele unui traseu cu transport public (D3): o singură linie, fără schimbări (planul 20SOFT).
import { formatDistance } from '../../lib/format.js';

export function transitSummary(legs, profile = {}) {
  const walked = legs.filter((l) => l.type === 'walk').reduce((s, l) => s + l.distance_m, 0);
  const stops = legs.filter((l) => l.type === 'transit').reduce((s, l) => s + (l.stops_count ?? 0), 0);
  const parts = [`${formatDistance(walked)} pe jos`, stops === 1 ? 'o stație' : `${stops} stații`];
  if (profile.avoid_stairs) parts.push('fără trepte');
  return parts.join(' · ');
}

export function legTitle(leg) {
  if (leg.type === 'walk') return `Pe jos ${leg.duration_min} min · ${formatDistance(leg.distance_m)}`;
  return `${leg.vehicle_type} ${leg.line} · spre ${leg.headsign}`;
}

// SVG-ul unui marker, ca text, pentru L.divIcon. Forma spune categoria (design/Marker.dc.html):
// cerc alb = dotare, pătrat albastru = stație, romb lavandă = loc cu fișă,
// triunghi galben = problemă, pătrat închis = scări.
import { MARKER_COLORS } from '../../theme/mapColors.js';

const ICONS = {
  ramp: 'M3 19h18V7L3 19z',
  lift: 'M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM9 10l3-3 3 3M9 14l3 3 3-3',
  entrance:
    'M13 4h3a2 2 0 0 1 2 2v14M2 20h3M13 20h9M10 12v.01M13 4.562v16.157a1 1 0 0 1-1.242.97L5 20V5.562a2 2 0 0 1 1.515-1.94l4-1A2 2 0 0 1 13 4.561Z',
  tactile: 'M6 3v18M10 3v18M14 3v18M18 3v18',
  sound:
    'M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298zM16 9a5 5 0 0 1 0 6M19.364 18.364a9 9 0 0 0 0-12.728',
  bench: 'M5 8h14M4 13h16M6 13v6M18 13v6M7 8v5M17 8v5',
};
const TEXTS = { wc: ['WC', 13, 29], parking: ['P', 19, 31] };
const BUS =
  'M8 6v6M15 6v6M2 12h19.6M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3M9 18h5M5 18a2 2 0 1 0 4 0 2 2 0 1 0-4 0M14 18a2 2 0 1 0 4 0 2 2 0 1 0-4 0';

export const MARKER_TYPES = [...Object.keys(ICONS), ...Object.keys(TEXTS), 'station', 'place', 'problem', 'stairs', 'user', 'dest'];

// Categoriile din API (places.category) → tipul de marker.
const CATEGORY_TO_TYPE = {
  ramp: 'ramp', lift: 'lift', entrance: 'entrance', toilet: 'wc', parking: 'parking',
  tactile: 'tactile', audio_signal: 'sound', bench: 'bench', building: 'place',
};
export const markerTypeFor = (category) => CATEGORY_TO_TYPE[category] ?? 'place';

const icon = (d, ink) =>
  `<g transform="translate(14 14) scale(0.8333)"><path d="${d}" fill="none" stroke="${ink}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></g>`;

function shape(type, c) {
  if (ICONS[type] || TEXTS[type]) {
    const body = TEXTS[type]
      ? `<text x="24" y="${TEXTS[type][2]}" text-anchor="middle" font-family="Atkinson Hyperlegible Next, Lexend, sans-serif" font-size="${TEXTS[type][1]}" font-weight="800" fill="${c.ink}">${TEXTS[type][0]}</text>`
      : icon(ICONS[type], c.ink);
    return `<circle cx="24" cy="24" r="18" fill="${c.fill}" stroke="${c.ink}" stroke-width="3"/>${body}`;
  }
  switch (type) {
    case 'station':
      return `<rect x="6" y="6" width="36" height="36" rx="7" fill="${c.stationFill}" stroke="${c.ink}" stroke-width="3"/>${icon(BUS, c.ink)}`;
    case 'problem':
      return `<path d="M24 5 L44 41 H4 Z" fill="${c.problemFill}" stroke="${c.problemInk}" stroke-width="3" stroke-linejoin="round"/><path d="M24 18v11M24 35v.5" stroke="${c.problemInk}" stroke-width="4" stroke-linecap="round"/>`;
    case 'stairs':
      return `<rect x="5" y="5" width="38" height="38" rx="10" fill="${c.stairsFill}" stroke="${c.stairsStroke}" stroke-width="3"/><path d="M12 35 H19 V28 H26 V21 H33 V14 H37" fill="none" stroke="${c.stairsInk}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`;
    case 'user':
      return `<circle cx="24" cy="24" r="22" fill="${c.userHalo}" fill-opacity="0.18"/><circle cx="24" cy="24" r="10" fill="${c.user}" stroke="${c.userRing}" stroke-width="4"/>`;
    case 'dest':
      return `<path d="M24 44 C12 30 9 22 9 17 a15 15 0 0 1 30 0 c0 5 -3 13 -15 27z" fill="${c.dest}" stroke="${c.destStroke}" stroke-width="3"/><circle cx="24" cy="17" r="5.5" fill="${c.destDot}"/>`;
    default: // place
      return `<rect x="11" y="11" width="26" height="26" rx="4" transform="rotate(45 24 24)" fill="${c.placeFill}" stroke="${c.ink}" stroke-width="3"/><circle cx="24" cy="24" r="4" fill="${c.ink}"/>`;
  }
}

export function markerSvg({ type, selected = false, highContrast = false }) {
  const c = MARKER_COLORS[highContrast ? 'high' : 'normal'];
  const ring = selected ? `<circle cx="24" cy="24" r="23" fill="none" stroke="${c.ring}" stroke-width="3"/>` : '';
  return `<svg width="48" height="48" viewBox="0 0 48 48" aria-hidden="true" focusable="false">${ring}${shape(type, c)}</svg>`;
}

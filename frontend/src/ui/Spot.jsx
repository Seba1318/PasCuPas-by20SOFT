import { SPOTS } from './spots.js';

const BG = {
  sky: 'fill-sky',
  lavender: 'fill-lavender',
  peach: 'fill-peach',
  mint: 'fill-mint',
  'warning-bg': 'fill-warning-bg',
};

// Ilustrație mică decorativă (design/Spot.dc.html), 200×160 la lățimea `w`.
export default function Spot({ kind = 'welcome', w = 200, className = '' }) {
  const spot = SPOTS[kind] ?? SPOTS.welcome;
  return (
    <svg
      width={w}
      height={Math.round(w * 0.8)}
      viewBox="0 0 200 160"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <circle cx="100" cy="82" r="70" className={BG[spot.bg]} />
      {/* desen static din design, fără date de la utilizator */}
      <g dangerouslySetInnerHTML={{ __html: spot.svg }} />
    </svg>
  );
}

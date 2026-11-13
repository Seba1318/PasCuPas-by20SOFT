import { ArrowUpDown, Bus, Car, Construction, Ellipsis, Footprints, Volume2 } from 'lucide-react';

// Iconița fiecărei categorii; rampa și bordura sunt desenate ca în design (E1).
function Ramp(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 19h18V7L3 19z" />
    </svg>
  );
}
function Kerb(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M2 18h8v-6h12M10 12v6" />
    </svg>
  );
}
function Tactile(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" {...props}>
      <path d="M6 3v18M10 3v18M14 3v18M18 3v18" />
    </svg>
  );
}

const ICONS = {
  ramp: Ramp,
  car: Car,
  lift: ArrowUpDown,
  works: Construction,
  tactile: Tactile,
  kerb: Kerb,
  sound: Volume2,
  bus: Bus,
  other: Ellipsis,
  walk: Footprints,
};

const TINTS = {
  peach: 'bg-peach',
  sky: 'bg-sky',
  lavender: 'bg-lavender',
  'warning-bg': 'bg-warning-bg',
  mint: 'bg-mint',
  subtle: 'bg-subtle',
};

export default function CategoryIcon({ category, size = 'md' }) {
  const Icon = ICONS[category.icon] ?? Ellipsis;
  const box = size === 'sm' ? 'h-10 w-10 rounded-icon' : 'h-14 w-14 rounded-field';
  return (
    <span aria-hidden="true" className={`flex flex-none items-center justify-center text-ink ${box} ${TINTS[category.tint]}`}>
      <Icon className={size === 'sm' ? 'h-5 w-5' : 'h-7 w-7'} strokeWidth={2.5} />
    </span>
  );
}

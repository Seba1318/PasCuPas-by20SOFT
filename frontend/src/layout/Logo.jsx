import { Link } from 'react-router-dom';

// Simbolul ales (design/Main · varianta A, „Pași”): două urme pe coral.
export function LogoMark({ size = 36, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false" className={className}>
      <rect width="64" height="64" rx="18" className="fill-primary" />
      <g className="fill-on-primary">
        <ellipse cx="23" cy="44" rx="5.5" ry="8.5" transform="rotate(25 23 44)" />
        <circle cx="27.8" cy="33.4" r="2.9" />
        <ellipse cx="40" cy="31" rx="5.5" ry="8.5" transform="rotate(25 40 31)" />
        <circle cx="44.8" cy="20.4" r="2.9" />
      </g>
    </svg>
  );
}

export function Wordmark({ className = '' }) {
  return (
    <span className={`text-[22px] font-extrabold ${className}`}>
      Pas <span className="font-medium text-ink-muted">cu</span> Pas
    </span>
  );
}

// `compact`: pe tabletă rămâne doar simbolul; numele se citește în continuare de cititoarele de ecran.
export default function Logo({ to = '/', size = 36, compact = false }) {
  return (
    <Link to={to} className="flex min-h-target flex-none items-center gap-2.5 text-ink no-underline hover:text-ink">
      <LogoMark size={size} />
      <Wordmark className={compact ? 'sr-only lg:not-sr-only' : ''} />
      <span className="sr-only">, pagina principală</span>
    </Link>
  );
}

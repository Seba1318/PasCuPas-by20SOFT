// Lățimile din design: telefon (A–G), tabletă (W12, X14), desktop (W1–W16).
export const TABLET_MIN = 768;
export const DESKTOP_MIN = 1280;

export function breakpointFor(width) {
  if (width >= DESKTOP_MIN) return 'desktop';
  if (width >= TABLET_MIN) return 'tablet';
  return 'phone';
}

export function panelWidth(breakpoint, collapsed) {
  if (breakpoint === 'phone') return 0;
  if (collapsed) return 72;
  return breakpoint === 'desktop' ? 420 : 360;
}

// Secțiunile principale: bara de taburi pe telefon, bara de sus pe tabletă și desktop.
export const NAV_ITEMS = [
  { id: 'harta', label: 'Hartă', to: '/' },
  { id: 'traseu', label: 'Traseu', to: '/traseu' },
  { id: 'raporteaza', label: 'Raportează', to: '/raporteaza' },
  { id: 'profil', label: 'Profil', to: '/profil' },
];

export function activeNav(pathname) {
  if (pathname.startsWith('/traseu') || pathname.startsWith('/navigare')) return 'traseu';
  if (pathname.startsWith('/raporteaza') || pathname.startsWith('/raport/')) return 'raporteaza';
  if (pathname.startsWith('/profil') || pathname.startsWith('/rapoartele-mele') || pathname.startsWith('/confidentialitate')) {
    return 'profil';
  }
  return 'harta';
}

// Navigarea cu GPS e pentru telefon. Un telefon rotit are lățimea unei tablete, dar rămâne telefon:
// îl recunoaștem după latura scurtă a ecranului, la un ecran tactil.
export function isPhoneScreen({ width, height, coarse }) {
  if (width < TABLET_MIN) return true;
  return coarse && Math.min(width, height) < TABLET_MIN;
}

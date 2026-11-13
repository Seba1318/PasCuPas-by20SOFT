// Culorile desenelor de pe hartă (markere, trasee). Leaflet desenează în afara arborelui React,
// deci aici avem valorile din design/Marker.dc.html și design/Culori.dc.html, pe teme.
export const MARKER_COLORS = {
  normal: {
    fill: '#FFFFFF', ink: '#1E293B', stationFill: '#E6F0FF', placeFill: '#EEEBFF',
    problemFill: '#FDE68A', problemInk: '#1E293B', stairsFill: '#1E293B', stairsStroke: '#FFFFFF', stairsInk: '#FFFFFF',
    user: '#2563EB', userRing: '#FFFFFF', userHalo: '#2563EB', dest: '#E2553A', destStroke: '#FFFFFF', destDot: '#FFFFFF',
    ring: '#2563EB',
  },
  high: {
    fill: '#000000', ink: '#FFFFFF', stationFill: '#000000', placeFill: '#000000',
    problemFill: '#FFFFFF', problemInk: '#000000', stairsFill: '#000000', stairsStroke: '#FFFFFF', stairsInk: '#FFFFFF',
    user: '#FFFFFF', userRing: '#000000', userHalo: '#FFFFFF', dest: '#FFE600', destStroke: '#000000', destDot: '#000000',
    ring: '#FFFFFF',
  },
};

// Traseele: coral cu contur (alb pe luminos, închis pe întunecat), galben în contrast ridicat.
export const ROUTE_COLORS = {
  light: { route: '#E2553A', casing: '#FFFFFF', blocked: '#94A3B8' },
  dark: { route: '#FF8A6B', casing: '#121826', blocked: '#64748B' },
  high: { route: '#FFE600', casing: '#FFFFFF', blocked: '#FFFFFF' },
};

// Hașura lucrărilor: dungi diagonale galben/gri.
export const WORKS_COLORS = { stripeA: '#FDE68A', stripeB: '#94A3B8', outline: '#1E293B' };

// Conturul zonei acoperite (G2).
export const ZONE_COLOR = '#2563EB';

// Harta termică: de la galben deschis la roșu-coral, fără verde (roșu–verde nu e singura diferență:
// legenda spune în cuvinte „puține” și „multe”).
export const HEAT_GRADIENT = { 0.2: '#FEF9C3', 0.45: '#FDE68A', 0.7: '#FF9478', 1: '#B91C1C' };

// Citește variabilele Vite. În testele rulate cu Node, import.meta.env nu există,
// deci fiecare valoare are o rezervă.
const env = import.meta.env ?? {};

function parseBbox(text) {
  const parts = String(text).split(',').map(Number);
  if (parts.length !== 4 || parts.some(Number.isNaN)) return null;
  return parts;
}

export const API_URL = env.VITE_API_URL ?? 'http://localhost:8000'; // sau '/api', prin proxy-ul Vite
export const USE_MOCKS = String(env.VITE_USE_MOCKS ?? 'true') === 'true';
// Tile-uri OpenStreetMap: bune pentru demo, nu pentru trafic real (Observații §4).
// Pentru lansare: un furnizor cu cont; atribuirea lui se adaugă lângă cea OSM.
export const TILE_URL = env.VITE_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
// Gol = aceleași tile-uri, întunecate cu filtru CSS (.map-dark în index.css).
export const TILE_URL_DARK = env.VITE_TILE_URL_DARK || '';
export const TILE_ATTRIBUTION =
  env.VITE_TILE_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

// [minLon, minLat, maxLon, maxLat]: Complexul Studențesc, UVT, UPT, UMF.
export const DEMO_BBOX = parseBbox(env.VITE_DEMO_BBOX ?? '') ?? [21.215, 45.738, 21.248, 45.756];
// [lon, lat]: între Complex și Piața Victoriei.
export const DEMO_CENTER = [21.2315, 45.7485];
export const DEMO_ZOOM = 16;

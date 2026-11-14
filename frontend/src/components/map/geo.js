// Singurul loc unde se întâlnesc cele două convenții de coordonate:
// API-ul folosește GeoJSON [lon, lat], Leaflet folosește [lat, lon].
const EARTH_RADIUS_M = 6371008.8;
const rad = (deg) => (deg * Math.PI) / 180;

export const toLatLng = ([lon, lat]) => [lat, lon];

// Acceptă [lat, lon] sau un L.LatLng ({lat, lng}).
export function toLonLat(latLng) {
  if (Array.isArray(latLng)) return [latLng[1], latLng[0]];
  return [latLng.lng, latLng.lat];
}

export const lineToLatLngs = (coords) => coords.map(toLatLng);

// L.LatLngBounds → „minLon,minLat,maxLon,maxLat”, cu 5 zecimale (~1 m).
export function bboxFromBounds(bounds) {
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  return [sw.lng, sw.lat, ne.lng, ne.lat].map((n) => Number(n.toFixed(5))).join(',');
}

export const bboxToLatLngBounds = ([minLon, minLat, maxLon, maxLat]) => [
  [minLat, minLon],
  [maxLat, maxLon],
];

// Distanța haversine în metri între două puncte [lon, lat].
export function distanceM([lon1, lat1], [lon2, lat2]) {
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

// Distanța în metri de la un punct la o linie [lon, lat][].
// Proiecție plană locală în jurul punctului: exactă la câteva sute de metri.
export function distanceToLineM(point, line) {
  if (line.length === 1) return distanceM(point, line[0]);
  const [plon, plat] = point;
  const mPerLat = (Math.PI / 180) * EARTH_RADIUS_M;
  const mPerLon = mPerLat * Math.cos(rad(plat));
  const xy = ([lon, lat]) => [(lon - plon) * mPerLon, (lat - plat) * mPerLat];

  let best = Infinity;
  for (let i = 0; i < line.length - 1; i++) {
    const [ax, ay] = xy(line[i]);
    const [bx, by] = xy(line[i + 1]);
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return best;
}

// Proiecția unui punct pe o linie: cât s-a parcurs de la început (along, în metri) și cât de departe e de linie.
export function projectOnLine(point, line) {
  const [plon, plat] = point;
  const mPerLat = (Math.PI / 180) * EARTH_RADIUS_M;
  const mPerLon = mPerLat * Math.cos(rad(plat));
  const xy = ([lon, lat]) => [(lon - plon) * mPerLon, (lat - plat) * mPerLat];
  let best = { distance: Infinity, along: 0 };
  let walked = 0;
  for (let i = 0; i < line.length - 1; i++) {
    const [ax, ay] = xy(line[i]);
    const [bx, by] = xy(line[i + 1]);
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy);
    const t = len === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (len * len)));
    const d = Math.hypot(ax + t * dx, ay + t * dy);
    if (d < best.distance) best = { distance: d, along: walked + t * len };
    walked += len;
  }
  return { ...best, total: walked };
}

// Cel mai apropiat punct GeoJSON de `point`, la cel mult maxM metri; null dacă nu e niciunul.
export function nearestFeature(point, features, maxM = Infinity) {
  let best = null;
  let bestD = maxM;
  for (const f of features) {
    const d = distanceM(point, f.geometry.coordinates);
    if (d <= bestD) {
      best = f;
      bestD = d;
    }
  }
  return best;
}

// [minLon, minLat, maxLon, maxLat] care cuprinde un cerc de `meters` în jurul punctului [lon, lat].
export function bboxAround([lon, lat], meters) {
  const dLat = meters / ((Math.PI / 180) * EARTH_RADIUS_M);
  const dLon = dLat / Math.cos(rad(lat));
  return [lon - dLon, lat - dLat, lon + dLon, lat + dLat];
}

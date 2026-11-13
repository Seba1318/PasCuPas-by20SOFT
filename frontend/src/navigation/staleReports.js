// „Încă e stricat?” (D9): întrebăm despre un raport activ la cel mult 30 m, mai vechi de 3 zile,
// o singură dată pe raport (planul 20SOFT · Reguli pentru confirmări).
import { distanceM } from '../components/map/geo.js';

const NEAR_M = 30;
const OLD_MS = 3 * 24 * 3600 * 1000;

export function findStaleReport(point, reports, now = new Date(), askedIds = new Set()) {
  for (const r of reports) {
    const p = r.properties;
    if (p.status !== 'in_lucru' || askedIds.has(r.id)) continue;
    if (now - new Date(p.created_at) < OLD_MS) continue;
    if (distanceM(point, r.geometry.coordinates) <= NEAR_M) return r;
  }
  return null;
}

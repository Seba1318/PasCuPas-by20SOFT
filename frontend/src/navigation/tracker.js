// Urmărirea poziției pe traseu (planul 20SOFT · Navigarea în timp real; Observații §5).
// Funcție pură: primește pozițiile una câte una și spune ce trebuie să facă ecranul.
import { distanceM, projectOnLine } from '../components/map/geo.js';

/**
 * line: [lon, lat][] — traseul; steps: [{ instruction, coord: [lon, lat] }].
 * update(pos) întoarce unul dintre:
 *   { type: 'weak_gps' }                         precizie mai slabă de maxAccuracyM: poziția e ignorată
 *   { type: 'off_route' }                        două poziții consecutive la peste offRouteM de traseu
 *   { type: 'announce', step, index, ... }       manevra următoare e la cel mult announceM (o singură dată)
 *   { type: 'arrived' }                          la cel mult arriveM de capăt
 *   { type: 'progress', remaining_m, nextIndex, toNext_m }
 */
export function createTracker({ line, steps, offRouteM = 25, maxAccuracyM = 50, announceM = 15, arriveM = 15 }) {
  const end = line[line.length - 1];
  const stepAlong = steps.map((s) => projectOnLine(s.coord, line).along);
  const announced = new Set();
  let offCount = 0;

  return {
    update({ lon, lat, accuracy }) {
      if (accuracy != null && accuracy > maxAccuracyM) return { type: 'weak_gps' };
      const p = [lon, lat];
      if (distanceM(p, end) <= arriveM) return { type: 'arrived' };

      const { distance, along, total } = projectOnLine(p, line);
      if (distance > offRouteM) {
        offCount += 1;
        if (offCount >= 2) {
          offCount = 0;
          return { type: 'off_route' };
        }
      } else {
        offCount = 0;
      }

      let nextIndex = stepAlong.findIndex((a, i) => i > 0 && a > along + 1);
      if (nextIndex < 0) nextIndex = steps.length - 1;
      const toNext = Math.max(0, stepAlong[nextIndex] - along);
      const base = { remaining_m: Math.max(0, total - along), nextIndex, toNext_m: toNext };

      if (toNext <= announceM && !announced.has(nextIndex) && nextIndex < steps.length - 1) {
        announced.add(nextIndex);
        return { type: 'announce', step: steps[nextIndex], index: nextIndex, ...base };
      }
      return { type: 'progress', ...base };
    },
  };
}

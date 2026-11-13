import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pointsAlong, maneuverOf, etaClock } from './simulate.js';
import { distanceM } from '../components/map/geo.js';

test('points every ~12 m along the route, ending at the destination', () => {
  const line = [[21.23, 45.747], [21.231, 45.747]]; // ~78 m
  const pts = pointsAlong(line, 12);
  assert.ok(pts.length >= 7 && pts.length <= 8, `got ${pts.length}`);
  assert.deepEqual(pts.at(-1), [21.231, 45.747]);
  for (let i = 1; i < pts.length; i++) assert.ok(distanceM(pts[i - 1], pts[i]) <= 12.5);
});

test('maneuver direction from the Romanian instruction', () => {
  assert.equal(maneuverOf('Virează la stânga pe lângă cantină'), 'left');
  assert.equal(maneuverOf('Virează la dreapta pe Bd. Vasile Pârvan'), 'right');
  assert.equal(maneuverOf('Traversează la semaforul sonor'), 'cross');
  assert.equal(maneuverOf('Ai ajuns la rampă'), 'arrive');
  assert.equal(maneuverOf('Continuă înainte'), 'straight');
});

test('arrival clock from remaining minutes', () => {
  assert.equal(etaClock(14, new Date('2026-10-18T11:18:00Z')), '14:32');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTracker } from './tracker.js';

// Linie dreaptă spre est, ~1 km, la latitudinea Timișoarei; 1 m ≈ 0.0000128° longitudine.
const LAT = 45.747;
const M_LON = 1 / (111195 * Math.cos((LAT * Math.PI) / 180));
const M_LAT = 1 / 111195;
const at = (east, north = 0) => [21.23 + east * M_LON, LAT + north * M_LAT];
const line = [at(0), at(500), at(1000)];
const steps = [
  { instruction: 'Pornește spre est', coord: at(0) },
  { instruction: 'Continuă înainte', coord: at(500) },
  { instruction: 'Ai ajuns', coord: at(1000) },
];
const pos = (east, north = 0, accuracy = 8) => {
  const [lon, lat] = at(east, north);
  return { lon, lat, accuracy };
};

test('weak GPS (accuracy over 50 m) is reported and ignored for off-route', () => {
  const t = createTracker({ line, steps });
  assert.equal(t.update(pos(100, 80, 80)).type, 'weak_gps');
  assert.equal(t.update(pos(100, 0)).type, 'progress');
});

test('one position 40 m off the line does not trigger a reroute', () => {
  const t = createTracker({ line, steps });
  assert.equal(t.update(pos(100, 40)).type, 'progress');
  assert.equal(t.update(pos(110, 0)).type, 'progress');
});

test('two consecutive positions over 25 m off the line trigger off_route', () => {
  const t = createTracker({ line, steps });
  assert.equal(t.update(pos(100, 30)).type, 'progress');
  assert.equal(t.update(pos(105, 35)).type, 'off_route');
});

test('a step is announced about 15 m before, only once', () => {
  const t = createTracker({ line, steps });
  t.update(pos(400));
  const e = t.update(pos(486));
  assert.equal(e.type, 'announce');
  assert.equal(e.index, 1);
  assert.equal(e.step.instruction, 'Continuă înainte');
  assert.equal(t.update(pos(490)).type, 'progress');
});

test('arrival within 15 m of the end', () => {
  const t = createTracker({ line, steps });
  assert.equal(t.update(pos(990)).type, 'arrived');
});

test('progress reports the remaining distance along the route', () => {
  const t = createTracker({ line, steps });
  const e = t.update(pos(200));
  assert.equal(e.type, 'progress');
  assert.ok(Math.abs(e.remaining_m - 800) < 5, `got ${e.remaining_m}`);
  assert.equal(e.nextIndex, 1);
});

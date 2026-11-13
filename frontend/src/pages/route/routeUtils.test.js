import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLonLat, formatLonLat, planErrorKind, routeTags, loadingText } from './routeUtils.js';

test('coordinates in the URL are lon,lat', () => {
  assert.deepEqual(parseLonLat('21.2257,45.7536'), [21.2257, 45.7536]);
  assert.equal(parseLonLat('nimic'), null);
  assert.equal(parseLonLat('200,45'), null);
  assert.equal(parseLonLat(null), null);
  assert.equal(formatLonLat([21.22571234, 45.75361234]), '21.225712,45.753612');
});

test('API errors map to the design states G1 and G2', () => {
  assert.equal(planErrorKind({ status: 404 }), 'no_route');
  assert.equal(planErrorKind({ status: 422 }), 'out_of_area');
  assert.equal(planErrorKind({ status: 0 }), 'error');
});

test('route tags say what the route respects, in words', () => {
  const data = { warnings: [{ type: 'incline', text: 'Pantă de 5 % pe 40 m, lângă podul de pe Bega.' }] };
  assert.deepEqual(routeTags(data, { avoid_stairs: true }), [
    { tone: 'success', text: 'Fără trepte' },
    { tone: 'warning', text: 'Pantă de 5 % pe 40 m, lângă podul de pe Bega.' },
  ]);
  assert.deepEqual(routeTags({ warnings: [] }, { avoid_stairs: false }), []);
});

test('loading text follows the profile (G9)', () => {
  assert.equal(
    loadingText({ avoid_stairs: true, max_kerb_cm: 3, max_incline_pct: 6 }),
    'Căutăm un drum fără trepte, cu borduri sub 3 cm și pante sub 6 %.',
  );
  assert.equal(loadingText({}), 'Căutăm cel mai scurt drum pe jos.');
});

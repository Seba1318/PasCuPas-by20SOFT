import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transitSummary, legTitle } from './transitUtils.js';

const legs = [
  { type: 'walk', distance_m: 220, duration_min: 4, to_name: 'Stația Complex Studențesc' },
  { type: 'transit', line: '1', vehicle_type: 'Tramvai', headsign: 'Piața Victoriei', stops_count: 3, duration_min: 7, alight_stop: 'Stația Piața Victoriei' },
  { type: 'walk', distance_m: 230, duration_min: 3, to_name: 'Rectoratul UPT' },
];

test('summary: walking distance, stops, no stairs', () => {
  assert.equal(transitSummary(legs, { avoid_stairs: true }), '450 m pe jos · 3 stații · fără trepte');
  assert.equal(transitSummary(legs, {}), '450 m pe jos · 3 stații');
  assert.equal(transitSummary([legs[0], { ...legs[1], stops_count: 1 }], {}), '220 m pe jos · o stație');
});

test('leg titles in words', () => {
  assert.equal(legTitle(legs[0]), 'Pe jos 4 min · 220 m');
  assert.equal(legTitle(legs[1]), 'Tramvai 1 · spre Piața Victoriei');
});

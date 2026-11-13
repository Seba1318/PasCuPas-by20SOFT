import { test } from 'node:test';
import assert from 'node:assert/strict';
import { overviewKpis, rankZones, heatToLeaflet, zonesCsv } from './statsUtils.js';

const now = new Date('2026-10-18T12:00:00Z');
const reports = [
  { status: 'in_lucru', created_at: '2026-10-18T08:00:00Z' },
  { status: 'in_lucru', created_at: '2026-10-10T08:00:00Z' },
  { status: 'rezolvat', created_at: '2026-10-05T08:00:00Z', resolved_at: '2026-10-15T08:00:00Z' },
  { status: 'rezolvat', created_at: '2026-09-01T08:00:00Z', resolved_at: '2026-09-04T08:00:00Z' },
  { status: 'respins', created_at: '2026-10-12T08:00:00Z', resolved_at: '2026-10-13T08:00:00Z' },
];
const zones = [
  { zone: 'Complexul Studențesc', open_count: 9, avg_resolution_days: 4, last_action_days: 21 },
  { zone: 'Bd. Vasile Pârvan', open_count: 12, avg_resolution_days: 2.5, last_action_days: 2 },
  { zone: 'Piața Victoriei', open_count: 7, avg_resolution_days: 3, last_action_days: 16 },
];

test('KPIs from reports and zones, in words', () => {
  assert.deepEqual(overviewKpis(reports, zones, now), [
    { id: 'active', label: 'Rapoarte active', value: '2', note: '1 noi azi' },
    { id: 'resolved', label: 'Rezolvate în ultimele 7 zile', value: '1', note: 'Rapoarte închise ca rezolvate' },
    { id: 'avg', label: 'Timp mediu de rezolvare', value: '6,5 zile', note: 'Din trimitere până la „Rezolvat”' },
    { id: 'neglected', label: 'Zone neglijate', value: '2', note: 'Fără intervenție de peste 14 zile' },
  ]);
});

test('zones are ranked by open reports, with the share of the top zone', () => {
  const r = rankZones(zones);
  assert.deepEqual(r.map((z) => [z.rank, z.zone, z.pct]), [
    [1, 'Bd. Vasile Pârvan', 100],
    [2, 'Complexul Studențesc', 75],
    [3, 'Piața Victoriei', 58],
  ]);
  assert.equal(r[1].neglected, true);
});

test('heatmap points become [lat, lon, weight] for leaflet.heat', () => {
  assert.deepEqual(heatToLeaflet([[21.23, 45.74, 3]]), [[45.74, 21.23, 3]]);
});

test('CSV export with Romanian headers and quoted names', () => {
  assert.equal(
    zonesCsv(rankZones(zones.slice(0, 1))),
    'Loc;Zonă;Rapoarte active;Timp mediu de rezolvare (zile);Zile fără intervenție\n1;"Complexul Studențesc";9;4;21',
  );
});

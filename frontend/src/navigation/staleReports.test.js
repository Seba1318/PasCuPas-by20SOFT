import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findStaleReport } from './staleReports.js';

const now = new Date('2026-10-20T12:00:00Z');
const report = (id, metersNorth, createdAt, status = 'in_lucru') => ({
  id,
  geometry: { coordinates: [21.23, 45.747 + metersNorth / 111195] },
  properties: { id, status, created_at: createdAt },
});

test('asks about an active report within 30 m that is older than 3 days', () => {
  const r = report(1, 25, '2026-10-16T09:00:00Z');
  assert.equal(findStaleReport([21.23, 45.747], [r], now, new Set())?.id, 1);
});

test('does not ask if too far, too recent, closed or already asked', () => {
  const here = [21.23, 45.747];
  assert.equal(findStaleReport(here, [report(1, 35, '2026-10-16T09:00:00Z')], now, new Set()), null);
  assert.equal(findStaleReport(here, [report(2, 10, '2026-10-18T09:00:00Z')], now, new Set()), null);
  assert.equal(findStaleReport(here, [report(3, 10, '2026-10-10T09:00:00Z', 'rezolvat')], now, new Set()), null);
  assert.equal(findStaleReport(here, [report(4, 10, '2026-10-10T09:00:00Z')], now, new Set([4])), null);
});

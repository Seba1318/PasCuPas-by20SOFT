import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatDistance, formatDuration, formatDate, formatDateTime, formatRelative, formatPercent } from './format.js';

test('distance uses metres under 1 km and comma decimals above', () => {
  assert.equal(formatDistance(900), '900 m');
  assert.equal(formatDistance(1200), '1,2 km');
  assert.equal(formatDistance(1050), '1,1 km');
  assert.equal(formatDistance(2000), '2 km');
});

test('duration in minutes and hours', () => {
  assert.equal(formatDuration(16), '16 min');
  assert.equal(formatDuration(60), '1 h');
  assert.equal(formatDuration(75), '1 h 15 min');
});

test('dates use Romanian months in Europe/Bucharest', () => {
  assert.equal(formatDate('2026-10-18T07:24:00Z'), '18 oct. 2026');
  assert.equal(formatDateTime('2026-10-18T07:24:00Z'), '18 oct., 10:24');
});

test('relative dates', () => {
  const now = new Date('2026-10-18T12:00:00Z');
  assert.equal(formatRelative('2026-10-18T11:40:00Z', now), 'acum 20 de minute');
  assert.equal(formatRelative('2026-10-18T11:59:30Z', now), 'chiar acum');
  assert.equal(formatRelative('2026-10-17T10:00:00Z', now), 'ieri');
  assert.equal(formatRelative('2026-10-16T09:00:00Z', now), 'acum 2 zile');
  assert.equal(formatRelative('2026-10-18T09:00:00Z', now), 'acum 3 ore');
  assert.equal(formatRelative('2026-10-18T11:00:00Z', now), 'acum o oră');
});

test('percent uses non-breaking space and comma', () => {
  assert.equal(formatPercent(6), '6 %');
  assert.equal(formatPercent(5.5), '5,5 %');
});

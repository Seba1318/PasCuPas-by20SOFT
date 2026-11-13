import { test } from 'node:test';
import assert from 'node:assert/strict';
import { workGeometry, validateWork, validateProject, validateEdge, vehicleSummary, parseRoDate } from './formsUtils.js';

test('a polygon is closed; a line stays open', () => {
  const pts = [[21.1, 45.1], [21.2, 45.1], [21.2, 45.2]];
  assert.deepEqual(workGeometry(pts, 'polygon'), { type: 'Polygon', coordinates: [[...pts, pts[0]]] });
  assert.deepEqual(workGeometry(pts.slice(0, 2), 'line'), { type: 'LineString', coordinates: pts.slice(0, 2) });
  assert.equal(workGeometry(pts.slice(0, 2), 'polygon'), null);
  assert.equal(workGeometry([pts[0]], 'line'), null);
});

test('works need a title, ordered dates and a drawn area', () => {
  assert.deepEqual(validateWork({ title: '', start_date: '2026-11-04', end_date: '2026-10-21', geometry: null }), {
    title: 'Scrie un titlu pentru lucrare.',
    end_date: 'Data de final e înaintea celei de început.',
    geometry: 'Desenează zona pe hartă: cel puțin 3 puncte pentru o zonă sau 2 pentru o stradă.',
  });
  assert.deepEqual(validateWork({ title: 'Trotuar', start_date: '2026-10-21', end_date: '2026-11-04', geometry: { type: 'LineString' } }), {});
});

test('projects: title and dates', () => {
  assert.deepEqual(validateProject({ title: 'x', start_date: '', end_date: '' }), { start_date: 'Alege data de început.' });
});

test('edge attributes stay within sensible limits', () => {
  assert.deepEqual(validateEdge({ kerb_height_cm: 40, incline_pct: 3 }), { kerb_height_cm: 'Bordura trebuie să fie între 0 și 30 cm.' });
  assert.deepEqual(validateEdge({ kerb_height_cm: 8, incline_pct: -2 }), { incline_pct: 'Panta trebuie să fie între 0 și 30 %.' });
  assert.deepEqual(validateEdge({ kerb_height_cm: 8, incline_pct: 3 }), {});
});

test('vehicle summary counts broken equipment', () => {
  const v = [
    { has_ramp: true, ramp_ok: false, has_audio_announce: true, audio_ok: true, open_reports: 2 },
    { has_ramp: true, ramp_ok: true, has_audio_announce: true, audio_ok: false, open_reports: 1 },
    { has_ramp: true, ramp_ok: false, has_audio_announce: true, audio_ok: true, open_reports: 0 },
  ];
  assert.deepEqual(vehicleSummary(v), { rampBroken: 2, audioBroken: 1, openReports: 3 });
});

test('Romanian date input dd.mm.yyyy becomes ISO', () => {
  assert.equal(parseRoDate('21.10.2026'), '2026-10-21');
  assert.equal(parseRoDate('2026-10-21'), '2026-10-21');
  assert.equal(parseRoDate('31.02.2026'), null);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTimeline, confirmationText } from './timeline.js';

test('in progress: sent is done, in progress is current, resolved not yet', () => {
  const t = buildTimeline({
    status: 'in_lucru',
    created_at: '2026-10-18T07:24:00Z',
    timeline: [{ status: 'in_lucru', at: '2026-10-18T12:02:00Z', by: 'Primăria Timișoara' }],
  });
  assert.deepEqual(t.map((s) => [s.label, s.state]), [['Trimis', 'done'], ['În lucru', 'current'], ['Rezolvat', 'next']]);
  assert.equal(t[0].when, '18 oct., 10:24');
  assert.equal(t[1].when, '18 oct., 15:02 · preluat de Primăria Timișoara');
  assert.equal(t[2].when, 'Încă nu');
});

test('resolved: every step done, last one current', () => {
  const t = buildTimeline({ status: 'rezolvat', created_at: '2026-10-18T07:24:00Z', resolved_at: '2026-10-20T08:00:00Z', timeline: [] });
  assert.deepEqual(t.map((s) => s.state), ['done', 'done', 'current']);
  assert.equal(t[2].when, '20 oct., 11:00');
});

test('rejected: the third step says so in words', () => {
  const t = buildTimeline({ status: 'respins', created_at: '2026-10-18T07:24:00Z', timeline: [] });
  assert.deepEqual(t.map((s) => s.label), ['Trimis', 'În lucru', 'Respins']);
  assert.equal(t[2].state, 'current');
});

test('confirmation counter in words', () => {
  assert.equal(confirmationText(0), 'Încă neconfirmat de alte persoane');
  assert.equal(confirmationText(1), 'Confirmat de o persoană');
  assert.equal(confirmationText(3), 'Confirmat de 3 persoane');
  assert.equal(confirmationText(21), 'Confirmat de 21 de persoane');
});

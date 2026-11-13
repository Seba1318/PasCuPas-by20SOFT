import { test } from 'node:test';
import assert from 'node:assert/strict';
import { displayName, trustInfo, filterReports, REPORT_FILTERS, sortByDate } from './accountUtils.js';

test('trust levels from the plan (100 / 50 / 0) in words', () => {
  assert.deepEqual(trustInfo(100, 3), {
    level: 2,
    title: 'Încredere ridicată',
    text: 'Rapoartele tale ocolesc imediat traseele celorlalți. Mulțumim că ajuți!',
  });
  assert.equal(trustInfo(50, 2).title, 'Încredere medie');
  assert.equal(trustInfo(50, 2).text, 'Rapoartele tale au nevoie de o confirmare ca să ocolească traseele. Încă 3 rapoarte confirmate până la nivelul următor.');
  assert.equal(trustInfo(0, 0).level, 0);
  assert.equal(trustInfo(0, 0).title, 'Raportare suspendată');
});

test('report filters: all, in progress, resolved, rejected', () => {
  const list = [{ status: 'in_lucru' }, { status: 'rezolvat' }, { status: 'respins' }, { status: 'in_lucru' }];
  assert.deepEqual(REPORT_FILTERS.map((f) => f.label), ['Toate', 'În lucru', 'Rezolvate', 'Respinse']);
  assert.equal(filterReports(list, 'toate').length, 4);
  assert.equal(filterReports(list, 'in_lucru').length, 2);
  assert.equal(filterReports(list, 'rezolvat').length, 1);
});

test('newest first, or oldest first', () => {
  const list = [{ created_at: '2026-10-01T00:00:00Z' }, { created_at: '2026-10-18T00:00:00Z' }];
  assert.equal(sortByDate(list, 'desc')[0].created_at, '2026-10-18T00:00:00Z');
  assert.equal(sortByDate(list, 'asc')[0].created_at, '2026-10-01T00:00:00Z');
});

test('displayName uses the chosen name, else the first word of the email', () => {
  assert.equal(displayName({ display_name: 'Andreea Pop', email: 'a@exemplu.ro' }), 'Andreea Pop');
  assert.equal(displayName({ display_name: null, email: 'ana.pop@exemplu.ro' }), 'Ana');
  assert.equal(displayName({ display_name: null, email: 'MIHAI99@exemplu.ro' }), 'Mihai');
  assert.equal(displayName({ display_name: null, email: '123@exemplu.ro' }), '123');
});

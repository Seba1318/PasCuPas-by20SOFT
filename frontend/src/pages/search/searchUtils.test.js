import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitMatch, createRecent, groupResults, accessBadge } from './searchUtils.js';

test('highlights the matching part, ignoring diacritics and case', () => {
  assert.deepEqual(splitMatch('Piața Victoriei 2', 'pia'), { pre: '', hit: 'Pia', post: 'ța Victoriei 2' });
  assert.deepEqual(splitMatch('Piața Victoriei 2', 'piata'), { pre: '', hit: 'Piața', post: ' Victoriei 2' });
  assert.deepEqual(splitMatch('Bd. Vasile Pârvan', 'parvan'), { pre: 'Bd. Vasile ', hit: 'Pârvan', post: '' });
  assert.deepEqual(splitMatch('Cantina', 'xyz'), { pre: 'Cantina', hit: '', post: '' });
});

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) };
}

test('recent searches: newest first, no duplicates, at most 5', () => {
  const recent = createRecent(memoryStorage());
  for (let i = 1; i <= 6; i++) recent.add({ id: i, name: `Loc ${i}` });
  recent.add({ id: 3, name: 'Loc 3' });
  assert.deepEqual(recent.list().map((r) => r.id), [3, 6, 5, 4, 2]);
  recent.remove(6);
  assert.deepEqual(recent.list().map((r) => r.id), [3, 5, 4, 2]);
  recent.clear();
  assert.deepEqual(recent.list(), []);
});

test('recent searches survive a broken storage', () => {
  const recent = createRecent({ getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); } });
  assert.doesNotThrow(() => recent.add({ id: 1, name: 'A' }));
  assert.deepEqual(recent.list(), []);
});

test('results are grouped into places and addresses', () => {
  const g = groupResults([
    { id: 1, source: 'place', name: 'Rectoratul UPT' },
    { id: 'a1', source: 'address', name: 'Piața Victoriei' },
  ]);
  assert.deepEqual(g.places.map((r) => r.id), [1]);
  assert.deepEqual(g.addresses.map((r) => r.id), ['a1']);
});

test('access badge from the place sheet', () => {
  assert.deepEqual(accessBadge({ step_free_entrance: true }), { tone: 'success', text: 'Intrare fără trepte' });
  assert.deepEqual(accessBadge({ step_free_entrance: false }), { tone: 'warning', text: 'Intrare cu trepte' });
  assert.equal(accessBadge({}), null);
});

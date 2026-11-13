import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLastRouteStore } from './lastRoute.js';

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) };
}

test('the last planned route is kept for offline use, with its save time', () => {
  const store = createLastRouteStore(memoryStorage(), () => new Date('2026-10-18T10:00:00Z'));
  store.save({ to: { name: 'Rectoratul UPT' }, data: { steps: [] } });
  assert.deepEqual(store.load(), { to: { name: 'Rectoratul UPT' }, data: { steps: [] }, saved_at: '2026-10-18T10:00:00.000Z' });
});

test('routes older than 24 hours are not offered offline', () => {
  let now = new Date('2026-10-18T10:00:00Z');
  const store = createLastRouteStore(memoryStorage(), () => now);
  store.save({ to: { name: 'UVT' }, data: {} });
  now = new Date('2026-10-19T11:00:00Z');
  assert.equal(store.load(), null);
});

test('broken storage means no saved route, never a crash', () => {
  const store = createLastRouteStore({ getItem: () => '{rupt', setItem: () => { throw new Error('plin'); } });
  assert.doesNotThrow(() => store.save({ data: {} }));
  assert.equal(store.load(), null);
});

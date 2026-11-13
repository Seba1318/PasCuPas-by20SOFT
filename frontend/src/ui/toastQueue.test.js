import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addToast, removeToast, MAX_TOASTS } from './toastQueue.js';

test('adds toasts with incrementing ids, newest last', () => {
  let q = addToast([], { title: 'Mulțumim!' });
  q = addToast(q, { title: 'Salvat' });
  assert.deepEqual(q.map((t) => t.title), ['Mulțumim!', 'Salvat']);
  assert.notEqual(q[0].id, q[1].id);
  assert.equal(q[0].tone, 'success');
});

test('toasts never expire by themselves; only removeToast drops them', () => {
  const q = addToast([], { title: 'A' });
  assert.equal(q[0].expiresAt, undefined);
  assert.deepEqual(removeToast(q, q[0].id), []);
});

test('keeps at most MAX_TOASTS, dropping the oldest', () => {
  let q = [];
  for (let i = 0; i < MAX_TOASTS + 2; i++) q = addToast(q, { title: `T${i}` });
  assert.equal(q.length, MAX_TOASTS);
  assert.equal(q[0].title, 'T2');
});

test('identical consecutive toast is not duplicated', () => {
  let q = addToast([], { title: 'Salvat', message: 'Profilul e salvat.' });
  q = addToast(q, { title: 'Salvat', message: 'Profilul e salvat.' });
  assert.equal(q.length, 1);
});

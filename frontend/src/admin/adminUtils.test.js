import { test } from 'node:test';
import assert from 'node:assert/strict';
import { visibleNav, canAccess, scoreLevel, scoreParts, roleLabel, isAdmin } from './adminUtils.js';

const primarie = { role: 'admin', institution: { name: 'Primăria Timișoara', type: 'primarie' } };
const stpt = { role: 'admin', institution: { name: 'STPT', type: 'transport' } };
const sup = { role: 'superadmin', institution: null };

test('city hall admins do not see vehicles; transport admins do not see works', () => {
  const p = visibleNav(primarie).map((i) => i.id);
  assert.ok(p.includes('lucrari') && p.includes('proiecte'));
  assert.ok(!p.includes('vehicule') && !p.includes('utilizatori'));
  const t = visibleNav(stpt).map((i) => i.id);
  assert.ok(t.includes('vehicule'));
  assert.ok(!t.includes('lucrari') && !t.includes('proiecte'));
});

test('superadmin sees everything', () => {
  assert.equal(visibleNav(sup).length, 9);
});

test('direct URL access follows the same rules (X13)', () => {
  assert.equal(canAccess(primarie, 'vehicule'), false);
  assert.equal(canAccess(stpt, 'vehicule'), true);
  assert.equal(canAccess(stpt, 'utilizatori'), false);
  assert.equal(canAccess({ role: 'user' }, 'rapoarte'), false);
  assert.equal(isAdmin({ role: 'user' }), false);
  assert.equal(isAdmin(sup), true);
});

test('score level in words, never colour only', () => {
  assert.deepEqual(scoreLevel(86), { label: 'Ridicat', tone: 'success' });
  assert.deepEqual(scoreLevel(63), { label: 'Mediu', tone: 'warning' });
  assert.deepEqual(scoreLevel(30), { label: 'Scăzut', tone: 'neutral' });
});

test('score parts use the maxima from the plan: AI 60, date 20, location 20', () => {
  assert.deepEqual(scoreParts({ ai: 55, date: 20, location: 10 }), [
    { key: 'AI', value: 55, max: 60, text: 'AI 55 din 60' },
    { key: 'Dată', value: 20, max: 20, text: 'Dată 20 din 20' },
    { key: 'Locație', value: 10, max: 20, text: 'Locație 10 din 20' },
  ]);
});

test('role label for the header', () => {
  assert.equal(roleLabel(primarie), 'Administrator · Primăria Timișoara');
  assert.equal(roleLabel(sup), 'Superadministrator');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trustLabel, TRUST_OPTIONS, validateTrustChange, validateInstitution } from './usersUtils.js';

test('trust levels in words', () => {
  assert.equal(trustLabel(100), 'Ridicat');
  assert.equal(trustLabel(50), 'Mediu');
  assert.equal(trustLabel(0), 'Scăzut · suspendat');
  assert.deepEqual(TRUST_OPTIONS.map(([v]) => v), ['100', '50', '0']);
});

test('changing trust needs a different level and a reason', () => {
  assert.deepEqual(validateTrustChange({ current: 100, next: 100, reason: '' }), {
    next: 'Alege un nivel diferit de cel actual.',
    reason: 'Scrie motivul. Rămâne în istoricul utilizatorului.',
  });
  assert.deepEqual(validateTrustChange({ current: 100, next: 50, reason: 'Raport fals confirmat' }), {});
});

test('new institution: name required, every account email valid', () => {
  assert.deepEqual(validateInstitution({ name: '', accounts: [{ email: 'ok@uvt.exemplu.ro' }, { email: 'gresit' }] }), {
    name: 'Scrie numele instituției.',
    'account-1': 'Adresa de email nu pare completă. Exemplu: nume@exemplu.ro',
  });
  assert.deepEqual(validateInstitution({ name: 'UVT', accounts: [] }), { accounts: 'Adaugă cel puțin un cont.' });
});

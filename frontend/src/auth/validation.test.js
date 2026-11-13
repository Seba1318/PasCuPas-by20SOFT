import { test } from 'node:test';
import assert from 'node:assert/strict';
import { passwordChecks, validateLogin, validateRegister, validateNewPassword, validateEmail, safeNext } from './validation.js';

test('password rules: at least 8 characters and one digit', () => {
  assert.deepEqual(passwordChecks('plimbare2026'), { length: true, digit: true });
  assert.deepEqual(passwordChecks('scurt1'), { length: false, digit: true });
  assert.deepEqual(passwordChecks('faracifre'), { length: true, digit: false });
});

test('email must look like an address', () => {
  assert.equal(validateEmail(''), 'Scrie adresa de email.');
  assert.equal(validateEmail('andreea'), 'Adresa de email nu pare completă. Exemplu: nume@exemplu.ro');
  assert.equal(validateEmail(' andreea@exemplu.ro '), null);
});

test('login needs email and password', () => {
  assert.deepEqual(validateLogin({ email: '', password: '' }), {
    email: 'Scrie adresa de email.',
    password: 'Scrie parola.',
  });
  assert.deepEqual(validateLogin({ email: 'a@exemplu.ro', password: 'x' }), {});
});

test('register: mismatched passwords error on the confirmation field', () => {
  const errors = validateRegister({ email: 'a@exemplu.ro', password: 'plimbare2026', confirm: 'plimbare206' });
  assert.deepEqual(errors, { confirm: 'Parolele nu sunt la fel. Mai scrie-o o dată.' });
});

test('register: weak password explains the missing rules', () => {
  assert.equal(
    validateRegister({ email: 'a@exemplu.ro', password: 'abc', confirm: 'abc' }).password,
    'Parola are nevoie de cel puțin 8 caractere și cel puțin o cifră.',
  );
  assert.equal(
    validateRegister({ email: 'a@exemplu.ro', password: 'abcdefgh', confirm: 'abcdefgh' }).password,
    'Parola are nevoie de cel puțin o cifră.',
  );
});

test('new password uses the same rules', () => {
  assert.deepEqual(validateNewPassword({ password: 'rampa2026', confirm: 'rampa2026' }), {});
});

test('next redirect only allows internal paths', () => {
  assert.equal(safeNext('/raporteaza'), '/raporteaza');
  assert.equal(safeNext('https://rau.example'), '/');
  assert.equal(safeNext('//rau.example'), '/');
  assert.equal(safeNext(null), '/');
});

// Browserele citesc „\” ca „/”, deci „/\site” ajunge la fel ca „//site”: pe alt site.
test('next redirect rejects backslashes', () => {
  assert.equal(safeNext('/\\rau.example'), '/');
  assert.equal(safeNext('/\\/rau.example'), '/');
  assert.equal(safeNext('/raporteaza\\..\\rau'), '/');
});

// Browserele scot tab și rând nou din adrese, deci „/<tab>/site” devine „//site”.
test('next redirect rejects control characters', () => {
  assert.equal(safeNext('/\t/rau.example'), '/');
  assert.equal(safeNext('/\n/rau.example'), '/');
  assert.equal(safeNext('/\r/rau.example'), '/');
});

test('next redirect keeps the query and hash of an internal path', () => {
  assert.equal(safeNext('/traseu?from=me#harta'), '/traseu?from=me#harta');
});

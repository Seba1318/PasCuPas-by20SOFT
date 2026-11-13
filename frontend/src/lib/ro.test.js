import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixRo, fold, matchesQuery } from './ro.js';

test('fixRo replaces cedilla letters with comma-below letters', () => {
  assert.equal(fixRo('Piaţa Ştefan şi Ţara'), 'Piața Ștefan și Țara');
});

test('fold removes diacritics and case', () => {
  assert.equal(fold('Piața Ăăâîșț'), 'piata aaaist');
});

test('search matches with or without diacritics, including cedilla input', () => {
  assert.equal(matchesQuery('Piața Victoriei', 'piata'), true);
  assert.equal(matchesQuery('Piața Victoriei', 'Piaţa'), true);
  assert.equal(matchesQuery('Piața Victoriei', 'PIAȚA vic'), true);
  assert.equal(matchesQuery('Piața Victoriei', 'Bega'), false);
});

test('empty query matches nothing', () => {
  assert.equal(matchesQuery('Piața Victoriei', '   '), false);
});

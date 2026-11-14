import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixRo, fold, matchesQuery, metersSpoken } from './ro.js';

test('spoken distance: "de" only after numbers that do not end in 01–19', () => {
  assert.equal(metersSpoken(1), 'un metru');
  assert.equal(metersSpoken(12), '12 metri');
  assert.equal(metersSpoken(19), '19 metri');
  assert.equal(metersSpoken(20), '20 de metri');
  assert.equal(metersSpoken(100), '100 de metri');
  assert.equal(metersSpoken(105), '105 metri');
  assert.equal(metersSpoken(120), '120 de metri');
});

test('spoken distance is rounded to whole metres, never below one', () => {
  assert.equal(metersSpoken(12.4), '12 metri');
  assert.equal(metersSpoken(0.3), 'un metru');
  assert.equal(metersSpoken(0), 'un metru');
});

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

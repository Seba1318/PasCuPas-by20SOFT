import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shortcutFor, SHORTCUTS } from './shortcuts.js';

const ev = (key, target = { tagName: 'BODY' }, mods = {}) => ({ key, target, ...mods });

test('single-key shortcuts on the page', () => {
  assert.equal(shortcutFor(ev('/')), 'search');
  assert.equal(shortcutFor(ev('[')), 'panel');
  assert.equal(shortcutFor(ev('l')), 'legend');
  assert.equal(shortcutFor(ev('L')), 'legend');
  assert.equal(shortcutFor(ev('+')), 'zoom-in');
  assert.equal(shortcutFor(ev('=')), 'zoom-in');
  assert.equal(shortcutFor(ev('-')), 'zoom-out');
  assert.equal(shortcutFor(ev('?')), 'help');
});

test('typing "Lift" in a field does not open the legend or collapse the panel', () => {
  for (const tagName of ['INPUT', 'TEXTAREA', 'SELECT']) {
    assert.equal(shortcutFor(ev('L', { tagName })), null);
    assert.equal(shortcutFor(ev('[', { tagName })), null);
    assert.equal(shortcutFor(ev('/', { tagName })), null);
  }
  assert.equal(shortcutFor(ev('l', { tagName: 'DIV', isContentEditable: true })), null);
});

test('modifier keys are left to the browser', () => {
  assert.equal(shortcutFor(ev('l', undefined, { ctrlKey: true })), null);
  assert.equal(shortcutFor(ev('[', undefined, { metaKey: true })), null);
});

test('the list shown in the help dialog (W4)', () => {
  assert.deepEqual(SHORTCUTS.map((s) => s.keys.join(' ')), ['/', 'Esc', '[', 'L', '+ −', '← →', 'Tab', 'Enter', '?']);
});

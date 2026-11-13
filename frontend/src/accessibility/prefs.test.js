import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PREFS, resolveAppearance, loadPrefs, savePrefs } from './prefs.js';

test('system theme follows prefers-color-scheme', () => {
  assert.deepEqual(resolveAppearance({ ...DEFAULT_PREFS, theme: 'system' }, { prefersDark: true }), { theme: 'dark', contrast: 'normal' });
  assert.deepEqual(resolveAppearance({ ...DEFAULT_PREFS, theme: 'system' }, { prefersDark: false }), { theme: 'light', contrast: 'normal' });
});

test('explicit theme wins over the system', () => {
  assert.equal(resolveAppearance({ ...DEFAULT_PREFS, theme: 'light' }, { prefersDark: true }).theme, 'light');
});

test('high contrast from profile or from prefers-contrast: more', () => {
  assert.equal(resolveAppearance({ ...DEFAULT_PREFS, highContrast: true }, {}).contrast, 'high');
  assert.equal(resolveAppearance(DEFAULT_PREFS, { prefersMoreContrast: true }).contrast, 'high');
  assert.equal(resolveAppearance(DEFAULT_PREFS, {}).contrast, 'normal');
});

test('prefs round-trip through storage and ignore unknown keys', () => {
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  savePrefs({ ...DEFAULT_PREFS, voice: true, junk: 1 }, storage);
  const loaded = loadPrefs(storage);
  assert.equal(loaded.voice, true);
  assert.equal('junk' in loaded, false);
});

test('broken or throwing storage falls back to defaults', () => {
  assert.deepEqual(loadPrefs({ getItem: () => '{nu e json' }), DEFAULT_PREFS);
  assert.deepEqual(loadPrefs({ getItem: () => { throw new Error('blocat'); } }), DEFAULT_PREFS);
  assert.doesNotThrow(() => savePrefs(DEFAULT_PREFS, { setItem: () => { throw new Error('plin'); } }));
});

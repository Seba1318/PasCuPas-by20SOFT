import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NEED_TYPES, buildProfile, EMPTY_PROFILE, needsFromProfile, profileSummary } from './presets.js';

test('six need types in the order of design B1', () => {
  assert.deepEqual(NEED_TYPES.map((n) => n.id), ['mobility', 'vision', 'hearing', 'cognitive', 'elderly', 'stroller']);
  assert.equal(NEED_TYPES[0].label, 'Scaun cu rotile, cadru sau cârje');
});

test('wheelchair defaults: no stairs, kerb 3 cm, incline 6 %, avoid rough surface', () => {
  const { profile } = buildProfile(['mobility']);
  assert.equal(profile.avoid_stairs, true);
  assert.equal(profile.max_kerb_cm, 3);
  assert.equal(profile.max_incline_pct, 6);
  assert.equal(profile.avoid_rough_surface, true);
});

test('stroller or temporary injury: kerb 6 cm, incline 8 %', () => {
  const { profile } = buildProfile(['stroller']);
  assert.equal(profile.avoid_stairs, true);
  assert.equal(profile.max_kerb_cm, 6);
  assert.equal(profile.max_incline_pct, 8);
});

test('combining needs keeps the stricter limit and adds rest stops', () => {
  const { profile } = buildProfile(['mobility', 'elderly']);
  assert.equal(profile.max_incline_pct, 6);
  assert.equal(profile.needs_rest_every_m, 300);
});

test('low vision: tactile and audio preferences, high contrast and voice on', () => {
  const { profile, uiPrefs } = buildProfile(['vision']);
  assert.equal(profile.prefer_tactile, true);
  assert.equal(profile.prefer_audio_signals, true);
  assert.equal(uiPrefs.highContrast, true);
  assert.equal(uiPrefs.voice, true);
});

test('hearing: vibrations, no routing rules', () => {
  const { profile, uiPrefs } = buildProfile(['hearing']);
  assert.deepEqual(profile, EMPTY_PROFILE);
  assert.equal(uiPrefs.vibration, true);
});

test('cognitive: simplified mode in the route and in the interface', () => {
  const { profile, uiPrefs } = buildProfile(['cognitive']);
  assert.equal(profile.simplified_mode, true);
  assert.equal(uiPrefs.simplified, true);
});

test('nothing selected: no mandatory rules', () => {
  const { profile } = buildProfile([]);
  assert.equal(profile.avoid_stairs, false);
  assert.equal(profile.max_kerb_cm, null);
  assert.equal(profile.max_incline_pct, null);
});

test('needs are recognised back from a saved profile', () => {
  assert.deepEqual(needsFromProfile(buildProfile(['mobility']).profile), ['mobility']);
  assert.deepEqual(needsFromProfile(EMPTY_PROFILE), []);
});

test('summary lines for the profile card', () => {
  assert.deepEqual(profileSummary(buildProfile(['mobility', 'elderly']).profile), [
    'Fără trepte',
    'Bordură max. 3 cm',
    'Pantă max. 6 %',
    'Pauze la 300 m',
  ]);
});

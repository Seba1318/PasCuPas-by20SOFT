import { test } from 'node:test';
import assert from 'node:assert/strict';
import { placeFeatures, arrivalSuitability, etaText, stopFeatures } from './sheetUtils.js';

test('place sheet rows: yes / no / unknown are written out, not just coloured', () => {
  const rows = placeFeatures({ step_free_entrance: true, lift: false, accessible_toilet: null, door_width_cm: 90 }, { avoid_stairs: true });
  assert.deepEqual(rows.map((r) => [r.label, r.value, r.state]), [
    ['Intrare fără trepte', 'Da', 'yes'],
    ['Lift', 'Nu', 'no'],
    ['Toaletă accesibilă', 'Nu știm', 'unknown'],
    ['Lățimea ușii', '90 cm', 'yes'],
  ]);
  assert.equal(rows[3].note, 'Potrivită pentru scaunul tău');
});

test('narrow door is flagged for wheelchair users', () => {
  const [door] = placeFeatures({ door_width_cm: 70 }, { avoid_stairs: true }).filter((r) => r.label === 'Lățimea ușii');
  assert.equal(door.state, 'no');
  assert.equal(door.note, 'Poate fi îngustă pentru un scaun cu rotile (recomandat: minim 80 cm)');
});

test('vehicle without a working ramp is unsuitable for a no-stairs profile', () => {
  const v = { has_ramp: true, ramp_ok: false, low_floor: true, has_audio_announce: true, audio_ok: true, has_visual_display: true };
  assert.deepEqual(arrivalSuitability(v, { avoid_stairs: true }), { ok: false, reason: 'Fără rampă funcțională' });
  assert.deepEqual(arrivalSuitability(v, { avoid_stairs: false }), { ok: true, reason: '' });
});

test('vehicle without working audio is unsuitable for audio-signal preference', () => {
  const v = { has_ramp: true, ramp_ok: true, has_audio_announce: true, audio_ok: false };
  assert.deepEqual(arrivalSuitability(v, { prefer_audio_signals: true }), { ok: false, reason: 'Fără anunțuri sonore' });
});

test('eta in minutes from now', () => {
  const now = new Date('2026-10-18T12:00:00Z');
  assert.equal(etaText('2026-10-18T12:04:10Z', now), 'în 4 min');
  assert.equal(etaText('2026-10-18T12:00:20Z', now), 'acum');
  assert.equal(etaText('2026-10-18T13:15:00Z', now), 'la 16:15');
});

test('stop features as text', () => {
  assert.deepEqual(
    stopFeatures({ wheelchair_boarding: true, has_tactile: true, has_display: false }).map((f) => [f.label, f.ok]),
    [['Acces cu scaun cu rotile', true], ['Ghidaj tactil', true], ['Fără panou de afișaj', false]],
  );
});

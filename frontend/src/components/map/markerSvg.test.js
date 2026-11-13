import { test } from 'node:test';
import assert from 'node:assert/strict';
import { markerSvg, markerTypeFor, MARKER_TYPES } from './markerSvg.js';

test('each shape matches its category (design/Marker)', () => {
  assert.match(markerSvg({ type: 'ramp' }), /<circle cx="24" cy="24" r="18" fill="#FFFFFF"/);
  assert.match(markerSvg({ type: 'station' }), /<rect x="6" y="6" width="36" height="36" rx="7" fill="#E6F0FF"/);
  assert.match(markerSvg({ type: 'place' }), /rotate\(45 24 24\)" fill="#EEEBFF"/);
  assert.match(markerSvg({ type: 'problem' }), /<path d="M24 5 L44 41 H4 Z" fill="#FDE68A"/);
  assert.match(markerSvg({ type: 'stairs' }), /fill="#1E293B" stroke="#FFFFFF"/);
});

test('text markers for toilets and parking', () => {
  assert.match(markerSvg({ type: 'wc' }), />WC<\/text>/);
  assert.match(markerSvg({ type: 'parking' }), />P<\/text>/);
});

test('selected marker gets a 3 px blue ring', () => {
  assert.doesNotMatch(markerSvg({ type: 'ramp' }), /r="23"/);
  assert.match(markerSvg({ type: 'ramp', selected: true }), /<circle cx="24" cy="24" r="23" fill="none" stroke="#2563EB" stroke-width="3"/);
});

test('high contrast: black fill, white ink, white problem triangle', () => {
  assert.match(markerSvg({ type: 'ramp', highContrast: true }), /r="18" fill="#000000" stroke="#FFFFFF"/);
  assert.match(markerSvg({ type: 'problem', highContrast: true }), /fill="#FFFFFF" stroke="#000000"/);
});

test('svg is decorative: the accessible name lives on the marker element', () => {
  assert.match(markerSvg({ type: 'lift' }), /^<svg[^>]*aria-hidden="true"/);
});

test('API categories map to marker types', () => {
  assert.equal(markerTypeFor('ramp'), 'ramp');
  assert.equal(markerTypeFor('toilet'), 'wc');
  assert.equal(markerTypeFor('audio_signal'), 'sound');
  assert.equal(markerTypeFor('building'), 'place');
  assert.equal(markerTypeFor('ceva-nou'), 'place');
  assert.ok(MARKER_TYPES.includes('dest'));
});

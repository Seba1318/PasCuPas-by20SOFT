import { test } from 'node:test';
import assert from 'node:assert/strict';
import { breakpointFor, panelWidth, NAV_ITEMS, activeNav } from './breakpoints.js';

test('phone under 768, tablet 768–1279, desktop from 1280', () => {
  assert.equal(breakpointFor(390), 'phone');
  assert.equal(breakpointFor(767), 'phone');
  assert.equal(breakpointFor(768), 'tablet');
  assert.equal(breakpointFor(1279), 'tablet');
  assert.equal(breakpointFor(1280), 'desktop');
  assert.equal(breakpointFor(1440), 'desktop');
});

test('side panel is 420 on desktop, 360 on tablet, 72 when collapsed', () => {
  assert.equal(panelWidth('desktop', false), 420);
  assert.equal(panelWidth('tablet', false), 360);
  assert.equal(panelWidth('desktop', true), 72);
  assert.equal(panelWidth('phone', false), 0);
});

test('four main sections in the order of the tab bar', () => {
  assert.deepEqual(NAV_ITEMS.map((n) => n.label), ['Hartă', 'Traseu', 'Raportează', 'Profil']);
});

test('active section from the current path', () => {
  assert.equal(activeNav('/'), 'harta');
  assert.equal(activeNav('/loc/3'), 'harta');
  assert.equal(activeNav('/traseu'), 'traseu');
  assert.equal(activeNav('/raporteaza'), 'raporteaza');
  assert.equal(activeNav('/rapoartele-mele'), 'profil');
  assert.equal(activeNav('/profil/nevoi'), 'profil');
});

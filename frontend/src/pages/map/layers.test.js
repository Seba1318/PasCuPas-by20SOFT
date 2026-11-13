import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LAYERS, DEFAULT_LAYERS, visiblePlaces, toggleLayer } from './layers.js';

const place = (category, id = category) => ({ id, properties: { category } });

test('chip labels and default state follow design C1', () => {
  assert.deepEqual(LAYERS.slice(0, 7).map((l) => l.label), ['Rampe', 'Toalete', 'Lifturi', 'Bănci', 'Stații', 'Probleme', 'Lucrări']);
  assert.deepEqual([...DEFAULT_LAYERS].sort(), ['lucrari', 'probleme', 'rampe', 'statii', 'toalete']);
});

test('places with an accessibility sheet are always visible; amenities follow their layer', () => {
  const all = [place('building'), place('ramp'), place('toilet'), place('lift'), place('bench')];
  const shown = visiblePlaces(all, new Set(['rampe'])).map((p) => p.properties.category);
  assert.deepEqual(shown, ['building', 'ramp']);
});

test('toggleLayer returns a new set', () => {
  const a = new Set(['rampe']);
  const b = toggleLayer(a, 'lifturi');
  assert.notEqual(a, b);
  assert.deepEqual([...b].sort(), ['lifturi', 'rampe']);
  assert.deepEqual([...toggleLayer(b, 'rampe')], ['lifturi']);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDraftStore, validateDetails, buildReportForm, reportSteps } from './reportDraft.js';

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) };
}

test('the draft survives a reload or a 401, without the photo', () => {
  const store = createDraftStore(memoryStorage());
  store.save({ category: 'rampa_blocata', point: [21.23, 45.74], location_text: 'Colț cu Bd. Vasile Pârvan', description: 'Mașină', photo: { name: 'x' } });
  assert.deepEqual(store.load(), {
    category: 'rampa_blocata',
    point: [21.23, 45.74],
    location_text: 'Colț cu Bd. Vasile Pârvan',
    description: 'Mașină',
    vehicle: null,
    equipment: null,
    stop: null,
  });
  store.clear();
  assert.equal(store.load(), null);
});

test('details need a photo and a place; description is at most 500 characters', () => {
  assert.deepEqual(validateDetails({ category: 'rampa_blocata', photo: null, point: null, location_text: '', description: '' }), {
    photo: 'Adaugă o poză cu problema.',
    location: 'Alege locul pe hartă sau folosește locația ta.',
    location_text: 'Scrie pe scurt unde e (de exemplu „colț cu Bd. Vasile Pârvan”).',
  });
  const long = validateDetails({ category: 'altceva', photo: {}, point: [1, 2], location_text: 'aici', description: 'a'.repeat(501) });
  assert.deepEqual(long, { description: 'Descrierea are 501 caractere; maximul e 500.' });
});

test('vehicle reports need no place on the map (E3)', () => {
  assert.deepEqual(validateDetails({ category: 'dotare_vehicul', photo: {}, vehicle: 'V-1', equipment: 'ramp', point: null, location_text: '' }), {});
});

test('steps: 3 for street problems, 4 for vehicles', () => {
  assert.deepEqual(reportSteps('rampa_blocata'), ['Categorie', 'Detalii', 'Trimite']);
  assert.deepEqual(reportSteps('dotare_vehicul'), ['Categorie', 'Vehicul', 'Detalii', 'Trimite']);
});

test('form data carries the fields the API expects', () => {
  const entries = [];
  const fd = { append: (k, v) => entries.push([k, v]) };
  buildReportForm(fd, {
    category: 'rampa_blocata',
    point: [21.23, 45.74],
    location_text: 'Colț',
    description: '',
    photo: 'FILE',
    reporter: { point: [21.2301, 45.7401], accuracy: 12 },
  });
  assert.deepEqual(entries, [
    ['category', 'rampa_blocata'],
    ['photo', 'FILE'],
    ['lon', '21.23'],
    ['lat', '45.74'],
    ['location_text', 'Colț'],
    ['reporter_lon', '21.2301'],
    ['reporter_lat', '45.7401'],
    ['reporter_accuracy_m', '12'],
  ]);
});

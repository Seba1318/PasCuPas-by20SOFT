import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toLatLng, toLonLat, lineToLatLngs, bboxFromBounds, bboxToLatLngBounds, distanceM, distanceToLineM } from './geo.js';

test('GeoJSON [lon, lat] becomes Leaflet [lat, lon] (Timișoara, not the Indian Ocean)', () => {
  assert.deepEqual(toLatLng([21.2306, 45.7472]), [45.7472, 21.2306]);
  assert.deepEqual(toLonLat([45.7472, 21.2306]), [21.2306, 45.7472]);
  assert.deepEqual(toLonLat({ lat: 45.7472, lng: 21.2306 }), [21.2306, 45.7472]);
});

test('a whole line is converted point by point', () => {
  assert.deepEqual(lineToLatLngs([[21.1, 45.1], [21.2, 45.2]]), [[45.1, 21.1], [45.2, 21.2]]);
});

test('bbox string is minLon,minLat,maxLon,maxLat', () => {
  const bounds = {
    getSouthWest: () => ({ lat: 45.74, lng: 21.22 }),
    getNorthEast: () => ({ lat: 45.76, lng: 21.25 }),
  };
  assert.equal(bboxFromBounds(bounds), '21.22,45.74,21.25,45.76');
  assert.deepEqual(bboxToLatLngBounds([21.22, 45.74, 21.25, 45.76]), [[45.74, 21.22], [45.76, 21.25]]);
});

test('haversine distance: 0.001° of latitude is about 111 m', () => {
  const d = distanceM([21.23, 45.747], [21.23, 45.748]);
  assert.ok(Math.abs(d - 111.2) < 1, `got ${d}`);
});

test('distance from a point to a line uses the perpendicular foot', () => {
  const line = [[21.23, 45.747], [21.24, 45.747]];
  const lat30m = 45.747 + 30 / 111195; // 30 m spre nord
  const d = distanceToLineM([21.235, lat30m], line);
  assert.ok(Math.abs(d - 30) < 1, `got ${d}`);
});

test('distance to a line beyond its end is the distance to the endpoint', () => {
  const line = [[21.23, 45.747], [21.24, 45.747]];
  const d = distanceToLineM([21.23, 45.748], line);
  assert.ok(Math.abs(d - 111.2) < 1, `got ${d}`);
});

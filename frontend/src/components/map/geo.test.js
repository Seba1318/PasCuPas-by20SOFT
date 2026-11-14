import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toLatLng, toLonLat, lineToLatLngs, bboxFromBounds, bboxToLatLngBounds, distanceM, distanceToLineM, nearestFeature, bboxAround } from './geo.js';

const pointFeature = (id, coordinates) => ({ type: 'Feature', id, geometry: { type: 'Point', coordinates } });

test('nearest feature: the closest one within the limit', () => {
  const here = [21.23, 45.747];
  const at111m = pointFeature(1, [21.23, 45.748]);
  const at56m = pointFeature(2, [21.23, 45.7475]);
  const at667m = pointFeature(3, [21.23, 45.753]);
  assert.equal(nearestFeature(here, [at111m, at667m, at56m], 500)?.id, 2);
});

test('nearest feature: none when everything is beyond the limit or the list is empty', () => {
  const here = [21.23, 45.747];
  assert.equal(nearestFeature(here, [pointFeature(3, [21.23, 45.753])], 500), null);
  assert.equal(nearestFeature(here, [], 500), null);
});

test('bbox around a point reaches the radius in every direction', () => {
  // Calculat de mână: 500 m = 0,004497° latitudine; la 45,747° N, 500 m = 0,006444° longitudine.
  const [minLon, minLat, maxLon, maxLat] = bboxAround([21.23, 45.747], 500);
  assert.ok(Math.abs(maxLat - 45.747 - 0.004497) < 0.00002, `maxLat ${maxLat}`);
  assert.ok(Math.abs(45.747 - minLat - 0.004497) < 0.00002, `minLat ${minLat}`);
  assert.ok(Math.abs(maxLon - 21.23 - 0.006444) < 0.00003, `maxLon ${maxLon}`);
  assert.ok(Math.abs(21.23 - minLon - 0.006444) < 0.00003, `minLon ${minLon}`);
});

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

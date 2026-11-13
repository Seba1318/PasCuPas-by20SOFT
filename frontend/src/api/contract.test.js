// Contractul dintre frontend și API (planul 20SOFT · Endpoint-uri FastAPI).
// Implicit verifică mock-ul. Pe backendul real:
//   CONTRACT_API_URL=http://localhost:8000 CONTRACT_TOKEN=<jwt> CONTRACT_REPORT_CODE=TM-2026-000002 npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkShape } from './shape.js';
import { mockRequest } from './mock/index.js';

const BASE = process.env.CONTRACT_API_URL;
const TOKEN = process.env.CONTRACT_TOKEN ?? 'mock:andreea@exemplu.ro';
const ADMIN_TOKEN = process.env.CONTRACT_ADMIN_TOKEN ?? 'mock:super@exemplu.ro';
const BBOX = '21.215,45.738,21.248,45.756';
// Un raport care există: în mock e TM-2026-000123; pe baza din seed_fake, de ex. TM-2026-000002.
const REPORT_CODE = process.env.CONTRACT_REPORT_CODE ?? 'TM-2026-000123';

async function call(method, path, body, token = TOKEN) {
  if (!BASE) return mockRequest(method, path, body, { token });
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  assert.ok(res.ok, `${method} ${path} → ${res.status}`);
  return res.json();
}

const point = { type: 'string', coordinates: ['number'] };
const feature = (properties) => ({ type: 'string', id: 'number', geometry: point, properties });
const collection = (properties) => ({ type: 'string', features: [feature(properties)] });
const CODE = /^TM-\d{4}-\d{6}$/;
const STATUS = /^(in_lucru|rezolvat|respins)$/;

const CONTRACTS = [
  ['GET', '/users/me', { id: 'number', email: 'string', display_name: '?string', avatar_url: '?string', role: /^(user|admin|superadmin)$/, is_verified: 'boolean', trust_level: 'number' }],
  ['GET', '/users/me/profile', { avoid_stairs: 'boolean', max_kerb_cm: '?number', max_incline_pct: '?number', needs_rest_every_m: '?number', simplified_mode: 'boolean' }],
  ['GET', `/places?bbox=${BBOX}`, collection({ name: 'string', category: 'string', attributes: 'object' })],
  ['GET', '/places/1', feature({ name: 'string', category: 'string', attributes: 'object' })],
  // id: număr pentru locurile proprii, text pentru adresele din Nominatim
  ['GET', '/search?q=pia', [{ id: 'any', name: 'string', geometry: point, source: /^(place|address)$/ }]],
  ['GET', `/works?bbox=${BBOX}`, { type: 'string', features: [{ type: 'string', geometry: 'object', properties: { title: 'string', start_date: 'string', end_date: 'string', blocks_route: 'boolean' } }] }],
  ['GET', `/reports?bbox=${BBOX}&status=in_lucru`, collection({ public_code: CODE, category: 'string', status: STATUS, created_at: 'string' })],
  ['GET', `/reports/${REPORT_CODE}`, feature({ public_code: CODE, status: STATUS, created_at: 'string', location_text: 'string' })],
  ['GET', '/reports/mine', [{ public_code: CODE, status: STATUS, category: 'string', created_at: 'string' }]],
  ['GET', `/transit/stops?bbox=${BBOX}`, collection({ name: 'string', wheelchair_boarding: 'boolean' })],
  ['GET', '/transit/stops/1/arrivals', [{ route: 'string', headsign: 'string', arrival_time: 'string', vehicle: { has_ramp: 'boolean', ramp_ok: 'boolean' } }]],
  [
    'POST',
    '/routes/plan',
    {
      route: { type: 'string', coordinates: [['number']] },
      length_m: 'number',
      duration_min: 'number',
      steps: [{ instruction: 'string', distance_m: 'number', coord: ['number'] }],
      warnings: [{ text: 'string' }],
    },
    { start: [21.2389, 45.7469], end: [21.2265, 45.747], mode: 'walk' },
  ],
];

for (const [method, path, schema, body] of CONTRACTS) {
  test(`${method} ${path.split('?')[0]} respects the contract`, async () => {
    const res = await call(method, path, body);
    assert.deepEqual(checkShape(res, schema), []);
  });
}

test('GET /admin/reports returns a page with the verification score', async () => {
  const res = await call('GET', '/admin/reports?limit=50&offset=0', undefined, ADMIN_TOKEN);
  assert.deepEqual(
    checkShape(res, { items: [{ id: 'number', public_code: CODE, status: STATUS, score: { ai: 'number', date: 'number', location: 'number', total: 'number' } }], total: 'number' }),
    [],
  );
});

test('the shape checker itself reports problems', () => {
  assert.deepEqual(checkShape({ a: 1 }, { a: 'string', b: '?number' }), ['a: trebuia string, e number']);
  assert.deepEqual(checkShape({ code: 'X' }, { code: CODE }), [`code: „X” nu se potrivește cu ${CODE}`]);
});

test('PATCH /users/me changes the display name (mock)', async () => {
  const ctx = { token: 'mock:andreea@exemplu.ro' }; // mereu mock-ul, și când CONTRACT_TOKEN e un JWT real
  const user = await mockRequest('PATCH', '/users/me', { display_name: '  Ana   Pop ' }, ctx);
  assert.equal(user.display_name, 'Ana Pop');
  await assert.rejects(mockRequest('PATCH', '/users/me', { display_name: 'A' }, ctx), { status: 422 });
  const reset = await mockRequest('PATCH', '/users/me', { display_name: 'Andreea' }, ctx);
  assert.equal(reset.display_name, 'Andreea');
});

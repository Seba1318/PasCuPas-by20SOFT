import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient, ApiError } from './client.js';

function fakeFetch(status, body) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init });
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: { get: () => 'application/json' },
      json: async () => body,
    };
  };
  fn.calls = calls;
  return fn;
}

test('adds bearer token and base url', async () => {
  const fetchImpl = fakeFetch(200, { ok: true });
  const api = createClient({ baseUrl: 'http://api', fetchImpl, getToken: () => 'abc' });
  await api.get('/users/me');
  assert.equal(fetchImpl.calls[0].url, 'http://api/users/me');
  assert.equal(fetchImpl.calls[0].init.headers.Authorization, 'Bearer abc');
});

test('serializes query params and skips empty ones', async () => {
  const fetchImpl = fakeFetch(200, []);
  const api = createClient({ baseUrl: 'http://api', fetchImpl, getToken: () => null });
  await api.get('/places', { bbox: '21.2,45.7,21.3,45.8', category: undefined, limit: 50 });
  assert.equal(fetchImpl.calls[0].url, 'http://api/places?bbox=21.2%2C45.7%2C21.3%2C45.8&limit=50');
  assert.equal(fetchImpl.calls[0].init.headers.Authorization, undefined);
});

test('sends json body on post', async () => {
  const fetchImpl = fakeFetch(200, { access_token: 't' });
  const api = createClient({ baseUrl: 'http://api', fetchImpl, getToken: () => null });
  const res = await api.post('/auth/login', { email: 'a@exemplu.ro', password: 'x' });
  assert.deepEqual(res, { access_token: 't' });
  assert.equal(fetchImpl.calls[0].init.method, 'POST');
  assert.equal(fetchImpl.calls[0].init.headers['Content-Type'], 'application/json');
  assert.equal(fetchImpl.calls[0].init.body, JSON.stringify({ email: 'a@exemplu.ro', password: 'x' }));
});

test('throws ApiError with romanian detail', async () => {
  const fetchImpl = fakeFetch(409, { detail: 'Există deja un cont cu acest email.' });
  const api = createClient({ baseUrl: 'http://api', fetchImpl, getToken: () => null });
  await assert.rejects(api.post('/auth/register', {}), (err) => {
    assert.ok(err instanceof ApiError);
    assert.equal(err.status, 409);
    assert.equal(err.detail, 'Există deja un cont cu acest email.');
    return true;
  });
});

test('422 validation detail list becomes readable text', async () => {
  const fetchImpl = fakeFetch(422, { detail: [{ msg: 'Câmp obligatoriu' }] });
  const api = createClient({ baseUrl: 'http://api', fetchImpl, getToken: () => null });
  await assert.rejects(api.post('/x', {}), (err) => err.status === 422 && err.detail === 'Câmp obligatoriu');
});

test('401 calls onUnauthorized', async () => {
  let called = 0;
  const fetchImpl = fakeFetch(401, { detail: 'Neautentificat' });
  const api = createClient({
    baseUrl: 'http://api',
    fetchImpl,
    getToken: () => 'old',
    onUnauthorized: () => called++,
  });
  await assert.rejects(api.get('/users/me'), (err) => err.status === 401);
  assert.equal(called, 1);
});

test('network failure becomes ApiError with status 0', async () => {
  const fetchImpl = async () => {
    throw new TypeError('Failed to fetch');
  };
  const api = createClient({ baseUrl: 'http://api', fetchImpl, getToken: () => null });
  await assert.rejects(api.get('/places'), (err) => {
    assert.equal(err.status, 0);
    assert.equal(err.detail, 'Nu există conexiune la internet. Încearcă din nou.');
    return true;
  });
});

test('mock mode answers without fetch', async () => {
  let fetched = false;
  const api = createClient({
    baseUrl: 'http://api',
    useMocks: true,
    mockDelayMs: 0,
    fetchImpl: async () => {
      fetched = true;
    },
    getToken: () => null,
  });
  const places = await api.get('/places', { bbox: '21.2,45.7,21.3,45.8' });
  assert.equal(fetched, false);
  assert.ok(places.features.length > 0);
});

test('mock errors keep the same ApiError shape', async () => {
  const api = createClient({ useMocks: true, mockDelayMs: 0, getToken: () => null });
  await assert.rejects(
    api.post('/auth/login', { email: 'gresit@exemplu.ro', password: 'nimic' }),
    (err) => err instanceof ApiError && err.status === 401 && err.detail === 'Email sau parolă greșite',
  );
});

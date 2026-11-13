// Singurul loc din frontend care vorbește cu API-ul FastAPI.
// Adaugă token-ul JWT, transformă erorile în ApiError cu mesaj în română
// și, cu VITE_USE_MOCKS=true, răspunde din src/api/mock fără backend.
import { API_URL, USE_MOCKS } from '../config/env.js';
import { getToken as readToken, clearToken } from '../auth/tokenStore.js';
import { mockRequest } from './mock/index.js';

export class ApiError extends Error {
  constructor(status, detail) {
    super(detail);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

const OFFLINE_MESSAGE = 'Nu există conexiune la internet. Încearcă din nou.';
const GENERIC_MESSAGE = 'Ceva n-a mers. Încearcă din nou peste câteva momente.';

// FastAPI întoarce {detail: "text"} sau, la validare (422), {detail: [{msg}, ...]}.
function detailText(body) {
  const detail = body?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && detail.length) return detail.map((d) => d.msg).join(' ');
  return GENERIC_MESSAGE;
}

function buildQuery(params) {
  if (!params) return '';
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.append(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

function notifyUnauthorized() {
  clearToken();
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('pcp:unauthorized'));
}

export function createClient({
  baseUrl = API_URL,
  useMocks = false,
  mockDelayMs = 300,
  fetchImpl = (...args) => globalThis.fetch(...args),
  getToken = readToken,
  onUnauthorized = notifyUnauthorized,
} = {}) {
  async function viaMock(method, path, body) {
    if (mockDelayMs) await new Promise((r) => setTimeout(r, mockDelayMs));
    try {
      return await mockRequest(method, path, body, { token: getToken() });
    } catch (err) {
      if (err?.status === 401) onUnauthorized();
      throw new ApiError(err?.status ?? 500, err?.detail ?? GENERIC_MESSAGE);
    }
  }

  async function request(method, path, { params, body, form } = {}) {
    const url = `${path}${buildQuery(params)}`;
    if (useMocks) return viaMock(method, url, form ?? body);

    const headers = {};
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    let payload;
    if (form) {
      payload = form; // browserul pune singur Content-Type cu boundary
    } else if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }

    let res;
    try {
      res = await fetchImpl(`${baseUrl}${url}`, { method, headers, body: payload });
    } catch {
      throw new ApiError(0, OFFLINE_MESSAGE);
    }

    const isJson = res.headers?.get?.('content-type')?.includes('application/json');
    const data = res.status === 204 || !isJson ? null : await res.json().catch(() => null);
    if (!res.ok) {
      if (res.status === 401) onUnauthorized();
      throw new ApiError(res.status, detailText(data));
    }
    return data;
  }

  return {
    get: (path, params) => request('GET', path, { params }),
    post: (path, body) => request('POST', path, { body }),
    put: (path, body) => request('PUT', path, { body }),
    patch: (path, body) => request('PATCH', path, { body }),
    del: (path) => request('DELETE', path),
    upload: (path, form) => request('POST', path, { form }),
  };
}

export const api = createClient({ useMocks: USE_MOCKS });

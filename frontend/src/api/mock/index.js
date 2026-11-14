// Backend fals pentru VITE_USE_MOCKS=true. Respectă contractul din planul 20SOFT
// (Endpoint-uri FastAPI): aceleași căi, aceleași coduri de eroare, mesaje în română.
// Erorile se aruncă drept {status, detail}; client.js le transformă în ApiError.
import { places } from './fixtures/places.js';
import { reports } from './fixtures/reports.js';
import { works } from './fixtures/works.js';
import { stops, arrivalsFor } from './fixtures/transit.js';
import { users, defaultProfile, MOCK_PASSWORD } from './fixtures/users.js';
import { demoRoute } from './fixtures/routes.js';
import { reportScores, projects, vehicles, edges, zones, heat, institutions, trustHistory } from './fixtures/admin.js';
import { fold } from '../../lib/ro.js';
import { DEMO_BBOX } from '../../config/env.js';
import { distanceM } from '../../components/map/geo.js';

// Adrese de exemplu, ca rezultatele din Nominatim (doar în zona demo).
const addresses = [
  { id: 'adr-1', name: 'Piața Victoriei', address: 'Timișoara', geometry: { type: 'Point', coordinates: [21.2255, 45.7530] }, source: 'address' },
  { id: 'adr-2', name: 'Piața Eftimie Murgu', address: 'Timișoara', geometry: { type: 'Point', coordinates: [21.2238, 45.7522] }, source: 'address' },
  { id: 'adr-3', name: 'Bulevardul Vasile Pârvan', address: 'Timișoara', geometry: { type: 'Point', coordinates: [21.2300, 45.7478] }, source: 'address' },
  { id: 'adr-4', name: 'Aleea Studenților', address: 'Timișoara', geometry: { type: 'Point', coordinates: [21.2385, 45.7474] }, source: 'address' },
];

// Traseu de demo cu o singură linie (planul 20SOFT: fără schimbări în prima versiune).
function transitRoute(start, end) {
  const [s1, s2] = [stops[0].geometry.coordinates, stops[1].geometry.coordinates];
  const tram = [s1, [21.2340, 45.7480], [21.2300, 45.7480], [21.2275, 45.7505], s2];
  const legs = [
    { type: 'walk', distance_m: 220, duration_min: 4, to_name: 'Stația Complex Studențesc', geometry: { type: 'LineString', coordinates: [start, s1] } },
    {
      type: 'transit', line: '1', vehicle_type: 'Tramvai', headsign: 'Piața Victoriei', stops_count: 3, duration_min: 7,
      board_stop: 'Stația Complex Studențesc', alight_stop: 'Stația Piața Victoriei',
      departure: new Date(Date.now() + 4 * 60000).toISOString(),
      vehicle: { has_ramp: true, ramp_ok: true, low_floor: true, has_audio_announce: true, audio_ok: true, has_visual_display: true },
      geometry: { type: 'LineString', coordinates: tram },
    },
    { type: 'walk', distance_m: 230, duration_min: 3, to_name: 'destinație, intrarea cu rampă', geometry: { type: 'LineString', coordinates: [s2, end] } },
  ];
  return {
    route: { type: 'LineString', coordinates: [start, ...tram, end] },
    length_m: 1650,
    duration_min: 14,
    legs,
    steps: [
      { instruction: 'Mergi pe jos până la Stația Complex Studențesc', distance_m: 220, coord: start },
      { instruction: 'Urcă în Tramvaiul 1 spre Piața Victoriei', distance_m: 0, coord: s1 },
      { instruction: 'Coboară la Stația Piața Victoriei', distance_m: 0, coord: s2 },
      { instruction: 'Ai ajuns la destinație', distance_m: 0, coord: end },
    ],
    warnings: [],
    explanation: 'Am ales doar vehicule cu rampă funcțională.',
  };
}

const fail = (status, detail) => {
  throw { status, detail };
};

const profiles = new Map([[1, { ...defaultProfile }]]);
const submitted = []; // { user_id, at } pentru limita de 5 rapoarte pe oră
const confirmations = new Set();

function userFromToken(token) {
  const email = token?.startsWith('mock:') ? token.slice(5) : null;
  return users.find((u) => u.email === email) ?? null;
}

function requireAdmin(ctx) {
  const user = requireUser(ctx);
  if (user.role !== 'admin' && user.role !== 'superadmin') fail(403, 'Nu ai acces la panoul de administrare.');
  return user;
}

function requireSuper(ctx) {
  const user = requireUser(ctx);
  if (user.role !== 'superadmin') fail(403, 'Doar un superadmin poate face asta.');
  return user;
}

function requireUser(ctx) {
  const user = userFromToken(ctx.token);
  if (!user) fail(401, 'Autentifică-te ca să continui.');
  return user;
}

function inBbox(feature, bboxText) {
  if (!bboxText) return true;
  const [minLon, minLat, maxLon, maxLat] = bboxText.split(',').map(Number);
  const [lon, lat] = feature.geometry.coordinates;
  return lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat;
}

const collection = (features) => ({ type: 'FeatureCollection', features });

// [metodă, tipar de cale, handler(params, query, body, ctx)]
const routes = [
  ['POST', /^\/auth\/login$/, (p, q, body) => {
    const user = users.find((u) => u.email === body?.email?.trim().toLowerCase());
    if (!user || body?.password !== MOCK_PASSWORD) fail(401, 'Email sau parolă greșite');
    if (!user.is_verified) fail(403, 'Contul nu e confirmat încă. Verifică emailul.');
    return { access_token: `mock:${user.email}`, token_type: 'bearer' };
  }],
  ['POST', /^\/auth\/register$/, (p, q, body) => {
    if (users.some((u) => u.email === body?.email)) fail(409, 'Există deja un cont cu acest email.');
    if (!body?.password || body.password.length < 8) fail(422, 'Parola trebuie să aibă cel puțin 8 caractere.');
    return { detail: 'Ți-am trimis un email de confirmare.' };
  }],
  ['GET', /^\/auth\/verify$/, (p, q) => {
    if (q.get('token') !== 'valid') fail(400, 'Linkul a expirat sau a fost deja folosit.');
    return { detail: 'Contul e confirmat.' };
  }],
  ['POST', /^\/auth\/resend-verification$/, () => ({ detail: 'Dacă adresa are cont, îți trimitem un link nou.' })],
  ['POST', /^\/auth\/forgot-password$/, () => ({ detail: 'Dacă adresa are cont, îți trimitem un link.' })],
  ['POST', /^\/auth\/reset-password$/, (p, q, body) => {
    if (body?.token !== 'valid') fail(400, 'Linkul a expirat sau a fost deja folosit.');
    return { detail: 'Parola a fost schimbată.' };
  }],

  ['GET', /^\/users\/me$/, (p, q, b, ctx) => requireUser(ctx)],
  ['PATCH', /^\/users\/me$/, (p, q, body, ctx) => {
    const user = requireUser(ctx);
    const name = (body?.display_name ?? '').trim().replace(/\s+/g, ' ');
    if (name.length === 1 || name.length > 60) fail(422, 'Numele are între 2 și 60 de caractere.');
    user.display_name = name || null;
    return user;
  }],
  ['POST', /^\/users\/me\/avatar$/, (p, q, form, ctx) => {
    const user = requireUser(ctx);
    const photo = form?.get?.('photo');
    if (!(photo instanceof Blob)) fail(400, 'Alege o poză JPEG sau PNG.');
    user.avatar_url = typeof URL !== 'undefined' && URL.createObjectURL ? URL.createObjectURL(photo) : 'mock-avatar.jpg';
    return user;
  }],
  ['DELETE', /^\/users\/me\/avatar$/, (p, q, b, ctx) => {
    const user = requireUser(ctx);
    user.avatar_url = null;
    return user;
  }],
  ['GET', /^\/users\/me\/export$/, (p, q, b, ctx) => {
    const user = requireUser(ctx);
    return { account: user, profile: profiles.get(user.id) ?? null, reports: reports.filter((f) => f.properties.reporter?.user_id === user.id).map((f) => f.properties) };
  }],
  ['DELETE', /^\/users\/me$/, (p, q, b, ctx) => {
    const user = requireUser(ctx);
    // Ștergerea contului șterge și rapoartele lui, care dispar de pe hartă (design · CLAUDE.md).
    for (let i = reports.length - 1; i >= 0; i--) if (reports[i].properties.reporter?.user_id === user.id) reports.splice(i, 1);
    users.splice(users.indexOf(user), 1);
    return null;
  }],
  ['GET', /^\/users\/me\/profile$/, (p, q, b, ctx) => profiles.get(requireUser(ctx).id) ?? null],
  ['PUT', /^\/users\/me\/profile$/, (p, q, body, ctx) => {
    const user = requireUser(ctx);
    profiles.set(user.id, { ...body });
    return profiles.get(user.id);
  }],

  ['GET', /^\/places$/, (p, q) => {
    const category = q.get('category');
    return collection(
      places.filter((f) => inBbox(f, q.get('bbox')) && (!category || f.properties.category === category)),
    );
  }],
  ['GET', /^\/places\/(\d+)$/, ([id]) => places.find((f) => f.id === Number(id)) ?? fail(404, 'Locul nu există.')],
  ['GET', /^\/search$/, (p, q) => {
    const query = fold(q.get('q') ?? '');
    if (query.length < 2) return [];
    const found = places
      .filter((f) => f.properties.category === 'building')
      .filter((f) => fold(f.properties.name).includes(query) || fold(f.properties.attributes.address ?? '').includes(query))
      .map((f) => ({
        id: f.id,
        name: f.properties.name,
        address: f.properties.attributes.address ?? null,
        attributes: f.properties.attributes,
        geometry: f.geometry,
        source: 'place',
      }));
    const addr = addresses.filter((a) => fold(a.name).includes(query));
    return [...found, ...addr];
  }],
  ['GET', /^\/works$/, () => collection(works)],

  ['POST', /^\/reports$/, (p, q, form, ctx) => {
    const user = requireUser(ctx);
    if (!user.is_verified) fail(403, 'Contul nu e confirmat încă.');
    if (user.suspended_until && new Date(user.suspended_until) > new Date()) {
      fail(403, `Raportarea e oprită până pe ${user.suspended_until}.`);
    }
    const now = Date.now();
    const mine = submitted.filter((r) => r.user_id === user.id && now - r.at < 3600_000);
    if (mine.length >= 5) {
      const again = new Date(mine[0].at + 3600_000).toISOString();
      fail(429, `Ai trimis 5 rapoarte în ultima oră. Poți trimite din nou de la ${again}.`);
    }
    const get = (k) => form?.get?.(k) ?? null;
    const category = get('category');
    const point = get('lon') ? [Number(get('lon')), Number(get('lat'))] : null;
    // Deduplicare: aceeași categorie la cel mult 25 m devine confirmare (planul 20SOFT, pasul 3).
    const dup = point && reports.find((r) => r.properties.category === category && distanceM(r.geometry.coordinates, point) <= 25);
    submitted.push({ user_id: user.id, at: now });
    if (dup) {
      dup.properties.confirmations = (dup.properties.confirmations ?? 0) + 1;
      return { merged_into: dup.properties.public_code, confirmations: dup.properties.confirmations, category };
    }
    const id = 123 + reports.length + submitted.length;
    const code = `TM-2026-${String(id).padStart(6, '0')}`;
    if (point) {
      reports.push({
        type: 'Feature',
        id,
        geometry: { type: 'Point', coordinates: point },
        properties: {
          id, public_code: code, category, status: 'in_lucru', possibly_resolved: false,
          created_at: new Date(now).toISOString(), location_text: get('location_text') ?? '', description: get('description') ?? '',
          confirmations: 0, reporter: { name: user.email.split('@')[0], user_id: user.id },
          // Mock-ul ține poza doar în memoria browserului, ca pagina raportului să o poată arăta.
          photo_url: typeof URL !== 'undefined' && form?.get?.('photo') instanceof Blob ? URL.createObjectURL(form.get('photo')) : null,
        },
      });
    }
    return { public_code: code, status: 'in_lucru' };
  }],
  ['POST', /^\/reports\/(\d+)\/confirm$/, ([id], q, body, ctx) => {
    const user = requireUser(ctx);
    const r = reports.find((f) => f.id === Number(id)) ?? fail(404, 'Raportul nu există.');
    if (r.properties.reporter?.user_id === user.id) fail(400, 'Nu îți poți confirma propriul raport.');
    const key = `${id}:${user.id}:${body?.kind}`;
    if (confirmations.has(key)) fail(400, 'Ai confirmat deja raportul ăsta.');
    confirmations.add(key);
    if (body?.kind !== 'rezolvat') r.properties.confirmations = (r.properties.confirmations ?? 0) + 1;
    return { confirmations: r.properties.confirmations };
  }],
  ['GET', /^\/reports\/mine$/, (p, q, b, ctx) => {
    const user = requireUser(ctx);
    return reports.filter((f) => f.properties.reporter?.user_id === user.id).map((f) => ({ ...f.properties, geometry: f.geometry }));
  }],
  ['GET', /^\/reports$/, (p, q) => {
    const status = q.get('status');
    return collection(reports.filter((f) => inBbox(f, q.get('bbox')) && (status ? f.properties.status === status : f.properties.status === 'in_lucru')));
  }],
  ['GET', /^\/reports\/(TM-\d{4}-\d{6})$/, ([code]) =>
    reports.find((f) => f.properties.public_code === code) ?? fail(404, 'Raportul nu există.')],

  ['GET', /^\/transit\/stops$/, (p, q) => collection(stops.filter((f) => inBbox(f, q.get('bbox'))))],
  ['GET', /^\/transit\/stops\/(\d+)\/arrivals$/, ([id]) => arrivalsFor(Number(id))],
  ['GET', /^\/transit\/routes$/, () => [
    { id: 1, short_name: '1', type: 'tramvai' },
    { id: 14, short_name: '14', type: 'troleibuz' },
  ]],

  // ——— Administrare ———
  ['GET', /^\/admin\/reports$/, (p, q, b, ctx) => {
    requireAdmin(ctx);
    const status = q.get('status');
    const category = q.get('category');
    let items = reports.map((f) => {
      const sc = reportScores[f.id] ?? { ai: 30, date: 10, location: 20, ai_notes: 'neverificat' };
      return { ...f.properties, geometry: f.geometry, score: { ...sc, total: sc.ai + sc.date + sc.location } };
    });
    if (status === 'active') items = items.filter((r) => r.status === 'in_lucru');
    else if (status) items = items.filter((r) => r.status === status);
    if (category) items = items.filter((r) => r.category === category);
    items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const limit = Number(q.get('limit') ?? 50);
    const offset = Number(q.get('offset') ?? 0);
    return { items: items.slice(offset, offset + limit), total: items.length };
  }],
  ['PATCH', /^\/admin\/reports\/(\d+)$/, ([id], q, body, ctx) => {
    requireAdmin(ctx);
    const r = reports.find((f) => f.id === Number(id)) ?? fail(404, 'Raportul nu există.');
    if (body.status === 'respins' && !body.reason) fail(422, 'Alege motivul respingerii.');
    Object.assign(r.properties, { status: body.status, is_false: !!body.is_false });
    if (body.status !== 'in_lucru') r.properties.resolved_at = new Date().toISOString();
    return r.properties;
  }],
  ['GET', /^\/admin\/works$/, (p, q, b, ctx) => { requireAdmin(ctx); return collection(works); }],
  ['POST', /^\/admin\/works$/, (p, q, body, ctx) => {
    requireAdmin(ctx);
    const id = Math.max(0, ...works.map((w) => w.id)) + 1;
    const w = { type: 'Feature', id, geometry: body.geometry, properties: { id, title: body.title, description: body.description, start_date: body.start_date, end_date: body.end_date, blocks_route: body.blocks_route } };
    works.push(w);
    return w;
  }],
  ['PATCH', /^\/admin\/works\/(\d+)$/, ([id], q, body, ctx) => {
    requireAdmin(ctx);
    const w = works.find((x) => x.id === Number(id)) ?? fail(404, 'Lucrarea nu există.');
    const { geometry, ...fields } = body ?? {};
    if (geometry) w.geometry = geometry;
    Object.assign(w.properties, fields);
    return w;
  }],
  ['DELETE', /^\/admin\/works\/(\d+)$/, ([id], q, b, ctx) => {
    requireAdmin(ctx);
    const i = works.findIndex((w) => w.id === Number(id));
    if (i >= 0) works.splice(i, 1);
    return null;
  }],
  ['GET', /^\/admin\/projects$/, (p, q, b, ctx) => { requireAdmin(ctx); return projects; }],
  ['POST', /^\/admin\/projects$/, (p, q, body, ctx) => {
    requireAdmin(ctx);
    const pr = { ...body, id: Math.max(0, ...projects.map((x) => x.id)) + 1 };
    projects.push(pr);
    return pr;
  }],
  ['PATCH', /^\/admin\/projects\/(\d+)$/, ([id], q, body, ctx) => {
    requireAdmin(ctx);
    const pr = projects.find((x) => x.id === Number(id)) ?? fail(404, 'Proiectul nu există.');
    return Object.assign(pr, body);
  }],
  ['DELETE', /^\/admin\/projects\/(\d+)$/, ([id], q, b, ctx) => {
    requireAdmin(ctx);
    const i = projects.findIndex((x) => x.id === Number(id));
    if (i >= 0) projects.splice(i, 1);
    return null;
  }],
  ['POST', /^\/admin\/places$/, (p, q, body, ctx) => {
    requireAdmin(ctx);
    const id = Math.max(...places.map((x) => x.id)) + 1;
    const f = { type: 'Feature', id, geometry: body.geometry, properties: { id, name: body.name, category: body.category, attributes: body.attributes ?? {} } };
    places.push(f);
    return f;
  }],
  ['PATCH', /^\/admin\/places\/(\d+)$/, ([id], q, body, ctx) => {
    requireAdmin(ctx);
    const f = places.find((x) => x.id === Number(id)) ?? fail(404, 'Locul nu există.');
    if (body.geometry) f.geometry = body.geometry;
    Object.assign(f.properties, { name: body.name ?? f.properties.name, category: body.category ?? f.properties.category, attributes: { ...f.properties.attributes, ...(body.attributes ?? {}) } });
    return f;
  }],
  ['DELETE', /^\/admin\/places\/(\d+)$/, ([id], q, b, ctx) => {
    requireAdmin(ctx);
    const i = places.findIndex((x) => x.id === Number(id));
    if (i >= 0) places.splice(i, 1);
    return null;
  }],
  ['GET', /^\/admin\/edges$/, (p, q, b, ctx) => { requireAdmin(ctx); return collection(edges); }],
  ['PATCH', /^\/admin\/edges\/(\d+)$/, ([id], q, body, ctx) => {
    requireAdmin(ctx);
    const e = edges.find((x) => x.id === Number(id)) ?? fail(404, 'Tronsonul nu există.');
    if (body.kerb_height_cm != null && (body.kerb_height_cm < 0 || body.kerb_height_cm > 30)) fail(422, 'Bordura trebuie să fie între 0 și 30 cm.');
    Object.assign(e.properties, body);
    return e;
  }],
  ['GET', /^\/admin\/vehicles$/, (p, q, b, ctx) => { requireAdmin(ctx); return vehicles; }],
  ['PATCH', /^\/admin\/vehicles\/([\w-]+)$/, ([id], q, body, ctx) => {
    const user = requireAdmin(ctx);
    if (user.role !== 'superadmin' && user.institution?.type !== 'transport') fail(403, 'Doar operatorul de transport poate modifica vehiculele.');
    const v = vehicles.find((x) => x.id === id) ?? fail(404, 'Vehiculul nu există.');
    return Object.assign(v, body);
  }],
  ['GET', /^\/admin\/stats\/heatmap$/, (p, q, b, ctx) => { requireAdmin(ctx); return heat; }],
  ['GET', /^\/admin\/stats\/zones$/, (p, q, b, ctx) => { requireAdmin(ctx); return zones; }],
  ['GET', /^\/admin\/users$/, (p, q, b, ctx) => {
    requireSuper(ctx);
    const query = fold(q.get('q') ?? '');
    const trust = q.get('trust');
    const items = users
      .filter((u) => !query || fold(u.email).includes(query) || fold(u.display_name ?? '').includes(query))
      .filter((u) => !trust || String(u.trust_level) === trust)
      .map((u) => ({
        ...u,
        reports_count: reports.filter((r) => r.properties.reporter?.user_id === u.id).length,
        false_count: reports.filter((r) => r.properties.reporter?.user_id === u.id && r.properties.is_false).length,
        history: trustHistory[u.id] ?? [],
      }));
    return { items, total: items.length };
  }],
  ['PATCH', /^\/admin\/users\/(\d+)$/, ([id], q, body, ctx) => {
    const admin = requireSuper(ctx);
    const u = users.find((x) => x.id === Number(id)) ?? fail(404, 'Utilizatorul nu există.');
    if (!body.reason?.trim()) fail(422, 'Scrie motivul schimbării.');
    const before = u.trust_level;
    u.trust_level = body.trust_level;
    u.suspended_until = body.trust_level === 0 ? new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString() : null;
    trustHistory[u.id] = [{ change: `${before} → ${body.trust_level}: ${body.reason}`, at: new Date().toISOString(), by: admin.email }, ...(trustHistory[u.id] ?? [])];
    return { ...u, history: trustHistory[u.id] };
  }],
  ['GET', /^\/admin\/institutions$/, (p, q, b, ctx) => { requireSuper(ctx); return institutions; }],
  ['POST', /^\/admin\/institutions$/, (p, q, body, ctx) => {
    requireSuper(ctx);
    if (!body.name?.trim()) fail(422, 'Scrie numele instituției.');
    const inst = { id: Math.max(...institutions.map((i) => i.id)) + 1, name: body.name, type: body.type, accounts: body.accounts?.length ?? 0, scopes: body.scopes ?? [] };
    institutions.push(inst);
    return inst;
  }],
  ['POST', /^\/routes\/plan$/, (p, q, body, ctx) => {
    requireUser(ctx);
    const { start, end } = body ?? {};
    const inside = (pt) => inBbox({ geometry: { coordinates: pt } }, DEMO_BBOX.join(','));
    if (!start || !end || !inside(start) || !inside(end)) fail(422, 'Punctul e în afara zonei acoperite');
    // Demo pentru G1: spre UMF nu există drum fără bordură înaltă.
    if (Math.abs(end[0] - 21.2236) < 0.0008 && Math.abs(end[1] - 45.7525) < 0.0008) {
      fail(404, 'Nu există traseu care să respecte profilul tău');
    }
    if (body.mode === 'transit') return transitRoute(start, end);
    const route = structuredClone(demoRoute);
    route.route.coordinates[0] = start;
    route.route.coordinates[route.route.coordinates.length - 1] = end;
    route.steps[0].coord = start;
    route.steps[route.steps.length - 1].coord = end;
    return route;
  }],
  ['POST', /^\/routes\/check$/, (p, q, b, ctx) => {
    requireUser(ctx);
    return { blocked: false };
  }],
];

export async function mockRequest(method, url, body, ctx = {}) {
  const [path, queryText = ''] = url.split('?');
  const query = new URLSearchParams(queryText);
  for (const [m, pattern, handler] of routes) {
    if (m !== method) continue;
    const match = path.match(pattern);
    if (match) return structuredClone(handler(match.slice(1), query, body, ctx));
  }
  fail(404, `Mock-ul nu are încă ${method} ${path}.`);
}

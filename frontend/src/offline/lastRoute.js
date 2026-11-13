// Ultimul traseu calculat, păstrat local ca să meargă și fără conexiune (G8; Observații §10).
const KEY = 'pcp_last_route';
const MAX_AGE_MS = 24 * 3600 * 1000;

export function createLastRouteStore(storage = globalThis.localStorage, now = () => new Date()) {
  return {
    save(route) {
      try {
        storage?.setItem(KEY, JSON.stringify({ ...route, saved_at: now().toISOString() }));
      } catch {
        /* fără stocare: offline nu avem traseu salvat */
      }
    },
    load() {
      try {
        const r = JSON.parse(storage?.getItem(KEY) ?? 'null');
        if (!r || now() - new Date(r.saved_at) > MAX_AGE_MS) return null;
        return r;
      } catch {
        return null;
      }
    },
  };
}

export const lastRoute = createLastRouteStore();

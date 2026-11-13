// Preferințele de afișare și indicații (profil: „Afișare și indicații”).
// Se păstrează local; când backendul le va salva în cont, le sincronizăm de aici.
const KEY = 'pcp_prefs';

export const DEFAULT_PREFS = Object.freeze({
  theme: 'system', // 'system' | 'light' | 'dark'
  highContrast: false,
  simplified: false,
  voice: false,
  vibration: true,
});

export function resolveAppearance(prefs, { prefersDark = false, prefersMoreContrast = false } = {}) {
  const theme = prefs.theme === 'system' ? (prefersDark ? 'dark' : 'light') : prefs.theme;
  const contrast = prefs.highContrast || prefersMoreContrast ? 'high' : 'normal';
  return { theme, contrast };
}

function pick(raw) {
  const out = { ...DEFAULT_PREFS };
  for (const key of Object.keys(DEFAULT_PREFS)) {
    if (raw && typeof raw[key] === typeof DEFAULT_PREFS[key]) out[key] = raw[key];
  }
  return out;
}

export function loadPrefs(storage = globalThis.localStorage) {
  try {
    const text = storage?.getItem(KEY);
    return text ? pick(JSON.parse(text)) : { ...DEFAULT_PREFS };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function savePrefs(prefs, storage = globalThis.localStorage) {
  try {
    storage?.setItem(KEY, JSON.stringify(pick(prefs)));
  } catch {
    /* fără stocare: preferințele țin doar cât e deschisă pagina */
  }
}

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { loadPrefs, resolveAppearance, savePrefs } from './prefs.js';

const PrefsContext = createContext(null);

function useMedia(query) {
  const [matches, setMatches] = useState(() => window.matchMedia?.(query).matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return undefined;
    const onChange = () => setMatches(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

/** Aplică tema pe <html> (data-theme, data-contrast) și oferă preferințele prin usePrefs(). */
export function PrefsProvider({ children }) {
  const [prefs, setPrefs] = useState(loadPrefs);
  const prefersDark = useMedia('(prefers-color-scheme: dark)');
  const prefersMoreContrast = useMedia('(prefers-contrast: more)');
  const appearance = resolveAppearance(prefs, { prefersDark, prefersMoreContrast });

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = appearance.theme;
    root.dataset.contrast = appearance.contrast;
  }, [appearance.theme, appearance.contrast]);

  const setPref = useCallback((key, value) => {
    setPrefs((p) => {
      const next = { ...p, [key]: value };
      savePrefs(next);
      return next;
    });
  }, []);

  // themePref = ce a ales utilizatorul ('system' | 'light' | 'dark'); theme = ce se afișează acum.
  const value = useMemo(
    () => ({ ...prefs, themePref: prefs.theme, theme: appearance.theme, contrast: appearance.contrast, setPref }),
    [prefs, appearance.theme, appearance.contrast, setPref],
  );
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs() {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error('usePrefs trebuie folosit în <PrefsProvider>');
  return ctx;
}

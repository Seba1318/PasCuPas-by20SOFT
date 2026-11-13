import { useEffect, useState } from 'react';
import { users } from '../api/endpoints.js';
import { usePrefs } from '../accessibility/PrefsProvider.jsx';
import { EMPTY_PROFILE, buildProfile } from './presets.js';
import { setCachedProfile } from './useProfile.js';

/**
 * Starea formularului de profil (B2, W3): profilul de rutare + preferințele de afișare.
 * `needs` (opțional): tipurile bifate la bun venit, din care pornesc valorile inițiale.
 */
export function useProfileEditor(needs) {
  const prefs = usePrefs();
  const [value, setValue] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const ui = { highContrast: prefs.highContrast, voice: prefs.voice, vibration: prefs.vibration, simplified: prefs.simplified };

  useEffect(() => {
    if (needs) {
      const built = buildProfile(needs);
      setValue({ profile: built.profile, ui: { ...ui, ...built.uiPrefs } });
      return;
    }
    users
      .getProfile()
      .then((p) => setValue({ profile: { ...EMPTY_PROFILE, ...(p ?? {}) }, ui }))
      .catch(() => setValue({ profile: { ...EMPTY_PROFILE }, ui }));
    // o singură dată, la deschidere
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await users.saveProfile(value.profile);
      setCachedProfile(value.profile);
      for (const [key, v] of Object.entries(value.ui)) prefs.setPref(key, v);
      return true;
    } catch (err) {
      setError(err.detail);
      return false;
    } finally {
      setBusy(false);
    }
  };

  return { value, setValue, save, busy, error };
}

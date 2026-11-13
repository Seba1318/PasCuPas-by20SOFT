import { useEffect, useState } from 'react';
import { users } from '../api/endpoints.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { EMPTY_PROFILE } from './presets.js';

// Profilul de nevoi al utilizatorului autentificat, cu o copie în memorie pentru toate ecranele.
let cache = null;
const listeners = new Set();

export function setCachedProfile(profile) {
  cache = profile;
  listeners.forEach((fn) => fn(profile));
}

export function useProfile() {
  const { status } = useAuth();
  const [profile, setProfile] = useState(cache);

  useEffect(() => {
    listeners.add(setProfile);
    return () => listeners.delete(setProfile);
  }, []);

  useEffect(() => {
    if (status !== 'authed') {
      cache = null; // alt cont sau deconectare: nu păstrăm profilul vechi
      setProfile(null);
      return;
    }
    if (cache) return;
    users
      .getProfile()
      .then((p) => setCachedProfile({ ...EMPTY_PROFILE, ...(p ?? {}) }))
      .catch(() => setCachedProfile({ ...EMPTY_PROFILE }));
  }, [status]);

  return profile ?? EMPTY_PROFILE;
}

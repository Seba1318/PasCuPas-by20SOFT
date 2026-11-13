import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { auth, users } from '../api/endpoints.js';
import { clearToken, getToken, setToken } from './tokenStore.js';

const AuthContext = createContext(null);

/**
 * Starea contului: 'loading' până aflăm dacă tokenul salvat e încă bun, apoi 'anon' sau 'authed'.
 * Orice 401 de la API (evenimentul pcp:unauthorized) ne trece înapoi în 'anon'.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState(getToken() ? 'loading' : 'anon');

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setStatus('anon');
      return null;
    }
    try {
      const me = await users.me();
      setUser(me);
      setStatus('authed');
      return me;
    } catch {
      setUser(null);
      setStatus('anon');
      return null;
    }
  }, []);

  useEffect(() => {
    refresh();
    const onUnauthorized = () => {
      setUser(null);
      setStatus('anon');
    };
    window.addEventListener('pcp:unauthorized', onUnauthorized);
    return () => window.removeEventListener('pcp:unauthorized', onUnauthorized);
  }, [refresh]);

  const login = useCallback(
    async (email, password) => {
      const { access_token } = await auth.login({ email: email.trim().toLowerCase(), password });
      setToken(access_token);
      return refresh();
    },
    [refresh],
  );

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
    setStatus('anon');
  }, []);

  const value = useMemo(() => ({ user, status, login, logout, refresh }), [user, status, login, logout, refresh]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth trebuie folosit în <AuthProvider>');
  return ctx;
}

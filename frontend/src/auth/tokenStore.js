// Token-ul JWT în localStorage. Orice acces poate arunca (mod privat, stocare blocată),
// deci totul e în try/catch: fără stocare, utilizatorul doar trebuie să se autentifice din nou.
const KEY = 'pcp_token';

function storage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function getToken() {
  try {
    return storage()?.getItem(KEY) ?? null;
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    storage()?.setItem(KEY, token);
  } catch {
    /* fără stocare: tokenul trăiește doar în sesiunea curentă */
  }
}

export function clearToken() {
  try {
    storage()?.removeItem(KEY);
  } catch {
    /* nimic de șters */
  }
}

// Validările din formularele de cont (A1, A2, A5). Serverul verifică din nou;
// aici doar spunem devreme și pe înțeles ce lipsește.

export const passwordChecks = (password) => ({
  length: password.length >= 8,
  digit: /\d/.test(password),
});

export function validateEmail(email) {
  const value = email.trim();
  if (!value) return 'Scrie adresa de email.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Adresa de email nu pare completă. Exemplu: nume@exemplu.ro';
  return null;
}

function passwordError(password) {
  const { length, digit } = passwordChecks(password);
  if (!length && !digit) return 'Parola are nevoie de cel puțin 8 caractere și cel puțin o cifră.';
  if (!length) return 'Parola are nevoie de cel puțin 8 caractere.';
  if (!digit) return 'Parola are nevoie de cel puțin o cifră.';
  return null;
}

const compact = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v));

export function validateLogin({ email, password }) {
  return compact({ email: validateEmail(email), password: password ? null : 'Scrie parola.' });
}

export function validateNewPassword({ password, confirm }) {
  return compact({
    password: passwordError(password),
    confirm: password && confirm !== password ? 'Parolele nu sunt la fel. Mai scrie-o o dată.' : null,
  });
}

export function validateRegister({ email, password, confirm }) {
  return { ...compact({ email: validateEmail(email) }), ...validateNewPassword({ password, confirm }) };
}

// După autentificare ne întoarcem doar pe o pagină din aplicație, nu pe alt site.
export function safeNext(next) {
  if (typeof next !== 'string' || !next.startsWith('/') || next.startsWith('//')) return '/';
  // Browserele citesc „\” ca „/” și scot tab și rând nou, deci „/\site” ar ajunge la „//site”.
  // eslint-disable-next-line no-control-regex
  if (/[\\\u0000-\u001f]/.test(next)) return '/';
  return next;
}

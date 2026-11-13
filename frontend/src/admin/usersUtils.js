// Utilizatori și instituții (X10, X11): niveluri de încredere din plan (100 / 50 / 0) și validări.
import { validateEmail } from '../auth/validation.js';

export const TRUST_OPTIONS = [
  ['100', 'Ridicat (100): rapoartele blochează imediat'],
  ['50', 'Mediu (50): rapoartele au nevoie de o confirmare'],
  ['0', 'Scăzut (0): raportare suspendată 3 luni'],
];

export function trustLabel(level) {
  if (level >= 100) return 'Ridicat';
  if (level >= 50) return 'Mediu';
  return 'Scăzut · suspendat';
}

export function validateTrustChange({ current, next, reason }) {
  const e = {};
  if (Number(next) === Number(current)) e.next = 'Alege un nivel diferit de cel actual.';
  if (!reason?.trim()) e.reason = 'Scrie motivul. Rămâne în istoricul utilizatorului.';
  return e;
}

export function validateInstitution({ name, accounts }) {
  const e = {};
  if (!name?.trim()) e.name = 'Scrie numele instituției.';
  if (!accounts.length) e.accounts = 'Adaugă cel puțin un cont.';
  accounts.forEach((a, i) => {
    const problem = validateEmail(a.email ?? '');
    if (problem) e[`account-${i}`] = problem;
  });
  return e;
}

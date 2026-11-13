// Formatare pentru utilizator: virgulă zecimală, luni în română, ora din Timișoara.
const TZ = 'Europe/Bucharest';
const NBSP = ' ';

const decimal = (value, digits = 1) =>
  new Intl.NumberFormat('ro-RO', { maximumFractionDigits: digits }).format(value);

export function formatDistance(meters) {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${decimal(Math.round(meters / 100) / 10)} km`;
}

export function formatDuration(minutes) {
  const total = Math.round(minutes);
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export const formatPercent = (value) => `${decimal(value)}${NBSP}%`;

function parts(iso, options) {
  const out = {};
  for (const p of new Intl.DateTimeFormat('ro-RO', { timeZone: TZ, ...options }).formatToParts(new Date(iso))) {
    out[p.type] = p.value;
  }
  return out;
}

// „18 oct. 2026”
export function formatDate(iso) {
  const p = parts(iso, { day: 'numeric', month: 'short', year: 'numeric' });
  return `${p.day} ${p.month} ${p.year}`;
}

// „18 oct., 10:24”
export function formatDateTime(iso) {
  const p = parts(iso, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
  return `${p.day} ${p.month}, ${p.hour}:${p.minute}`;
}

// „14:32”
export function formatTime(iso) {
  const p = parts(iso, { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${p.hour}:${p.minute}`;
}

// Numerale românești: „20 de minute”, dar „2 zile”, „19 minute”.
function count(n, one, few, many) {
  if (n === 1) return one;
  const rest = n % 100;
  return n === 0 || (rest >= 1 && rest <= 19) ? `${n} ${few}` : `${n} de ${many}`;
}

export function formatRelative(iso, now = new Date()) {
  const seconds = Math.round((now - new Date(iso)) / 1000);
  if (seconds < 60) return 'chiar acum';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `acum ${count(minutes, 'un minut', 'minute', 'minute')}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `acum ${count(hours, 'o oră', 'ore', 'ore')}`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'ieri';
  if (days < 7) return `acum ${count(days, 'o zi', 'zile', 'zile')}`;
  return formatDate(iso);
}

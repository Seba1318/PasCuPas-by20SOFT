// Logica fără interfață a căutării (C3–C5, W5).
import { fixRo } from '../../lib/ro.js';

const foldChar = (c) => fixRo(c).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Împarte textul în partea dinainte, potrivirea și restul („Pia” + „ța Victoriei”),
// comparând fără diacritice, dar păstrând textul original la afișare.
export function splitMatch(text, query) {
  const chars = [...text];
  const folded = chars.map(foldChar);
  const q = [...query.trim()].map(foldChar).join('');
  if (!q || folded.some((f) => f.length !== 1)) return { pre: text, hit: '', post: '' };
  const at = folded.join('').indexOf(q);
  if (at < 0) return { pre: text, hit: '', post: '' };
  return {
    pre: chars.slice(0, at).join(''),
    hit: chars.slice(at, at + q.length).join(''),
    post: chars.slice(at + q.length).join(''),
  };
}

const KEY = 'pcp_recent';
const MAX = 5;

// Căutările recente (C4), păstrate local. Orice eroare de stocare înseamnă doar o listă goală.
export function createRecent(storage = globalThis.localStorage) {
  const read = () => {
    try {
      return JSON.parse(storage?.getItem(KEY) ?? '[]');
    } catch {
      return [];
    }
  };
  const write = (items) => {
    try {
      storage?.setItem(KEY, JSON.stringify(items));
    } catch {
      /* fără stocare */
    }
  };
  return {
    list: read,
    add: (item) => write([item, ...read().filter((r) => r.id !== item.id)].slice(0, MAX)),
    remove: (id) => write(read().filter((r) => r.id !== id)),
    clear: () => write([]),
  };
}

export function groupResults(results) {
  return {
    places: results.filter((r) => r.source === 'place'),
    addresses: results.filter((r) => r.source !== 'place'),
  };
}

export function accessBadge(attributes = {}) {
  if (attributes.step_free_entrance === true) return { tone: 'success', text: 'Intrare fără trepte' };
  if (attributes.step_free_entrance === false) return { tone: 'warning', text: 'Intrare cu trepte' };
  return null;
}

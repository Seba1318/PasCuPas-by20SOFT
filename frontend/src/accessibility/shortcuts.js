// Scurtăturile de pe desktop (W4, Observații §8). Cele dintr-o singură tastă nu se declanșează
// când focusul e într-un câmp de text, altfel „L” din „Lift” ar deschide legenda.
const MAP = { '/': 'search', '[': 'panel', l: 'legend', L: 'legend', '+': 'zoom-in', '=': 'zoom-in', '-': 'zoom-out', '?': 'help' };

export function shortcutFor(e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  const t = e.target ?? {};
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable) return null;
  return MAP[e.key] ?? null;
}

export const SHORTCUTS = [
  { keys: ['/'], what: 'Caută un loc sau o adresă' },
  { keys: ['Esc'], what: 'Închide panoul sau fereastra deschisă' },
  { keys: ['['], what: 'Restrânge sau extinde panoul lateral' },
  { keys: ['L'], what: 'Arată sau ascunde legenda hărții' },
  { keys: ['+', '−'], what: 'Mărește sau micșorează harta' },
  { keys: ['←', '→'], what: 'Mută harta (și ↑ ↓)' },
  { keys: ['Tab'], what: 'Treci la următorul element de pe hartă' },
  { keys: ['Enter'], what: 'Deschide fișa marcatorului ales' },
  { keys: ['?'], what: 'Deschide această listă' },
];

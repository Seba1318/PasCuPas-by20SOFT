// Logica paginilor de cont: nivelul de încredere (planul 20SOFT · Gradul de încredere) și filtrele rapoartelor.
const PROMOTE_AFTER = 5; // rapoarte confirmate de admin pentru a urca un nivel

export function trustInfo(trustLevel, confirmedCount = 0) {
  if (trustLevel >= 100) {
    return { level: 2, title: 'Încredere ridicată', text: 'Rapoartele tale ocolesc imediat traseele celorlalți. Mulțumim că ajuți!' };
  }
  const left = Math.max(0, PROMOTE_AFTER - (confirmedCount % PROMOTE_AFTER));
  if (trustLevel >= 50) {
    return {
      level: 1,
      title: 'Încredere medie',
      text: `Rapoartele tale au nevoie de o confirmare ca să ocolească traseele. Încă ${left} rapoarte confirmate până la nivelul următor.`,
    };
  }
  return {
    level: 0,
    title: 'Raportare suspendată',
    text: 'Câteva rapoarte au fost marcate ca neconforme. După suspendare, contul revine la încredere medie.',
  };
}

export const REPORT_FILTERS = [
  { id: 'toate', label: 'Toate' },
  { id: 'in_lucru', label: 'În lucru' },
  { id: 'rezolvat', label: 'Rezolvate' },
  { id: 'respins', label: 'Respinse' },
];

export const filterReports = (list, filter) => (filter === 'toate' ? list : list.filter((r) => r.status === filter));

export function sortByDate(list, dir = 'desc') {
  const sign = dir === 'asc' ? 1 : -1;
  return [...list].sort((a, b) => sign * (new Date(a.created_at) - new Date(b.created_at)));
}

// Numele afișat; până îl alege, primul cuvânt din email (ana.pop@exemplu.ro → Ana), ca pe server.
export function displayName(user) {
  if (!user) return '';
  if (user.display_name) return user.display_name;
  const local = user.email.split('@')[0];
  const first = local.split(/[._\-+\d]/)[0] || local;
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

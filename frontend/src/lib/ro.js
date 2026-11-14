// Text românesc: diacriticele corecte sunt cu virgulă dedesubt (ș ț Ș Ț).
// Datele din OSM și din formulare pot veni cu sedilă (ş ţ); le normalizăm la intrare,
// iar la căutare comparăm fără diacritice („piata” găsește „Piața”).

export const fixRo = (s) =>
  String(s ?? '')
    .replace(/ş/g, 'ș')
    .replace(/ţ/g, 'ț')
    .replace(/Ş/g, 'Ș')
    .replace(/Ţ/g, 'Ț');

export const fold = (s) =>
  fixRo(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

export function matchesQuery(text, query) {
  const q = fold(query);
  return q.length > 0 && fold(text).includes(q);
}

// Distanța rostită de vocea de navigare: „un metru”, „12 metri”, „20 de metri”, „105 metri”.
// În română, „de” apare după numerele care nu se termină în 01–19.
export function metersSpoken(meters) {
  const n = Math.max(1, Math.round(meters));
  if (n === 1) return 'un metru';
  const rest = n % 100;
  return rest >= 1 && rest <= 19 ? `${n} metri` : `${n} de metri`;
}

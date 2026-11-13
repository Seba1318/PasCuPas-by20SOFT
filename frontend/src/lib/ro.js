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

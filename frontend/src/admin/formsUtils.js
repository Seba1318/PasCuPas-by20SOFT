// Validările formularelor de administrare (X5, X6, X8) și sumarul vehiculelor (X9).

// Zona desenată: poligon închis (min. 3 puncte) sau linie pe o stradă (min. 2 puncte).
export function workGeometry(points, mode) {
  if (mode === 'polygon') return points.length >= 3 ? { type: 'Polygon', coordinates: [[...points, points[0]]] } : null;
  return points.length >= 2 ? { type: 'LineString', coordinates: points } : null;
}

function dateErrors(f) {
  const e = {};
  if (!f.start_date) e.start_date = 'Alege data de început.';
  if (f.start_date && f.end_date && f.end_date < f.start_date) e.end_date = 'Data de final e înaintea celei de început.';
  return e;
}

export function validateWork(f) {
  const e = {};
  if (!f.title?.trim()) e.title = 'Scrie un titlu pentru lucrare.';
  Object.assign(e, dateErrors(f));
  if (!f.geometry) e.geometry = 'Desenează zona pe hartă: cel puțin 3 puncte pentru o zonă sau 2 pentru o stradă.';
  return e;
}

export function validateProject(f) {
  const e = {};
  if (!f.title?.trim()) e.title = 'Scrie un titlu pentru proiect.';
  return { ...e, ...dateErrors(f) };
}

export function validateEdge(f) {
  const e = {};
  if (f.kerb_height_cm < 0 || f.kerb_height_cm > 30) e.kerb_height_cm = 'Bordura trebuie să fie între 0 și 30 cm.';
  if (f.incline_pct < 0 || f.incline_pct > 30) e.incline_pct = 'Panta trebuie să fie între 0 și 30 %.';
  return e;
}

export function vehicleSummary(list) {
  return {
    rampBroken: list.filter((v) => v.has_ramp && v.ramp_ok === false).length,
    audioBroken: list.filter((v) => v.has_audio_announce && v.audio_ok === false).length,
    openReports: list.reduce((s, v) => s + (v.open_reports ?? 0), 0),
  };
}

// Acceptă „21.10.2026” (cum scriu oamenii) sau „2026-10-21” (câmpul de dată al browserului).
export function parseRoDate(text) {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  const ro = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(text);
  const [y, m, d] = iso ? [iso[1], iso[2], iso[3]] : ro ? [ro[3], ro[2], ro[1]] : [];
  if (!y) return null;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  if (date.getUTCMonth() !== Number(m) - 1 || date.getUTCDate() !== Number(d)) return null;
  return date.toISOString().slice(0, 10);
}

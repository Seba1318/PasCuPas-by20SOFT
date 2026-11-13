// Starea fluxului de raportare (E1–E5, W14): ciorna locală, validarea detaliilor, datele trimise.
import { CATEGORIES } from './categories.js';

const KEY = 'pcp_report_draft';
export const MAX_DESCRIPTION = 500;

// Ce se păstrează în ciornă. Poza nu: un fișier nu se poate salva în localStorage,
// deci după o reîncărcare se alege din nou (ecranul spune asta).
const FIELDS = ['category', 'point', 'location_text', 'description', 'vehicle', 'equipment', 'stop'];

export function createDraftStore(storage = globalThis.localStorage) {
  return {
    save(draft) {
      const out = {};
      for (const f of FIELDS) out[f] = draft[f] ?? (f === 'description' || f === 'location_text' ? '' : null);
      try {
        storage?.setItem(KEY, JSON.stringify(out));
      } catch {
        /* fără stocare */
      }
    },
    load() {
      try {
        const text = storage?.getItem(KEY);
        return text ? JSON.parse(text) : null;
      } catch {
        return null;
      }
    },
    clear() {
      try {
        storage?.removeItem(KEY);
      } catch {
        /* nimic */
      }
    },
  };
}

export const isVehicleCategory = (id) => CATEGORIES.find((c) => c.id === id)?.needsVehicle === true;

export function reportSteps(category) {
  return isVehicleCategory(category) ? ['Categorie', 'Vehicul', 'Detalii', 'Trimite'] : ['Categorie', 'Detalii', 'Trimite'];
}

export function validateDetails(d) {
  const errors = {};
  if (!d.photo) errors.photo = 'Adaugă o poză cu problema.';
  if (!isVehicleCategory(d.category)) {
    if (!d.point) errors.location = 'Alege locul pe hartă sau folosește locația ta.';
    if (!d.location_text?.trim()) errors.location_text = 'Scrie pe scurt unde e (de exemplu „colț cu Bd. Vasile Pârvan”).';
  }
  if ((d.description?.length ?? 0) > MAX_DESCRIPTION) {
    errors.description = `Descrierea are ${d.description.length} caractere; maximul e ${MAX_DESCRIPTION}.`;
  }
  return errors;
}

// Câmpurile multipart pentru POST /reports (planul 20SOFT · Fluxul unui raport).
export function buildReportForm(fd, d) {
  fd.append('category', d.category);
  fd.append('photo', d.photo);
  if (d.point) {
    fd.append('lon', String(d.point[0]));
    fd.append('lat', String(d.point[1]));
  }
  if (d.location_text?.trim()) fd.append('location_text', d.location_text.trim());
  if (d.description?.trim()) fd.append('description', d.description.trim());
  if (d.vehicle) fd.append('vehicle_id', String(d.vehicle));
  if (d.equipment) fd.append('equipment', d.equipment);
  if (d.reporter) {
    fd.append('reporter_lon', String(d.reporter.point[0]));
    fd.append('reporter_lat', String(d.reporter.point[1]));
    fd.append('reporter_accuracy_m', String(Math.round(d.reporter.accuracy)));
  }
  return fd;
}

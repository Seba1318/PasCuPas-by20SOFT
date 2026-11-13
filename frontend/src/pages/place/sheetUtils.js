// Logica fișelor de loc (C6, W9) și de stație (C7, W8).
import { formatTime } from '../../lib/format.js';

const DOOR_MIN_CM = 80;

function yesNo(label, value, notes = {}) {
  if (value === true) return { label, value: 'Da', state: 'yes', note: notes.yes ?? '' };
  if (value === false) return { label, value: 'Nu', state: 'no', note: notes.no ?? '' };
  return { label, value: 'Nu știm', state: 'unknown', note: 'Încă nu avem informații.' };
}

// Rândurile fișei de accesibilitate, fiecare cu valoarea scrisă („Da”, „Nu”, „Nu știm”).
export function placeFeatures(a = {}, profile = {}) {
  const rows = [
    yesNo('Intrare fără trepte', a.step_free_entrance, { yes: a.entrance_note ?? 'Rampă sau intrare la nivelul trotuarului' }),
    yesNo('Lift', a.lift, { yes: a.lift_note ?? '' }),
    yesNo('Toaletă accesibilă', a.accessible_toilet, { yes: a.toilet_note ?? '' }),
  ];
  if (a.door_width_cm != null) {
    const narrow = profile.avoid_stairs && a.door_width_cm < DOOR_MIN_CM;
    rows.push({
      label: 'Lățimea ușii',
      value: `${a.door_width_cm} cm`,
      state: narrow ? 'no' : 'yes',
      note: profile.avoid_stairs
        ? narrow
          ? `Poate fi îngustă pentru un scaun cu rotile (recomandat: minim ${DOOR_MIN_CM} cm)`
          : 'Potrivită pentru scaunul tău'
        : '',
    });
  }
  return rows;
}

// Un vehicul e potrivit dacă are, funcționale, dotările cerute de profil (planul 20SOFT · Transport public).
export function arrivalSuitability(v = {}, profile = {}) {
  if (profile.avoid_stairs && !(v.has_ramp && v.ramp_ok !== false)) {
    return { ok: false, reason: v.has_ramp ? 'Fără rampă funcțională' : 'Fără rampă' };
  }
  if (profile.prefer_audio_signals && !(v.has_audio_announce && v.audio_ok !== false)) {
    return { ok: false, reason: 'Fără anunțuri sonore' };
  }
  return { ok: true, reason: '' };
}

export function etaText(iso, now = new Date()) {
  const minutes = Math.round((new Date(iso) - now) / 60000);
  if (minutes <= 0) return 'acum';
  if (minutes < 60) return `în ${minutes} min`;
  return `la ${formatTime(iso)}`;
}

export function stopFeatures(s = {}) {
  return [
    { label: s.wheelchair_boarding ? 'Acces cu scaun cu rotile' : 'Fără acces cu scaun cu rotile', ok: !!s.wheelchair_boarding },
    { label: s.has_tactile ? 'Ghidaj tactil' : 'Fără ghidaj tactil', ok: !!s.has_tactile },
    { label: s.has_display ? 'Panou de afișaj' : 'Fără panou de afișaj', ok: !!s.has_display },
  ];
}

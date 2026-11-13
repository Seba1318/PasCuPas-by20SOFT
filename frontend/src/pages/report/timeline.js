// Istoricul unui raport (E8, W13): trei pași, fiecare cu data în text.
import { formatDateTime } from '../../lib/format.js';

export function buildTimeline(r) {
  const inWork = r.timeline?.find((t) => t.status === 'in_lucru');
  const closed = r.status === 'rezolvat' || r.status === 'respins';
  return [
    { label: 'Trimis', when: formatDateTime(r.created_at), state: 'done' },
    {
      label: 'În lucru',
      when: inWork ? `${formatDateTime(inWork.at)}${inWork.by ? ` · preluat de ${inWork.by}` : ''}` : 'Se verifică',
      state: closed ? 'done' : 'current',
    },
    {
      label: r.status === 'respins' ? 'Respins' : 'Rezolvat',
      when: closed ? (r.resolved_at ? formatDateTime(r.resolved_at) : 'Închis') : 'Încă nu',
      state: closed ? 'current' : 'next',
    },
  ];
}

export function confirmationText(n) {
  if (!n) return 'Încă neconfirmat de alte persoane';
  if (n === 1) return 'Confirmat de o persoană';
  const rest = n % 100;
  return rest >= 1 && rest <= 19 ? `Confirmat de ${n} persoane` : `Confirmat de ${n} de persoane`;
}

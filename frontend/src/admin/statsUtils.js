// Calculele pentru prezentarea generală și statistici (X1; planul 20SOFT · Dashboard de admin).

const DAY = 24 * 3600 * 1000;
const NEGLECT_DAYS = 14;
const fmt = (n) => new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 1 }).format(n);

export function overviewKpis(reports, zones, now = new Date()) {
  const active = reports.filter((r) => r.status === 'in_lucru');
  const today = active.filter((r) => now - new Date(r.created_at) < DAY).length;
  const resolved = reports.filter((r) => r.status === 'rezolvat' && r.resolved_at);
  const lastWeek = resolved.filter((r) => now - new Date(r.resolved_at) < 7 * DAY).length;
  const avg = resolved.length
    ? resolved.reduce((s, r) => s + (new Date(r.resolved_at) - new Date(r.created_at)) / DAY, 0) / resolved.length
    : null;
  return [
    { id: 'active', label: 'Rapoarte active', value: String(active.length), note: `${today} noi azi` },
    { id: 'resolved', label: 'Rezolvate în ultimele 7 zile', value: String(lastWeek), note: 'Rapoarte închise ca rezolvate' },
    { id: 'avg', label: 'Timp mediu de rezolvare', value: avg == null ? '—' : `${fmt(avg)} zile`, note: 'Din trimitere până la „Rezolvat”' },
    {
      id: 'neglected',
      label: 'Zone neglijate',
      value: String(zones.filter((z) => z.last_action_days > NEGLECT_DAYS).length),
      note: `Fără intervenție de peste ${NEGLECT_DAYS} zile`,
    },
  ];
}

export function rankZones(zones) {
  const sorted = [...zones].sort((a, b) => b.open_count - a.open_count);
  const top = sorted[0]?.open_count || 1;
  return sorted.map((z, i) => ({ ...z, rank: i + 1, pct: Math.round((z.open_count / top) * 100), neglected: z.last_action_days > NEGLECT_DAYS }));
}

export const heatToLeaflet = (points) => points.map(([lon, lat, w]) => [lat, lon, w]);

export function zonesCsv(ranked) {
  const head = 'Loc;Zonă;Rapoarte active;Timp mediu de rezolvare (zile);Zile fără intervenție';
  const rows = ranked.map((z) => [z.rank, `"${z.zone.replace(/"/g, '""')}"`, z.open_count, z.avg_resolution_days ?? '', z.last_action_days].join(';'));
  return [head, ...rows].join('\n');
}


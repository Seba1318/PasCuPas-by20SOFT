import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CircleCheck, Clock, Download, MapPinned, TriangleAlert } from 'lucide-react';
import AdminPage from './AdminPage.jsx';
import AdminMap from '../AdminMap.jsx';
import HeatLayer from '../../components/map/HeatLayer.jsx';
import { admin } from '../../api/endpoints.js';
import { overviewKpis, rankZones, zonesCsv } from '../statsUtils.js';
import Button from '../../ui/Button.jsx';
import Skeleton from '../../ui/Skeleton.jsx';
import Alert from '../../ui/Alert.jsx';
import { Tag } from '../../ui/Chip.jsx';

const KPI_STYLE = {
  active: { Icon: TriangleAlert, bg: 'bg-peach' },
  resolved: { Icon: CircleCheck, bg: 'bg-mint' },
  avg: { Icon: Clock, bg: 'bg-sky' },
  neglected: { Icon: MapPinned, bg: 'bg-warning-bg' },
};

export function downloadCsv(name, text) {
  // BOM, ca Excel să citească diacriticele corect
  const url = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function useStats() {
  const [state, setState] = useState({ status: 'loading' });
  useEffect(() => {
    Promise.all([admin.reports({ status: '', limit: 200 }), admin.statsZones(), admin.statsHeatmap()])
      .then(([r, zones, heat]) => setState({ status: 'ok', reports: r.items, zones, heat }))
      .catch((e) => setState({ status: 'error', error: e.detail }));
  }, []);
  return state;
}

export function HeatLegend() {
  return (
    <div className="absolute bottom-9 left-4 z-[800] flex flex-col gap-1 rounded-field bg-surface p-3 text-caption shadow-md hc:border-2 hc:border-border">
      <span className="font-bold">Rapoarte active pe zonă</span>
      <div className="flex items-center gap-2">
        <span>puține</span>
        <span aria-hidden="true" className="heat-legend h-3 w-28 rounded-chip" />
        <span>multe</span>
      </div>
    </div>
  );
}

export function ZoneRanking({ ranked }) {
  return (
    <ol className="m-0 flex list-none flex-col p-0">
      {ranked.map((z) => (
        <li key={z.zone} className="flex items-start gap-3 border-t border-border py-3 first:border-t-0">
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-chip bg-subtle font-extrabold">{z.rank}</span>
          <div className="flex flex-1 flex-col gap-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[18px] font-bold">{z.zone}</span>
              <span className="text-[18px] font-extrabold">{z.open_count}</span>
            </div>
            <span aria-hidden="true" className="h-2.5 overflow-hidden rounded-chip bg-border">
              <span className="block h-full bg-primary" style={{ width: `${z.pct}%` }} />
            </span>
            <span className="text-caption text-ink-muted">{z.note}</span>
            {z.neglected && <Tag tone="warning" className="self-start">Fără intervenție de {z.last_action_days} zile</Tag>}
          </div>
        </li>
      ))}
    </ol>
  );
}

// X1: prezentarea generală pentru instituție.
export default function OverviewPage() {
  const s = useStats();
  if (s.status === 'loading') return <AdminPage title="Prezentare generală"><Skeleton text="Se încarcă cifrele…" /></AdminPage>;
  if (s.status === 'error') return <AdminPage title="Prezentare generală"><Alert tone="error" title="nu am putut încărca cifrele">{s.error}</Alert></AdminPage>;
  const ranked = rankZones(s.zones);
  return (
    <AdminPage
      title="Prezentare generală"
      actions={
        <Button variant="secondary" size="sm" icon={Download} onClick={() => downloadCsv('zone-pas-cu-pas.csv', zonesCsv(ranked))}>
          Exportă CSV
        </Button>
      }
    >
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {overviewKpis(s.reports, s.zones).map((k) => {
          const st = KPI_STYLE[k.id];
          return (
            <section key={k.id} aria-labelledby={`kpi-${k.id}`} className="flex flex-col gap-2 rounded-card bg-surface p-5 shadow-sm hc:border-2 hc:border-border">
              <div className="flex items-center gap-2">
                <span className={`flex h-10 w-10 items-center justify-center rounded-icon ${st.bg}`}>
                  <st.Icon aria-hidden="true" className="h-5 w-5" strokeWidth={2.5} />
                </span>
                <h2 id={`kpi-${k.id}`} className="m-0 text-[17px] font-bold">
                  {k.label}
                </h2>
              </div>
              <span className="text-[36px] font-extrabold leading-[44px]">{k.value}</span>
              <span className="text-caption text-ink-muted">{k.note}</span>
            </section>
          );
        })}
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section aria-labelledby="hm-title" className="flex min-h-[420px] flex-col gap-3 rounded-card bg-surface p-5 shadow-sm hc:border-2 hc:border-border">
          <div className="flex items-center justify-between">
            <h2 id="hm-title" className="m-0 text-title-3">
              Unde se adună problemele
            </h2>
            <Link to="/admin/harta" className="inline-flex min-h-target items-center font-bold">
              Deschide harta
            </Link>
          </div>
          <p className="sr-only">
            Hartă termică. Cele mai multe rapoarte active: {ranked.slice(0, 3).map((z) => `${z.zone} (${z.open_count})`).join(', ')}.
          </p>
          <div className="relative flex flex-1 overflow-hidden rounded-field">
            <AdminMap label="Hartă termică a problemelor" overlay={<HeatLayer points={s.heat} />}>
              <HeatLegend />
            </AdminMap>
          </div>
        </section>
        <section aria-labelledby="rk-title" className="flex flex-col gap-2 rounded-card bg-surface p-5 shadow-sm hc:border-2 hc:border-border">
          <h2 id="rk-title" className="m-0 text-title-3">
            Clasamentul zonelor
          </h2>
          <ZoneRanking ranked={ranked} />
        </section>
      </div>
    </AdminPage>
  );
}

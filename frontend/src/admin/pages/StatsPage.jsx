import { Download } from 'lucide-react';
import AdminPage from './AdminPage.jsx';
import AdminMap from '../AdminMap.jsx';
import HeatLayer from '../../components/map/HeatLayer.jsx';
import { HeatLegend, downloadCsv, useStats } from './OverviewPage.jsx';
import { rankZones, zonesCsv } from '../statsUtils.js';
import Button from '../../ui/Button.jsx';
import Skeleton from '../../ui/Skeleton.jsx';
import Alert from '../../ui/Alert.jsx';
import { Tag } from '../../ui/Chip.jsx';

const fmt = (n) => new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 1 }).format(n);

// Statistici: harta termică mare și tabelul zonelor (clasament, timp mediu de rezolvare, zone neglijate).
export default function StatsPage() {
  const s = useStats();
  if (s.status !== 'ok') {
    return (
      <AdminPage title="Statistici">
        {s.status === 'loading' ? <Skeleton text="Se încarcă statisticile…" /> : <Alert tone="error" title="nu am putut încărca statisticile">{s.error}</Alert>}
      </AdminPage>
    );
  }
  const ranked = rankZones(s.zones);
  return (
    <AdminPage
      title="Statistici"
      actions={
        <Button variant="secondary" size="sm" icon={Download} onClick={() => downloadCsv('statistici-zone.csv', zonesCsv(ranked))}>
          Exportă CSV
        </Button>
      }
    >
      <div className="relative flex h-[440px] overflow-hidden rounded-card shadow-sm">
        <AdminMap label="Hartă termică a problemelor raportate" overlay={<HeatLayer points={s.heat} />}>
          <HeatLegend />
        </AdminMap>
      </div>
      <div className="overflow-x-auto rounded-card bg-surface shadow-sm hc:border-2 hc:border-border">
        <table className="w-full border-collapse text-left text-[17px]">
          <caption className="p-3 text-left text-title-3">Zonele, după numărul de rapoarte active</caption>
          <thead>
            <tr className="border-b-2 border-border text-caption text-ink-muted">
              <th scope="col" className="p-3 font-bold">Loc</th>
              <th scope="col" className="p-3 font-bold">Zonă</th>
              <th scope="col" className="p-3 font-bold">Rapoarte active</th>
              <th scope="col" className="p-3 font-bold">Timp mediu de rezolvare</th>
              <th scope="col" className="p-3 font-bold">Ultima intervenție</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((z) => (
              <tr key={z.zone} className="border-b border-border">
                <td className="p-3 font-extrabold">{z.rank}</td>
                <th scope="row" className="p-3 text-left font-bold">
                  {z.zone}
                </th>
                <td className="p-3">{z.open_count}</td>
                {/* null = în zonă nu s-a rezolvat încă niciun raport */}
                <td className="p-3">{z.avg_resolution_days == null ? '—' : `${fmt(z.avg_resolution_days)} zile`}</td>
                <td className="p-3">
                  acum {z.last_action_days} zile {z.neglected && <Tag tone="warning" className="ml-1">Neglijată</Tag>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminPage>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Polyline } from 'react-leaflet';
import { X } from 'lucide-react';
import AdminMap from '../AdminMap.jsx';
import MarkersLayer from '../../components/map/MarkersLayer.jsx';
import WorksLayer from '../../components/map/WorksLayer.jsx';
import { lineToLatLngs } from '../../components/map/geo.js';
import { ROUTE_COLORS } from '../../theme/mapColors.js';
import { admin } from '../../api/endpoints.js';
import { CATEGORIES, categoryLabel } from '../../reports/categories.js';
import { scoreLevel } from '../adminUtils.js';
import { confirmationText } from '../../pages/report/timeline.js';
import { formatDate } from '../../lib/format.js';
import { Select } from './AdminPage.jsx';
import Chip, { Tag } from '../../ui/Chip.jsx';
import Button from '../../ui/Button.jsx';
import StatusBadge from '../../ui/StatusBadge.jsx';
import Alert from '../../ui/Alert.jsx';
import { useToast } from '../../ui/Toast.jsx';

const SOURCES = [
  ['raport', 'Raport'],
  ['lucrare', 'Lucrare'],
  ['admin', 'Admin'],
];

// X4: harta de administrare: rapoarte grupate, lucrări, tronsoane blocate.
export default function AdminMapPage() {
  const navigate = useNavigate();
  const { show } = useToast();
  const [data, setData] = useState(null);
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('active');
  const [sources, setSources] = useState(new Set(SOURCES.map(([id]) => id)));
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState(null);

  const load = () =>
    Promise.all([admin.reports({ status: status === 'toate' ? '' : status, category, limit: 200 }), admin.works(), admin.edges()])
      .then(([r, w, e]) => setData({ reports: r.items, works: w.features, edges: e.features }))
      .catch((err) => setError(err.detail));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, status]);

  const overlay = useMemo(() => {
    if (!data) return null;
    const items = data.reports.map((r) => ({
      id: r.id,
      type: 'problem',
      point: r.geometry.coordinates,
      label: `${categoryLabel(r.category)}, ${r.public_code}${selected?.id === r.id ? ', selectat' : ''}`,
    }));
    const blockedEdges = sources.has('admin') ? data.edges.filter((e) => e.properties.blocked) : [];
    return (
      <>
        {sources.has('lucrare') && <WorksLayer works={data.works.filter((w) => w.properties.blocks_route)} />}
        {blockedEdges.map((e) => (
          <Polyline
            key={e.id}
            positions={lineToLatLngs(e.geometry.coordinates)}
            pathOptions={{ color: ROUTE_COLORS.light.blocked, weight: 7, dashArray: '2 10', lineCap: 'round' }}
            eventHandlers={{ click: () => navigate(`/admin/strazi?id=${e.id}`) }}
          />
        ))}
        {sources.has('raport') && (
          <MarkersLayer items={items} selectedId={selected?.id} onSelect={(it) => setSelected(data.reports.find((r) => r.id === it.id))} />
        )}
      </>
    );
  }, [data, sources, selected, navigate]);

  const resolve = async () => {
    try {
      await admin.patchReport(selected.id, { status: 'rezolvat' });
      show({ tone: 'success', title: 'Marcat rezolvat', message: `${selected.public_code}: blocajul dispare, autorul primește un email.` });
      setSelected(null);
      load();
    } catch (err) {
      setError(err.detail);
    }
  };

  return (
    <div className="flex min-h-0 flex-1">
      <AdminMap label="Harta de administrare: rapoarte active grupate, lucrări, segmente blocate" overlay={overlay}>
        <div role="group" aria-label="Filtre hartă" className="absolute left-4 right-4 top-4 z-[800] flex flex-wrap items-end gap-3 rounded-card bg-surface p-3 shadow-lg hc:border-2 hc:border-border">
          <Select id="m-cat" label="Categorie" value={category} onChange={setCategory} options={[['', 'Toate'], ...CATEGORIES.map((c) => [c.id, c.label])]} />
          <Select id="m-status" label="Status" value={status} onChange={setStatus} options={[['active', 'Active'], ['toate', 'Toate']]} />
          <div className="flex flex-col gap-1">
            <span className="text-label">Arată blocajele din:</span>
            <div className="flex gap-2">
              {SOURCES.map(([id, label]) => (
                <Chip
                  key={id}
                  pressed={sources.has(id)}
                  onToggle={() =>
                    setSources((s) => {
                      const n = new Set(s);
                      if (n.has(id)) n.delete(id);
                      else n.add(id);
                      return n;
                    })
                  }
                >
                  {label}
                </Chip>
              ))}
            </div>
          </div>
        </div>
        <span className="absolute bottom-9 left-4 z-[800] rounded-field bg-surface px-3 py-2 text-[16px] font-semibold shadow-md">
          Clic pe un raport pentru detalii · clic pe o stradă blocată ca s-o editezi
        </span>
      </AdminMap>
      {selected && (
        <aside aria-labelledby="am-title" className="flex w-[380px] flex-none flex-col gap-3 overflow-y-auto border-l border-border bg-surface p-5 hc:border-l-[3px]">
          <div className="flex items-center justify-between gap-2">
            <h2 id="am-title" className="m-0 font-mono text-[22px] font-bold">
              {selected.public_code}
            </h2>
            <button type="button" onClick={() => setSelected(null)} className="flex h-12 items-center gap-1.5 rounded-[14px] border-2 border-border-strong px-3 font-bold hover:bg-subtle">
              <X aria-hidden="true" className="h-5 w-5" /> Închide
            </button>
          </div>
          {error && <Alert tone="error" title="nu a mers">{error}</Alert>}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[18px] font-bold">{categoryLabel(selected.category)}</span>
            <StatusBadge status={selected.status} />
          </div>
          <span className="text-caption text-ink-muted">
            {selected.location_text} · {formatDate(selected.created_at)}
          </span>
          {selected.possibly_resolved && (
            <p className="m-0 rounded-field bg-info-bg p-3 text-[17px]">
              <b>Posibil rezolvat:</b> 3 persoane au spus că problema a fost reparată.
            </p>
          )}
          <p className="m-0 text-[17px]">
            <b>Scor {selected.score.total}</b> · {scoreLevel(selected.score.total).label}
          </p>
          <span className="text-[17px]">{confirmationText(selected.confirmations)}</span>
          {selected.status === 'in_lucru' && <Button onClick={resolve}>Marchează rezolvat</Button>}
          <Link to={`/admin/rapoarte?q=${selected.public_code}`} className="inline-flex min-h-target items-center font-bold">
            Deschide în lista de rapoarte
          </Link>
          <Tag tone="neutral" className="self-start">Detaliile complete și respingerea sunt în lista de rapoarte</Tag>
        </aside>
      )}
    </div>
  );
}

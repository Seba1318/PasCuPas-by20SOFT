import { useEffect, useMemo, useState } from 'react';
import { CircleMarker, Polygon, Polyline } from 'react-leaflet';
import { Pencil, Trash2, Undo2, Spline, Hexagon } from 'lucide-react';
import AdminMap from '../AdminMap.jsx';
import WorksLayer from '../../components/map/WorksLayer.jsx';
import { lineToLatLngs, toLatLng } from '../../components/map/geo.js';
import { ROUTE_COLORS } from '../../theme/mapColors.js';
import { admin } from '../../api/endpoints.js';
import { validateWork, workGeometry, workToForm } from '../formsUtils.js';
import { formatDate } from '../../lib/format.js';
import Field from '../../ui/Field.jsx';
import Switch from '../../ui/Switch.jsx';
import Button from '../../ui/Button.jsx';
import Dialog from '../../ui/Dialog.jsx';
import Alert from '../../ui/Alert.jsx';
import { Tag } from '../../ui/Chip.jsx';
import { useToast } from '../../ui/Toast.jsx';

const EMPTY = { title: '', description: '', start_date: '', end_date: '', blocks_route: true };
const DRAW = ROUTE_COLORS.light.route;

// X5: lucrările planificate, cu zona desenată pe hartă.
export default function WorksPage() {
  const { show } = useToast();
  const [works, setWorks] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [mode, setMode] = useState('polygon');
  const [points, setPoints] = useState([]);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [editing, setEditing] = useState(null); // lucrarea modificată acum sau null pentru una nouă
  const [error, setError] = useState(null);

  const load = () => admin.works().then((c) => setWorks(c.features)).catch((e) => setError(e.detail));
  useEffect(() => {
    load();
  }, []);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const geometry = workGeometry(points, mode);

  const reset = () => {
    setEditing(null);
    setForm(EMPTY);
    setPoints([]);
    setErrors({});
  };

  const startEdit = (w) => {
    const opened = workToForm(w);
    setEditing(w);
    setForm(opened.form);
    setMode(opened.mode);
    setPoints(opened.points);
    setErrors({});
    document.getElementById('w-title')?.focus();
  };

  const save = async () => {
    const found = validateWork({ ...form, geometry });
    setErrors(found);
    if (Object.keys(found).length) {
      const first = ['title', 'start_date', 'end_date'].find((k) => found[k]);
      if (first) document.getElementById(`w-${first}`)?.focus();
      return;
    }
    setBusy(true);
    try {
      if (editing) await admin.patchWork(editing.id, { ...form, geometry });
      else await admin.createWork({ ...form, geometry });
      show({
        tone: 'success',
        title: editing ? 'Lucrare modificată' : 'Lucrare salvată',
        message: form.blocks_route ? 'Traseele ocolesc zona în perioada aleasă.' : 'Apare pe hartă ca avertizare.',
      });
      reset();
      load();
    } catch (e) {
      setError(e.detail);
    } finally {
      setBusy(false);
    }
  };

  const overlay = useMemo(
    () => (
      <>
        <WorksLayer works={works} />
        {points.length > 0 &&
          (mode === 'polygon' && points.length >= 3 ? (
            <Polygon positions={lineToLatLngs(points)} pathOptions={{ color: DRAW, weight: 3, dashArray: '6 4', fillOpacity: 0.15 }} />
          ) : (
            <Polyline positions={lineToLatLngs(points)} pathOptions={{ color: DRAW, weight: 4 }} />
          ))}
        {points.map((p, i) => (
          <CircleMarker key={i} center={toLatLng(p)} radius={7} pathOptions={{ color: DRAW, fillColor: ROUTE_COLORS.light.casing, fillOpacity: 1, weight: 3 }} />
        ))}
      </>
    ),
    [works, points, mode],
  );

  return (
    <div className="flex min-h-0 flex-1">
      <AdminMap label="Hartă pentru desenarea zonei de lucrări" onMapClick={(p) => setPoints((ps) => [...ps, p])} overlay={overlay}>
        <div role="toolbar" aria-label="Unelte de desenare" className="absolute left-4 top-4 z-[800] flex flex-wrap gap-2 rounded-card bg-surface p-2 shadow-lg">
          {[
            ['line', 'Linie', Spline],
            ['polygon', 'Poligon', Hexagon],
          ].map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              aria-pressed={mode === id}
              onClick={() => setMode(id)}
              className={`flex h-12 items-center gap-1.5 rounded-[14px] border-2 px-3 text-[17px] font-bold ${mode === id ? 'border-ink bg-peach' : 'border-border-strong'}`}
            >
              <Icon aria-hidden="true" className="h-5 w-5" strokeWidth={2.5} />
              {label}
            </button>
          ))}
          <button type="button" disabled={!points.length} onClick={() => setPoints((ps) => ps.slice(0, -1))} className="flex h-12 items-center gap-1.5 rounded-[14px] border-2 border-border-strong px-3 text-[17px] font-bold disabled:opacity-50">
            <Undo2 aria-hidden="true" className="h-5 w-5" strokeWidth={2.5} />
            Anulează ultimul punct
          </button>
          <button type="button" disabled={!points.length} onClick={() => setPoints([])} className="flex h-12 items-center gap-1.5 rounded-[14px] border-2 border-border-strong px-3 text-[17px] font-bold disabled:opacity-50">
            Șterge desenul
          </button>
        </div>
        <span className="absolute bottom-9 left-4 z-[800] rounded-field bg-surface px-3 py-2 text-[16px] font-semibold shadow-md">
          Clic pe hartă pentru fiecare punct al zonei
        </span>
      </AdminMap>
      <aside aria-labelledby="works-title" className="flex w-[400px] flex-none flex-col gap-4 overflow-y-auto border-l border-border bg-surface p-5 hc:border-l-[3px]">
        <div className="flex items-baseline gap-2">
          <h1 id="works-title" className="m-0 text-title-3">
            Lucrări planificate
          </h1>
          <span className="text-ink-muted">{works.length} active</span>
        </div>
        {error && (
          <Alert tone="error" title="ceva n-a mers">
            {error}
          </Alert>
        )}
        <ul className="m-0 flex list-none flex-col p-0">
          {works.map((w) => (
            <li key={w.id} className="flex items-center gap-2 border-t border-border py-2">
              <span className="flex flex-1 flex-col">
                <span className="font-bold">{w.properties.title}</span>
                <span className="text-caption text-ink-muted">
                  {formatDate(w.properties.start_date)} – {formatDate(w.properties.end_date)}
                </span>
                <Tag tone={w.properties.blocks_route ? 'warning' : 'neutral'} className="mt-1 self-start">
                  {w.properties.blocks_route ? 'Blochează traseele' : 'Doar avertizare'}
                </Tag>
              </span>
              <button
                type="button"
                aria-pressed={editing?.id === w.id}
                aria-label={`Modifică lucrarea ${w.properties.title}`}
                onClick={() => startEdit(w)}
                className="flex h-12 items-center gap-1 rounded-icon px-2 font-bold hover:bg-subtle"
              >
                <Pencil aria-hidden="true" className="h-5 w-5" />
                Modifică
              </button>
              <button type="button" onClick={() => setToDelete(w)} className="flex h-12 items-center gap-1 rounded-icon px-2 font-bold text-error hover:bg-error-bg">
                <Trash2 aria-hidden="true" className="h-5 w-5" />
                Șterge
              </button>
            </li>
          ))}
        </ul>
        <h2 className="m-0 border-t-2 border-border pt-4 text-[20px] font-bold">
          {editing ? `Modifici: ${editing.properties.title}` : 'Lucrare nouă'}
        </h2>
        <Field id="w-title" label="Titlu" value={form.title} onChange={(e) => set({ title: e.target.value })} error={errors.title} />
        <Field id="w-description" label="Descriere" optional multiline value={form.description} onChange={(e) => set({ description: e.target.value })} />
        <div className="grid grid-cols-2 gap-3">
          <Field id="w-start_date" label="De la" type="date" value={form.start_date} onChange={(e) => set({ start_date: e.target.value })} error={errors.start_date} />
          <Field id="w-end_date" label="Până la" type="date" value={form.end_date} onChange={(e) => set({ end_date: e.target.value })} error={errors.end_date} />
        </div>
        <Switch id="w-blocks" label="Blochează traseul" hint="Traseele ocolesc zona desenată" checked={form.blocks_route} onChange={(v) => set({ blocks_route: v })} />
        <p role="status" className={`m-0 rounded-field p-3 text-[17px] ${errors.geometry && !geometry ? 'border-2 border-error bg-error-bg' : 'bg-subtle'}`}>
          <b>Zonă pe hartă:</b>{' '}
          {geometry ? `${mode === 'polygon' ? 'poligon' : 'linie'} cu ${points.length} puncte.` : errors.geometry ?? `${points.length} puncte; mai adaugă.`}
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={reset}>
            Renunță
          </Button>
          <Button loading={busy} loadingText="Se salvează…" onClick={save} className="flex-1">
            {editing ? 'Salvează modificările' : 'Salvează lucrarea'}
          </Button>
        </div>
      </aside>
      <Dialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title="Ștergi lucrarea?"
        actions={
          <>
            <Button variant="secondary" onClick={() => setToDelete(null)}>
              Renunță
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                await admin.deleteWork(toDelete.id).catch((e) => setError(e.detail));
                if (editing?.id === toDelete.id) reset();
                setToDelete(null);
                load();
              }}
            >
              Șterge lucrarea
            </Button>
          </>
        }
      >
        „{toDelete?.properties.title}” dispare de pe hartă, iar traseele nu o mai ocolesc.
      </Dialog>
    </div>
  );
}


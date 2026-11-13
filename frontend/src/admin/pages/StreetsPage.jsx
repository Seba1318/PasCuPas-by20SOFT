import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Polyline } from 'react-leaflet';
import { TriangleAlert, X } from 'lucide-react';
import AdminMap from '../AdminMap.jsx';
import { lineToLatLngs } from '../../components/map/geo.js';
import { ROUTE_COLORS, ZONE_COLOR } from '../../theme/mapColors.js';
import { admin } from '../../api/endpoints.js';
import { validateEdge } from '../formsUtils.js';
import { Select } from './AdminPage.jsx';
import Field from '../../ui/Field.jsx';
import Button from '../../ui/Button.jsx';
import Dialog from '../../ui/Dialog.jsx';
import Alert from '../../ui/Alert.jsx';
import { useToast } from '../../ui/Toast.jsx';

const C = ROUTE_COLORS.light;

function YesNo({ id, label, value, onChange, yes = 'Da', no = 'Nu' }) {
  return (
    <fieldset className="m-0 flex flex-col gap-1 border-0 p-0">
      <legend className="mb-1 text-label">{label}</legend>
      <div className="grid grid-cols-2 gap-1.5">
        {[
          [false, no],
          [true, yes],
        ].map(([v, l]) => (
          <label
            key={l}
            className={`flex min-h-12 cursor-pointer items-center justify-center rounded-icon border-2 text-[17px] font-bold has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-focus ${
              value === v ? 'border-ink bg-peach' : 'border-border-strong'
            }`}
          >
            <input type="radio" name={id} className="sr-only" checked={value === v} onChange={() => onChange(v)} />
            {l}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

// X8: atributele unui tronson din graf; „Marchează inaccesibilă” blochează segmentul pentru toți.
export default function StreetsPage() {
  const { show } = useToast();
  const [edges, setEdges] = useState([]);
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [error, setError] = useState(null);

  const [params] = useSearchParams();
  const load = () => admin.edges().then((c) => {
    setEdges(c.features);
    return c.features;
  }).catch((e) => setError(e.detail));
  useEffect(() => {
    // ?id=… vine de pe harta de administrare (X4): deschidem direct tronsonul.
    load().then((list) => {
      const pre = list?.find((e) => String(e.id) === params.get('id'));
      if (pre) setForm({ ...pre.properties });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pick = (e) => {
    setForm({ ...e.properties });
    setErrors({});
  };
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const save = async (extra = {}) => {
    const body = { ...form, kerb_height_cm: Number(form.kerb_height_cm), incline_pct: Number(form.incline_pct), ...extra };
    const found = validateEdge(body);
    setErrors(found);
    if (Object.keys(found).length) {
      document.getElementById(`e-${Object.keys(found)[0]}`)?.focus();
      return;
    }
    setBusy(true);
    try {
      await admin.patchEdge(form.id, body);
      show({ tone: 'success', title: 'Tronson salvat', message: extra.blocked ? 'Traseele îl ocolesc de acum.' : 'Rutarea folosește noile valori.' });
      setForm(body);
      load();
    } catch (e) {
      setError(e.detail);
    } finally {
      setBusy(false);
    }
  };

  const overlay = useMemo(
    () =>
      edges.map((e) => {
        const sel = form?.id === e.id;
        const blocked = e.properties.blocked || e.properties.has_stairs;
        return (
          <Polyline
            key={`${e.id}-${sel}-${blocked}`}
            positions={lineToLatLngs(e.geometry.coordinates)}
            pathOptions={{ color: sel ? C.route : blocked ? C.blocked : ZONE_COLOR, weight: sel ? 10 : 7, dashArray: blocked ? '2 10' : undefined, lineCap: 'round' }}
            eventHandlers={{ click: () => pick(e) }}
          />
        );
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [edges, form?.id],
  );

  return (
    <div className="flex min-h-0 flex-1">
      <aside aria-labelledby="st-title" className="flex w-[320px] flex-none flex-col gap-3 overflow-y-auto border-r border-border bg-surface p-5 hc:border-r-[3px]">
        <h1 id="st-title" className="m-0 text-title-3">
          Străzi
        </h1>
        <p className="m-0 text-[17px] text-ink-muted">Alege un tronson din listă sau cu clic pe hartă.</p>
        <ul className="m-0 list-none p-0">
          {edges.map((e) => (
            <li key={e.id} className="border-t border-border">
              <button type="button" onClick={() => pick(e)} className={`flex min-h-14 w-full flex-col items-start justify-center py-2 text-left hover:bg-subtle ${form?.id === e.id ? 'bg-info-bg' : ''}`}>
                <span className="font-bold">{e.properties.name}</span>
                <span className="text-caption text-ink-muted">
                  {e.properties.length_m} m{e.properties.has_stairs ? ' · are trepte' : ''}
                  {e.properties.blocked ? ' · marcat inaccesibil' : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <AdminMap label="Hartă cu tronsoanele străzilor" overlay={overlay} />
      {form && (
        <aside aria-labelledby="st-form" className="flex w-[380px] flex-none flex-col gap-3 overflow-y-auto border-l border-border bg-surface p-5 hc:border-l-[3px]">
          <div className="flex items-center justify-between gap-2">
            <h2 id="st-form" className="m-0 text-title-3">
              Editează strada
            </h2>
            <button type="button" onClick={() => setForm(null)} className="flex h-12 items-center gap-1.5 rounded-[14px] border-2 border-border-strong px-3 font-bold hover:bg-subtle">
              <X aria-hidden="true" className="h-5 w-5" /> Închide
            </button>
          </div>
          <div className="rounded-field bg-subtle p-3">
            <div className="font-bold">{form.name}</div>
            <div className="text-caption text-ink-muted">{form.length_m} m</div>
          </div>
          {error && (
            <Alert tone="error" title="nu am putut salva">
              {error}
            </Alert>
          )}
          <YesNo id="e-stairs" label="Trepte" value={form.has_stairs} onChange={(v) => set({ has_stairs: v })} yes="Are trepte" no="Nu are" />
          <div className="grid grid-cols-2 gap-3">
            <Field id="e-kerb_height_cm" label="Bordură, cm" inputMode="decimal" value={form.kerb_height_cm} onChange={(e) => set({ kerb_height_cm: e.target.value })} error={errors.kerb_height_cm} />
            <Field id="e-incline_pct" label="Pantă maximă, %" inputMode="decimal" value={form.incline_pct} onChange={(e) => set({ incline_pct: e.target.value })} error={errors.incline_pct} />
          </div>
          <Select id="e-surface" label="Suprafață" value={form.surface} onChange={(v) => set({ surface: v })} options={[['asfalt', 'Asfalt'], ['pavele', 'Pavele'], ['pietris', 'Pietriș']]} />
          <YesNo id="e-tactile" label="Ghidaj tactil" value={form.has_tactile} onChange={(v) => set({ has_tactile: v })} />
          <YesNo id="e-audio" label="Semafor sonor la trecere" value={form.has_audio_signal} onChange={(v) => set({ has_audio_signal: v })} />
          <YesNo id="e-lit" label="Iluminat" value={form.is_lit} onChange={(v) => set({ is_lit: v })} />
          {Number(form.kerb_height_cm) > 3 && (
            <p className="m-0 flex items-start gap-2 rounded-field bg-warning-bg p-3 text-[17px]">
              <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 flex-none text-warning" />
              <span>
                <b>Atenție:</b> cu bordura de {form.kerb_height_cm} cm, tronsonul e ocolit pentru toți cei care au setat o bordură maximă mai mică.
              </span>
            </p>
          )}
          <Button loading={busy} loadingText="Se salvează…" onClick={() => save()}>
            Salvează modificările
          </Button>
          {form.blocked ? (
            <Button variant="secondary" onClick={() => save({ blocked: false })}>
              Deblochează tronsonul
            </Button>
          ) : (
            <Button variant="danger" onClick={() => setConfirmBlock(true)}>
              Marchează inaccesibilă
            </Button>
          )}
        </aside>
      )}
      <Dialog
        open={confirmBlock}
        onClose={() => setConfirmBlock(false)}
        title="Marchezi strada ca inaccesibilă?"
        actions={
          <>
            <Button variant="secondary" onClick={() => setConfirmBlock(false)}>
              Renunță
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setConfirmBlock(false);
                save({ blocked: true });
              }}
            >
              Marchează inaccesibilă
            </Button>
          </>
        }
      >
        Toate traseele vor ocoli „{form?.name}” până când o deblochezi. Acțiunea se jurnalizează cu numele tău.
      </Dialog>
    </div>
  );
}

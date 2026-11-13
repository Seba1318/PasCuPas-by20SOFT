import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import AdminMap from '../AdminMap.jsx';
import MarkersLayer from '../../components/map/MarkersLayer.jsx';
import { markerTypeFor } from '../../components/map/markerSvg.js';
import { places as placesApi, admin } from '../../api/endpoints.js';
import { DEMO_BBOX } from '../../config/env.js';
import { matchesQuery } from '../../lib/ro.js';
import { Select } from './AdminPage.jsx';
import Field from '../../ui/Field.jsx';
import Button from '../../ui/Button.jsx';
import Dialog from '../../ui/Dialog.jsx';
import Alert from '../../ui/Alert.jsx';
import { Tag } from '../../ui/Chip.jsx';
import { useToast } from '../../ui/Toast.jsx';

const AMENITY = [
  ['ramp', 'Rampă'], ['lift', 'Lift'], ['entrance', 'Intrare accesibilă'], ['toilet', 'Toaletă accesibilă'],
  ['parking', 'Parcare pentru persoane cu dizabilități'], ['tactile', 'Ghidaj tactil'], ['audio_signal', 'Semafor sonor'], ['bench', 'Bancă'],
];
const SHEET = [
  ['step_free_entrance', 'Intrare fără trepte'],
  ['lift', 'Lift'],
  ['accessible_toilet', 'Toaletă accesibilă'],
];
const EMPTY = { name: '', category: 'building', point: null, attributes: { address: '', step_free_entrance: null, lift: null, accessible_toilet: null, door_width_cm: '' } };

const triValue = (v) => (v === true ? 'da' : v === false ? 'nu' : 'nu_stiu');
const fromTri = (v) => (v === 'da' ? true : v === 'nu' ? false : null);

function sheetState(p) {
  const a = p.properties.attributes ?? {};
  const known = SHEET.filter(([k]) => a[k] != null).length;
  return known === SHEET.length ? { tone: 'success', text: 'Fișă completă' } : { tone: 'warning', text: 'De verificat' };
}

// X7: dotări (rampe, lifturi…) și locații cu fișă de accesibilitate.
export default function PlacesPage() {
  const { show } = useToast();
  const [all, setAll] = useState([]);
  const [tab, setTab] = useState('locatii');
  const [filter, setFilter] = useState('');
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [error, setError] = useState(null);

  const load = () =>
    placesApi
      .list({ bbox: DEMO_BBOX.join(',') })
      .then((c) => setAll(c.features))
      .catch((e) => setError(e.detail));
  useEffect(() => {
    load();
  }, []);

  const list = all.filter((p) => (tab === 'locatii' ? p.properties.category === 'building' : p.properties.category !== 'building'));
  const shown = list.filter((p) => !filter || matchesQuery(`${p.properties.name} ${p.properties.attributes?.address ?? ''}`, filter));

  const openNew = () => {
    setForm({ ...EMPTY, category: tab === 'locatii' ? 'building' : 'ramp', attributes: { ...EMPTY.attributes } });
    setErrors({});
  };
  const openEdit = (p) => {
    setForm({ id: p.id, name: p.properties.name, category: p.properties.category, point: p.geometry.coordinates, attributes: { ...EMPTY.attributes, ...p.properties.attributes } });
    setErrors({});
  };
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setAttr = (patch) => setForm((f) => ({ ...f, attributes: { ...f.attributes, ...patch } }));

  const save = async () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Scrie numele.';
    if (!form.point) e.point = 'Alege punctul cu un clic pe hartă.';
    setErrors(e);
    if (e.name) {
      document.getElementById('pl-name')?.focus();
      return;
    }
    if (e.point) return;
    setBusy(true);
    const attributes = { ...form.attributes, door_width_cm: form.attributes.door_width_cm === '' ? null : Number(form.attributes.door_width_cm) };
    const body = { name: form.name.trim(), category: form.category, geometry: { type: 'Point', coordinates: form.point }, attributes };
    try {
      if (form.id) await admin.patchPlace(form.id, body);
      else await admin.createPlace(body);
      show({ tone: 'success', title: 'Salvat', message: `${body.name} apare pe hartă.` });
      setForm(null);
      load();
    } catch (err) {
      setError(err.detail);
    } finally {
      setBusy(false);
    }
  };

  const items = useMemo(() => {
    const base = list.map((p) => ({
      id: p.id,
      type: markerTypeFor(p.properties.category),
      point: p.geometry.coordinates,
      label: p.properties.name,
    }));
    if (form?.point && !form.id) base.push({ id: 'new', type: 'dest', point: form.point, label: 'Locul nou, ales cu clic' });
    return base;
  }, [list, form]);
  const overlay = useMemo(
    () => <MarkersLayer items={items} cluster={false} selectedId={form?.id ?? 'new'} onSelect={(it) => it.id !== 'new' && openEdit(all.find((p) => p.id === it.id))} />,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, form?.id, all],
  );

  return (
    <div className="flex min-h-0 flex-1">
      <aside aria-labelledby="pl-title" className="flex w-[360px] flex-none flex-col gap-3 overflow-y-auto border-r border-border bg-surface p-5 hc:border-r-[3px]">
        <div className="flex items-center justify-between">
          <h1 id="pl-title" className="m-0 text-title-3">
            Dotări și locații
          </h1>
          <Link to="/admin/strazi" className="inline-flex min-h-target items-center font-bold">
            Străzi
          </Link>
        </div>
        <div role="tablist" aria-label="Tip" className="grid grid-cols-2 gap-1 rounded-field border-2 border-border-strong p-1">
          {[
            ['dotari', `Dotări · ${all.filter((p) => p.properties.category !== 'building').length}`],
            ['locatii', `Locații · ${all.filter((p) => p.properties.category === 'building').length}`],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => { setTab(id); setForm(null); }}
              className={`h-11 rounded-icon text-[17px] font-bold ${tab === id ? 'bg-ink text-surface' : 'hover:bg-subtle'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <Field id="pl-filter" label="Filtrează" placeholder="nume sau adresă" value={filter} onChange={(e) => setFilter(e.target.value)} />
        <ul className="m-0 list-none p-0">
          {shown.map((p) => {
            const st = sheetState(p);
            return (
              <li key={p.id} className="border-t border-border">
                <button type="button" onClick={() => openEdit(p)} className={`flex min-h-16 w-full flex-col items-start gap-0.5 py-2 text-left hover:bg-subtle ${form?.id === p.id ? 'bg-info-bg' : ''}`}>
                  <span className="font-bold">{p.properties.name}</span>
                  {p.properties.attributes?.address && <span className="text-caption text-ink-muted">{p.properties.attributes.address}</span>}
                  {tab === 'locatii' && <Tag tone={st.tone}>{st.text}</Tag>}
                </button>
              </li>
            );
          })}
        </ul>
        <Button variant="secondary" icon={Plus} onClick={openNew}>
          {tab === 'locatii' ? 'Adaugă o locație' : 'Adaugă o dotare'}
        </Button>
      </aside>
      <AdminMap label="Hartă cu dotări și locații" onMapClick={form ? (pt) => set({ point: pt }) : undefined} overlay={overlay}>
        {form && (
          <span role="status" className="absolute left-4 top-4 z-[800] rounded-field bg-surface px-3 py-2 text-[16px] font-semibold shadow-md">
            {form.point ? 'Punct ales. Clic din nou ca să-l muți.' : 'Fă clic pe hartă ca să alegi punctul.'}
          </span>
        )}
      </AdminMap>
      {form && (
        <aside aria-labelledby="pl-form" className="flex w-[380px] flex-none flex-col gap-3 overflow-y-auto border-l border-border bg-surface p-5 hc:border-l-[3px]">
          <h2 id="pl-form" className="m-0 text-title-3">
            {form.id ? 'Editează' : tab === 'locatii' ? 'Locație nouă' : 'Dotare nouă'}
          </h2>
          {error && (
            <Alert tone="error" title="nu am putut salva">
              {error}
            </Alert>
          )}
          <Field id="pl-name" label="Nume" value={form.name} onChange={(e) => set({ name: e.target.value })} error={errors.name} />
          {form.category !== 'building' && (
            <Select id="pl-cat" label="Categorie" value={form.category} onChange={(v) => set({ category: v })} options={AMENITY} />
          )}
          <Field id="pl-addr" label="Adresă" optional value={form.attributes.address ?? ''} onChange={(e) => setAttr({ address: e.target.value })} />
          <p className={`m-0 rounded-field p-2.5 text-[17px] ${errors.point && !form.point ? 'border-2 border-error bg-error-bg font-semibold' : 'bg-subtle'}`}>
            Punct pe hartă: {form.point ? '✓ ales cu clic' : errors.point ?? 'încă nu'}
          </p>
          {form.category === 'building' && (
            <>
              <h3 className="m-0 text-[18px] font-bold">Fișa de accesibilitate</h3>
              {SHEET.map(([key, label]) => (
                <fieldset key={key} className="m-0 flex flex-col gap-1 border-0 p-0">
                  <legend className="mb-1 text-label">{label}</legend>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      ['da', 'Da'],
                      ['nu', 'Nu'],
                      ['nu_stiu', 'Nu știu'],
                    ].map(([v, l]) => (
                      <label
                        key={v}
                        className={`flex min-h-12 cursor-pointer items-center justify-center rounded-icon border-2 text-[17px] font-bold has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-focus ${
                          triValue(form.attributes[key]) === v ? 'border-ink bg-peach' : 'border-border-strong'
                        }`}
                      >
                        <input type="radio" name={key} className="sr-only" checked={triValue(form.attributes[key]) === v} onChange={() => setAttr({ [key]: fromTri(v) })} />
                        {l}
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
              <Field
                id="pl-door"
                label="Lățimea ușii, în cm"
                optional
                inputMode="numeric"
                value={form.attributes.door_width_cm ?? ''}
                onChange={(e) => setAttr({ door_width_cm: e.target.value.replace(/\D/g, '') })}
              />
            </>
          )}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setForm(null)}>
              Renunță
            </Button>
            <Button loading={busy} loadingText="Se salvează…" onClick={save} className="flex-1">
              Salvează
            </Button>
          </div>
          {form.id && (
            <Button variant="text" icon={Trash2} onClick={() => setToDelete(form)}>
              Șterge
            </Button>
          )}
        </aside>
      )}
      <Dialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title="Ștergi punctul?"
        actions={
          <>
            <Button variant="secondary" onClick={() => setToDelete(null)}>
              Renunță
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                await admin.deletePlace(toDelete.id).catch((e) => setError(e.detail));
                setToDelete(null);
                setForm(null);
                load();
              }}
            >
              Șterge
            </Button>
          </>
        }
      >
        „{toDelete?.name}” dispare de pe hartă pentru toți utilizatorii.
      </Dialog>
    </div>
  );
}

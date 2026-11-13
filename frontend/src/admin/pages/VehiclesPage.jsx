import { useEffect, useMemo, useState } from 'react';
import { Check, X } from 'lucide-react';
import AdminPage, { Select } from './AdminPage.jsx';
import { admin } from '../../api/endpoints.js';
import { vehicleSummary } from '../formsUtils.js';
import Alert from '../../ui/Alert.jsx';
import Skeleton from '../../ui/Skeleton.jsx';

// Comutator compact pentru tabel: aceeași formă ca Switch, cu eticheta în aria-label și starea scrisă lângă.
function CellSwitch({ label, on, onChange, disabled }) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!on)}
        className="flex h-12 w-16 flex-none items-center justify-center rounded-chip disabled:opacity-50"
      >
        <span className={`flex h-[34px] w-[60px] items-center rounded-chip border-2 px-[3px] ${on ? 'justify-end border-success bg-success' : 'justify-start border-border-strong bg-surface'}`}>
          <span className={`flex h-[26px] w-[26px] items-center justify-center rounded-chip ${on ? 'bg-surface text-success' : 'bg-border-strong text-surface'}`}>
            {on ? <Check aria-hidden="true" className="h-4 w-4" strokeWidth={3.5} /> : <X aria-hidden="true" className="h-4 w-4" strokeWidth={3.5} />}
          </span>
        </span>
      </button>
      <span className={`text-[16px] font-bold ${on ? 'text-success' : 'text-error'}`}>{on ? 'Funcțional' : 'Defect'}</span>
    </div>
  );
}

// X9: dotările vehiculelor, pentru operatorul de transport.
export default function VehiclesPage() {
  const [list, setList] = useState(null);
  const [line, setLine] = useState('');
  const [onlyBroken, setOnlyBroken] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    admin.vehicles().then(setList).catch((e) => setError(e.detail));
  }, []);

  const toggle = async (v, key, value) => {
    setError(null);
    const before = list;
    setList((l) => l.map((x) => (x.id === v.id ? { ...x, [key]: value } : x)));
    try {
      await admin.patchVehicle(v.id, { [key]: value });
    } catch (e) {
      setList(before);
      setError(e.detail);
    }
  };

  const groups = useMemo(() => {
    if (!list) return [];
    const shown = list.filter((v) => (!line || v.route === line) && (!onlyBroken || v.ramp_ok === false || v.audio_ok === false));
    const by = new Map();
    for (const v of shown) by.set(v.route, [...(by.get(v.route) ?? []), v]);
    return [...by.entries()];
  }, [list, line, onlyBroken]);

  if (!list) return <AdminPage title="Vehicule">{error ? <Alert tone="error" title="nu am putut încărca vehiculele">{error}</Alert> : <Skeleton text="Se încarcă vehiculele…" />}</AdminPage>;
  const sum = vehicleSummary(list);
  const lines = [...new Set(list.map((v) => v.route))];

  return (
    <AdminPage title="Vehicule">
      <div className="flex flex-wrap items-end gap-4">
        <Select id="v-line" label="Linia" value={line} onChange={setLine} options={[['', 'Toate liniile'], ...lines.map((l) => [l, list.find((v) => v.route === l).route_name])]} />
        <label className="flex min-h-12 cursor-pointer items-center gap-2 text-[17px] font-semibold">
          <input type="checkbox" checked={onlyBroken} onChange={(e) => setOnlyBroken(e.target.checked)} className="h-6 w-6 accent-success" />
          Doar cu defecte
        </label>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[
          [sum.rampBroken, 'vehicule cu rampa defectă'],
          [sum.audioBroken, 'vehicule cu anunțuri audio defecte'],
          [sum.openReports, 'rapoarte deschise de la călători'],
        ].map(([n, t]) => (
          <div key={t} className="flex items-center gap-3 rounded-card bg-surface p-4 shadow-sm hc:border-2 hc:border-border">
            <span className="text-[32px] font-extrabold">{n}</span>
            <span className="text-[17px]">{t}</span>
          </div>
        ))}
      </div>
      {error && (
        <Alert tone="error" urgent title="modificarea nu a fost salvată">
          {error}
        </Alert>
      )}
      <div className="overflow-x-auto rounded-card bg-surface shadow-sm hc:border-2 hc:border-border">
        <table className="w-full border-collapse text-left text-[17px]">
          <caption className="sr-only">Vehicule pe linii, cu dotările lor</caption>
          <thead>
            <tr className="border-b-2 border-border text-caption text-ink-muted">
              <th scope="col" className="p-3 font-bold">Vehicul</th>
              <th scope="col" className="p-3 font-bold">Podea joasă</th>
              <th scope="col" className="p-3 font-bold">Rampă</th>
              <th scope="col" className="p-3 font-bold">Anunțuri audio</th>
              <th scope="col" className="p-3 font-bold">Afișaj</th>
              <th scope="col" className="p-3 font-bold">Rapoarte</th>
            </tr>
          </thead>
          {groups.map(([route, vs]) => (
            <tbody key={route}>
              <tr className="bg-subtle">
                <th scope="rowgroup" colSpan={6} className="p-3 text-left font-bold">
                  <span className="mr-2 inline-flex h-8 min-w-8 items-center justify-center rounded-icon bg-primary px-2 font-extrabold text-on-primary">{route}</span>
                  {vs[0].route_name} · {vs.length} vehicule
                </th>
              </tr>
              {vs.map((v) => (
                <tr key={v.id} className="border-b border-border">
                  <th scope="row" className="p-3 font-mono font-bold">{v.id}</th>
                  <td className="p-3">{v.low_floor ? 'Da' : 'Nu'}</td>
                  <td className="p-3">
                    <CellSwitch label={`Rampă funcțională pentru ${v.id}`} on={v.ramp_ok !== false} disabled={!v.has_ramp} onChange={(on) => toggle(v, 'ramp_ok', on)} />
                  </td>
                  <td className="p-3">
                    <CellSwitch label={`Anunțuri audio funcționale pentru ${v.id}`} on={v.audio_ok !== false} disabled={!v.has_audio_announce} onChange={(on) => toggle(v, 'audio_ok', on)} />
                  </td>
                  <td className="p-3">{v.has_visual_display ? 'Da' : 'Nu'}</td>
                  <td className="p-3">{v.open_reports ? `${v.open_reports} deschise` : '—'}</td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
      <p className="m-0 text-caption text-ink-muted">Un vehicul cu dotarea marcată „Defect” nu mai apare în traseele celor care au nevoie de ea.</p>
    </AdminPage>
  );
}

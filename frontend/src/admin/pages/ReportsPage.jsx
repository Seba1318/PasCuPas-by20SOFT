import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ImageOff, Sparkles, X } from 'lucide-react';
import { admin } from '../../api/endpoints.js';
import { CATEGORIES, categoryLabel } from '../../reports/categories.js';
import { scoreLevel, scoreParts } from '../adminUtils.js';
import { confirmationText } from '../../pages/report/timeline.js';
import { formatDate, formatDateTime } from '../../lib/format.js';
import { useBreakpoint } from '../../layout/useBreakpoint.js';
import AdminPage, { Select } from './AdminPage.jsx';
import MiniMap from '../../components/map/MiniMap.jsx';
import StatusBadge from '../../ui/StatusBadge.jsx';
import Button from '../../ui/Button.jsx';
import Field from '../../ui/Field.jsx';
import Dialog from '../../ui/Dialog.jsx';
import Alert from '../../ui/Alert.jsx';
import Skeleton from '../../ui/Skeleton.jsx';
import EmptyState from '../../ui/EmptyState.jsx';
import { Tag } from '../../ui/Chip.jsx';
import { useToast } from '../../ui/Toast.jsx';

const PAGE = 50;
const STATUS_OPTIONS = [['active', 'Active (în lucru)'], ['', 'Toate'], ['rezolvat', 'Rezolvate'], ['respins', 'Respinse']];
const REJECT_REASONS = [
  'Problema nu se vede în poză',
  'Locul din poză nu corespunde cu locația aleasă',
  'Există deja un raport pentru aceeași problemă',
  'Problema nu ține de accesibilitate',
  'Alt motiv (scris în mesaj)',
];

function ScoreCell({ score }) {
  const lv = scoreLevel(score.total);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="text-[20px] font-extrabold">{score.total}</span>
        <Tag tone={lv.tone}>{lv.label}</Tag>
      </div>
      <span className="text-caption text-ink-muted">{scoreParts(score).map((p) => `${p.key} ${p.value}`).join(' · ')}</span>
    </div>
  );
}

// X3: respingerea, cu motiv obligatoriu și „raport fals” doar ca alegere explicită a unui om.
function RejectDialog({ open, report, onClose, onDone }) {
  const [reason, setReason] = useState('');
  const [isFalse, setIsFalse] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setReason('');
      setIsFalse(false);
      setMessage('');
      setError(null);
    }
  }, [open]);

  const submit = async () => {
    if (!reason) {
      setError('Alege motivul respingerii.');
      document.getElementById('reject-reason')?.focus();
      return;
    }
    setBusy(true);
    try {
      const updated = await admin.patchReport(report.id, { status: 'respins', is_false: isFalse, reason, message });
      onDone(updated);
    } catch (err) {
      setError(err.detail);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Respingi raportul"
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            Anulează
          </Button>
          <Button variant="danger" loading={busy} loadingText="Se salvează…" onClick={submit}>
            {isFalse ? 'Respinge și marchează fals' : 'Respinge'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="m-0">
          <span className="font-mono font-bold">{report?.public_code}</span> dispare de pe hartă și nu mai blochează traseele. Autorul primește un
          email cu motivul.
        </p>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="reject-reason" className="text-label">
            Motivul
          </label>
          <select
            id="reject-reason"
            value={reason}
            aria-invalid={error && !reason ? true : undefined}
            aria-describedby={error ? 'reject-error' : undefined}
            onChange={(e) => setReason(e.target.value)}
            className={`h-12 rounded-[14px] border-2 bg-surface px-3 text-[17px] ${error && !reason ? 'border-error' : 'border-border-strong'}`}
          >
            <option value="">Alege un motiv</option>
            {REJECT_REASONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          {error && (
            <span id="reject-error" className="text-[17px] font-semibold text-error">
              {error}
            </span>
          )}
        </div>
        <label className="flex cursor-pointer items-start gap-3 rounded-field border-2 border-warning bg-warning-bg p-3">
          <input type="checkbox" checked={isFalse} onChange={(e) => setIsFalse(e.target.checked)} className="mt-1 h-6 w-6 flex-none accent-error" />
          <span className="flex flex-col">
            <span className="text-[18px] font-bold">Marchează ca raport fals</span>
            <span className="text-[17px]">
              Scade nivelul de încredere al autorului. Folosește doar dacă raportul e greșit intenționat; scorul automat nu e un verdict.
            </span>
          </span>
        </label>
        <Field id="reject-msg" label="Mesaj pentru autor" optional multiline value={message} onChange={(e) => setMessage(e.target.value)} />
      </div>
    </Dialog>
  );
}

// Detaliul raportului selectat, cu schimbarea statusului.
function Detail({ report, onClose, onUpdated }) {
  const { show } = useToast();
  const [status, setStatus] = useState(report.status);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setStatus(report.status);
    setMessage('');
    setError(null);
  }, [report]);

  const save = async () => {
    if (status === 'respins') {
      setRejectOpen(true);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await admin.patchReport(report.id, { status, message });
      onUpdated({ ...report, ...updated });
      show({ tone: 'success', title: 'Status salvat', message: `${report.public_code}: autorul primește un email.` });
    } catch (err) {
      setError(err.detail);
    } finally {
      setBusy(false);
    }
  };

  const total = report.score.total;
  return (
    <aside aria-labelledby="ad-detail" className="flex flex-col gap-4 overflow-y-auto border-l border-border bg-surface p-5 hc:border-l-[3px]">
      <div className="flex items-center justify-between gap-2">
        <h2 id="ad-detail" className="m-0 font-mono text-[22px] font-bold">
          {report.public_code}
        </h2>
        <button type="button" onClick={onClose} className="flex h-12 items-center gap-1.5 rounded-[14px] border-2 border-border-strong px-3 text-[17px] font-bold hover:bg-subtle">
          <X aria-hidden="true" className="h-5 w-5" strokeWidth={2.5} />
          Închide
        </button>
      </div>
      {report.photo_url ? (
        <img src={report.photo_url} alt={`Poza raportului: ${categoryLabel(report.category).toLowerCase()}`} className="max-h-52 w-full rounded-field object-cover" />
      ) : (
        <div className="flex items-center gap-2 rounded-field bg-subtle p-3 text-caption text-ink-muted">
          <ImageOff aria-hidden="true" className="h-6 w-6" /> Poza nu e disponibilă în datele de demo.
        </div>
      )}
      <div className="flex flex-col">
        <span className="text-[20px] font-bold">{categoryLabel(report.category)}</span>
        <span className="text-caption text-ink-muted">
          {report.reporter?.name ?? 'Utilizator'} · {formatDateTime(report.created_at)}
        </span>
      </div>
      <MiniMap point={report.geometry.coordinates} label={report.location_text} className="h-40" />
      <span className="text-[17px]">{report.location_text}</span>
      <section aria-labelledby="score-title" className="flex flex-col gap-2 rounded-field bg-subtle p-3">
        <h3 id="score-title" className="m-0 text-[18px] font-bold">
          Scor de verificare: {total} din 100 · {scoreLevel(total).label}
        </h3>
        {scoreParts(report.score).map((p) => (
          <div key={p.key} className="flex items-center gap-2 text-[16px]">
            <span className="w-20">{p.key}</span>
            <span aria-hidden="true" className="h-2.5 flex-1 overflow-hidden rounded-chip bg-border">
              <span className="block h-full bg-info" style={{ width: `${(p.value / p.max) * 100}%` }} />
            </span>
            <span className="w-16 text-right font-bold">
              {p.value}/{p.max}
            </span>
          </div>
        ))}
        {report.score.ai_notes && <p className="m-0 text-caption text-ink-muted">AI: {report.score.ai_notes}</p>}
        <p className="m-0 text-caption text-ink-muted">Scorul ajută la ordinea verificării. Nu respinge și nu aprobă nimic singur.</p>
      </section>
      <span className="text-[17px] font-semibold">{confirmationText(report.confirmations)}</span>
      {report.possibly_resolved && <Tag tone="info" icon={Sparkles}>Posibil rezolvat: 3 utilizatori spun că a fost reparat</Tag>}
      {error && (
        <Alert tone="error" urgent title="nu am putut salva">
          {error}
        </Alert>
      )}
      <Select id="ad-status" label="Status" value={status} onChange={setStatus} options={[['in_lucru', 'În lucru'], ['rezolvat', 'Rezolvat'], ['respins', 'Respins…']]} />
      {status !== 'respins' && (
        <Field id="ad-msg" label="Mesaj pentru cetățean" optional multiline value={message} onChange={(e) => setMessage(e.target.value)} />
      )}
      <Button loading={busy} loadingText="Se salvează…" onClick={save}>
        {status === 'respins' ? 'Continuă cu respingerea' : 'Salvează statusul'}
      </Button>
      <RejectDialog
        open={rejectOpen}
        report={report}
        onClose={() => setRejectOpen(false)}
        onDone={(updated) => {
          setRejectOpen(false);
          onUpdated({ ...report, ...updated });
          show({ tone: 'success', title: 'Raport respins', message: `${report.public_code} nu mai apare pe hartă.` });
        }}
      />
    </aside>
  );
}

// X2 (desktop), X14 (tabletă), X12 (coadă goală): lista rapoartelor cu filtre în URL.
export default function ReportsPage() {
  const bp = useBreakpoint();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? 'active';
  const category = params.get('category') ?? '';
  const q = params.get('q') ?? '';
  const offset = Number(params.get('offset') ?? 0);
  const [state, setState] = useState({ status: 'loading', items: [], total: 0 });
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, status: 'loading' }));
    admin
      .reports({ status: status === 'toate' ? '' : status, category, limit: PAGE, offset })
      .then((res) => {
        if (cancelled) return;
        const items = q ? res.items.filter((r) => r.public_code.includes(q)) : res.items;
        setState({ status: 'ok', items, total: q ? items.length : res.total });
        if (q && items.length === 1) setSelected(items[0]);
      })
      .catch((err) => !cancelled && setState({ status: 'error', items: [], total: 0, error: err.detail }));
    return () => {
      cancelled = true;
    };
  }, [status, category, q, offset]);

  const setFilter = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'offset') next.delete('offset');
    if (key !== 'q') next.delete('q');
    setParams(next);
    setSelected(null);
  };

  const updated = (r) => {
    setState((s) => ({ ...s, items: s.items.map((x) => (x.id === r.id ? r : x)) }));
    setSelected(r);
  };

  const narrow = bp !== 'desktop';
  const showList = !(narrow && selected);

  return (
    <div className={`grid min-h-0 flex-1 ${selected && !narrow ? 'grid-cols-[minmax(0,1fr)_420px]' : 'grid-cols-1'}`}>
      {showList && (
        <AdminPage title="Rapoarte" meta={state.status === 'ok' ? `${state.total} rezultate` : null}>
          <div role="group" aria-label="Filtre" className="flex flex-wrap items-end gap-3">
            <Select id="f-status" label="Status" value={status} onChange={(v) => setFilter('status', v || 'toate')} options={STATUS_OPTIONS.map(([v, l]) => [v || 'toate', l])} />
            <Select id="f-cat" label="Categorie" value={category} onChange={(v) => setFilter('category', v)} options={[['', 'Toate'], ...CATEGORIES.map((c) => [c.id, c.label])]} />
            {(status !== 'active' || category || q) && (
              <Button variant="text" size="sm" onClick={() => setParams({})}>
                Resetează
              </Button>
            )}
          </div>
          {q && <p className="m-0 text-[17px]">Rezultate pentru codul „{q}”.</p>}
          {state.status === 'loading' && <Skeleton text="Se încarcă rapoartele…" />}
          {state.status === 'error' && (
            <Alert tone="error" title="nu am putut încărca rapoartele">
              {state.error}
            </Alert>
          )}
          {state.status === 'ok' && state.items.length === 0 && (
            <EmptyState spot="allClear" title={status === 'active' ? 'Niciun raport de verificat' : 'Niciun raport cu aceste filtre'}>
              {status === 'active' ? 'Toate rapoartele au fost preluate. Revino mai târziu.' : 'Schimbă filtrele ca să vezi alte rapoarte.'}
            </EmptyState>
          )}
          {state.status === 'ok' && state.items.length > 0 && (
            <div className="overflow-x-auto rounded-card bg-surface shadow-sm hc:border-2 hc:border-border">
              <table className="w-full border-collapse text-left text-[17px]">
                <caption className="sr-only">Rapoarte, cele mai noi primele</caption>
                <thead>
                  <tr className="border-b-2 border-border text-caption text-ink-muted">
                    <th scope="col" className="p-3 font-bold">Raport</th>
                    <th scope="col" className="p-3 font-bold">Scor verificare</th>
                    <th scope="col" className="p-3 font-bold">Status</th>
                    <th scope="col" className="p-3 font-bold">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {state.items.map((r) => (
                    <tr key={r.id} className={`border-b border-border ${selected?.id === r.id ? 'bg-info-bg' : ''}`}>
                      <td className="p-3">
                        <button type="button" onClick={() => setSelected(r)} className="flex flex-col items-start text-left">
                          <span className="font-mono font-bold text-info underline underline-offset-2">{r.public_code}</span>
                          <span className="font-semibold">{categoryLabel(r.category)}</span>
                          <span className="text-caption text-ink-muted">{r.location_text}</span>
                        </button>
                        {r.possibly_resolved && <Tag tone="info" className="mt-1">Posibil rezolvat</Tag>}
                      </td>
                      <td className="p-3">
                        <ScoreCell score={r.score} />
                      </td>
                      <td className="p-3">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="p-3">{formatDate(r.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {state.total > PAGE && (
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={offset === 0} onClick={() => setFilter('offset', String(Math.max(0, offset - PAGE)))}>
                Mai noi
              </Button>
              <Button variant="secondary" size="sm" disabled={offset + PAGE >= state.total} onClick={() => setFilter('offset', String(offset + PAGE))}>
                Mai vechi
              </Button>
            </div>
          )}
        </AdminPage>
      )}
      {selected && <Detail report={selected} onClose={() => setSelected(null)} onUpdated={updated} />}
    </div>
  );
}

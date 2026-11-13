import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';
import { reports } from '../../api/endpoints.js';
import { CATEGORIES, categoryLabel } from '../../reports/categories.js';
import CategoryIcon from '../../reports/CategoryIcon.jsx';
import { REPORT_FILTERS, filterReports, sortByDate } from './accountUtils.js';
import { buildTimeline, confirmationText } from '../report/timeline.js';
import { formatDate } from '../../lib/format.js';
import { useBreakpoint } from '../../layout/useBreakpoint.js';
import StatusBadge from '../../ui/StatusBadge.jsx';
import Chip from '../../ui/Chip.jsx';
import Skeleton from '../../ui/Skeleton.jsx';
import Alert from '../../ui/Alert.jsx';
import EmptyState from '../../ui/EmptyState.jsx';
import { ButtonLink } from '../../ui/Button.jsx';

const catOf = (id) => CATEGORIES.find((c) => c.id === id) ?? CATEGORIES.at(-1);

function Detail({ report, onClose }) {
  return (
    <aside aria-labelledby="mr-detail" className="flex flex-col gap-3 rounded-card bg-surface p-5 shadow-md hc:border-2 hc:border-border">
      <div className="flex items-center justify-between gap-2">
        <h2 id="mr-detail" className="m-0 font-mono text-[22px] font-bold">
          {report.public_code}
        </h2>
        <button type="button" onClick={onClose} aria-keyshortcuts="Escape" className="flex h-12 items-center gap-1.5 rounded-[14px] border-2 border-border-strong px-3 text-[17px] font-bold hover:bg-subtle">
          <X aria-hidden="true" className="h-5 w-5" strokeWidth={2.5} />
          Închide
        </button>
      </div>
      {report.photo_url && <img src={report.photo_url} alt="Poza raportului" className="max-h-48 w-full rounded-field object-cover" />}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[18px] font-bold">{categoryLabel(report.category)}</span>
        <StatusBadge status={report.status} />
      </div>
      <span className="text-caption text-ink-muted">{report.location_text}</span>
      <ol className="m-0 flex list-none flex-col gap-1 p-0">
        {buildTimeline(report).map((s) => (
          <li key={s.label} aria-current={s.state === 'current' ? 'step' : undefined} className={s.state === 'next' ? 'text-ink-muted' : ''}>
            <b>{s.label}</b> · {s.when}
          </li>
        ))}
      </ol>
      <span className="text-[17px] font-semibold">{confirmationText(report.confirmations)}</span>
      <ButtonLink to={`/raport/${report.public_code}`} variant="secondary" full>
        Vezi pagina raportului
      </ButtonLink>
    </aside>
  );
}

// E9 (listă pe telefon) și W16 (tabel cu detaliu pe desktop).
export default function MyReports() {
  const bp = useBreakpoint();
  const [state, setState] = useState({ status: 'loading', list: [] });
  const [filter, setFilter] = useState('toate');
  const [dir, setDir] = useState('desc');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    reports
      .mine()
      .then((list) => setState({ status: 'ok', list }))
      .catch((err) => setState({ status: 'error', list: [], error: err.detail }));
  }, []);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && setSelected(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const shown = useMemo(() => sortByDate(filterReports(state.list, filter), dir), [state.list, filter, dir]);
  const table = bp !== 'phone';

  const header = (
    <div className="flex items-center justify-between gap-3">
      <h1 className="m-0 text-title-2-sm md:text-title-2">Rapoartele mele</h1>
      <ButtonLink to="/raporteaza" variant="primary" size="sm" icon={Plus} className="flex-none whitespace-nowrap">
        Raport nou
      </ButtonLink>
    </div>
  );

  if (state.status === 'loading') {
    return (
      <>
        {header}
        <Skeleton text="Se încarcă rapoartele…" />
      </>
    );
  }
  if (state.status === 'error') {
    return (
      <>
        {header}
        <Alert tone="error" title="nu am putut încărca rapoartele">
          {state.error}
        </Alert>
      </>
    );
  }
  if (!state.list.length) {
    return (
      <>
        {header}
        <EmptyState
          spot="emptyReports"
          title="Încă n-ai trimis niciun raport"
          actions={
            <ButtonLink to="/raporteaza" variant="primary" full>
              Raportează o problemă
            </ButtonLink>
          }
        >
          Când vezi o rampă blocată sau un lift defect, raportează-l: traseele tuturor devin mai sigure.
        </EmptyState>
      </>
    );
  }

  return (
    <>
      {header}
      <div role="group" aria-label="Filtrează după status" className="flex flex-wrap gap-2">
        {REPORT_FILTERS.map((f) => (
          <Chip key={f.id} pressed={filter === f.id} onToggle={() => setFilter(f.id)}>
            {f.label}
          </Chip>
        ))}
      </div>
      {!shown.length && <p className="m-0 text-ink-muted">Niciun raport cu acest status.</p>}
      {table ? (
        <div className={`grid gap-5 ${selected ? 'lg:grid-cols-[minmax(0,1fr)_360px]' : ''}`}>
          <div className="overflow-x-auto rounded-card bg-surface shadow-sm hc:border-2 hc:border-border">
            <table className="w-full border-collapse text-left text-[17px]">
              <caption className="sr-only">Rapoartele mele, {shown.length} rapoarte</caption>
              <thead>
                <tr className="border-b-2 border-border text-caption text-ink-muted">
                  <th scope="col" className="p-3 font-bold">Cod</th>
                  <th scope="col" className="p-3 font-bold">Categorie</th>
                  <th scope="col" className="p-3 font-bold">Locație</th>
                  <th scope="col" className="p-3 font-bold" aria-sort={dir === 'desc' ? 'descending' : 'ascending'}>
                    <button type="button" onClick={() => setDir(dir === 'desc' ? 'asc' : 'desc')} className="flex min-h-target items-center gap-1 font-bold">
                      Data
                      {dir === 'desc' ? <ArrowDown aria-hidden="true" className="h-4 w-4" /> : <ArrowUp aria-hidden="true" className="h-4 w-4" />}
                      <span className="sr-only">{dir === 'desc' ? ', cele mai noi primele' : ', cele mai vechi primele'}</span>
                    </button>
                  </th>
                  <th scope="col" className="p-3 font-bold">Status</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.public_code} className={`border-b border-border ${selected?.public_code === r.public_code ? 'bg-info-bg' : ''}`}>
                    <td className="p-3">
                      <button type="button" onClick={() => setSelected(r)} className="min-h-target font-mono font-bold text-info underline underline-offset-2">
                        {r.public_code}
                      </button>
                    </td>
                    <td className="p-3">{categoryLabel(r.category)}</td>
                    <td className="p-3">{r.location_text}</td>
                    <td className="p-3">{formatDate(r.created_at)}</td>
                    <td className="p-3">
                      <StatusBadge status={r.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {selected && <Detail report={selected} onClose={() => setSelected(null)} />}
        </div>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {shown.map((r) => (
            <li key={r.public_code}>
              <Link
                to={`/raport/${r.public_code}`}
                className="flex flex-col gap-2 rounded-card bg-surface p-4 text-ink no-underline shadow-sm hover:text-ink hc:border-2 hc:border-border"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[18px] font-bold">{r.public_code}</span>
                  <StatusBadge status={r.status} />
                </div>
                <div className="flex items-center gap-3">
                  <CategoryIcon category={catOf(r.category)} size="sm" />
                  <span className="flex flex-col">
                    <span className="text-[18px] font-semibold">{categoryLabel(r.category)}</span>
                    <span className="text-caption text-ink-muted">
                      {r.location_text} · {formatDate(r.created_at)}
                    </span>
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

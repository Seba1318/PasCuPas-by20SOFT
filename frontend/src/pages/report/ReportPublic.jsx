import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, ChevronLeft, Clock, ImageOff, Share2, Users, X } from 'lucide-react';
import { reports } from '../../api/endpoints.js';
import { useAuth } from '../../auth/AuthProvider.jsx';
import { categoryLabel, CATEGORIES } from '../../reports/categories.js';
import CategoryIcon from '../../reports/CategoryIcon.jsx';
import { buildTimeline, confirmationText } from './timeline.js';
import { formatDateTime } from '../../lib/format.js';
import MiniMap from '../../components/map/MiniMap.jsx';
import StatusBadge from '../../ui/StatusBadge.jsx';
import Button, { ButtonLink } from '../../ui/Button.jsx';
import Skeleton from '../../ui/Skeleton.jsx';
import Alert from '../../ui/Alert.jsx';
import { useToast } from '../../ui/Toast.jsx';

const STEP_STYLE = {
  done: { cls: 'border-success bg-success-bg text-success', Icon: Check },
  current: { cls: 'border-info-strong bg-info-bg text-info-strong', Icon: Clock },
  next: { cls: 'border-route-blocked bg-surface text-ink-muted', Icon: null },
};

function Timeline({ report }) {
  const steps = buildTimeline(report);
  return (
    <ol aria-label="Istoricul raportului" className="m-0 flex list-none flex-col p-0">
      {steps.map((s, i) => {
        const st = STEP_STYLE[s.state];
        return (
          <li key={s.label} aria-current={s.state === 'current' ? 'step' : undefined} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span className={`flex h-9 w-9 flex-none items-center justify-center rounded-chip border-2 ${st.cls}`}>
                {st.Icon && <st.Icon aria-hidden="true" className="h-5 w-5" strokeWidth={3} />}
              </span>
              {i < steps.length - 1 && <span aria-hidden="true" className={`w-1 flex-1 ${s.state === 'done' ? 'bg-success' : 'bg-line-soft'}`} />}
            </div>
            <div className="flex flex-col pb-4">
              <span className={`text-[18px] ${s.state === 'current' ? 'font-extrabold' : 'font-bold'} ${s.state === 'next' ? 'text-ink-muted' : ''}`}>{s.label}</span>
              <span className="text-caption text-ink-muted">{s.when}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// E8 (telefon) și W13 (desktop): pagina publică a unui raport.
export default function ReportPublic() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { user, status: authStatus } = useAuth();
  const { show } = useToast();
  const [state, setState] = useState({ status: 'loading' });
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState(null);

  useEffect(() => {
    reports
      .get(code)
      .then((f) => setState({ status: 'ok', f }))
      .catch((err) => setState({ status: 'error', error: err.detail, notFound: err.status === 404 }));
  }, [code]);

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: `Raport ${code}`, url });
      else {
        await navigator.clipboard.writeText(url);
        show({ tone: 'success', title: 'Link copiat', message: 'Poți trimite linkul raportului oricui.' });
      }
    } catch {
      /* partajare anulată */
    }
  };

  const back = (
    <button type="button" onClick={() => navigate(-1)} className="-ml-2 flex min-h-target flex-none items-center gap-0.5 rounded-[14px] pl-1 pr-3 text-[17px] font-bold hover:bg-subtle">
      <ChevronLeft aria-hidden="true" className="h-6 w-6" strokeWidth={2.5} />
      Înapoi
    </button>
  );

  if (state.status === 'loading') return <Skeleton text="Se încarcă raportul…" />;
  if (state.status === 'error') {
    return (
      <>
        {back}
        <Alert tone="error" title={state.notFound ? 'nu am găsit raportul' : 'nu am putut încărca raportul'}>
          {state.notFound ? `Verifică dacă codul ${code} e scris corect.` : state.error}
        </Alert>
      </>
    );
  }

  const p = state.f.properties;
  const category = CATEGORIES.find((c) => c.id === p.category) ?? CATEGORIES.at(-1);
  const mine = user && p.reporter?.user_id === user.id;
  const reporterName = p.reporter?.name ?? 'un utilizator';

  const confirm = async () => {
    setConfirming(true);
    setConfirmError(null);
    try {
      const res = await reports.confirm(p.id, 'confirm');
      setState((s) => ({ ...s, f: { ...s.f, properties: { ...s.f.properties, confirmations: res.confirmations } } }));
      show({ tone: 'success', title: 'Mulțumim!', message: 'Confirmarea ta ajută raportul să fie verificat mai repede.' });
    } catch (err) {
      setConfirmError(err.detail);
    } finally {
      setConfirming(false);
    }
  };

  return (
    <>
      <header className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {back}
        <Button variant="secondary" size="sm" icon={Share2} onClick={share} className="ml-auto md:order-last">
          Distribuie
        </Button>
        <h1 className="m-0 w-full whitespace-nowrap font-mono text-[24px] font-bold md:w-auto md:flex-1 md:text-[26px]">
          <span className="sr-only">Raportul </span>
          {p.public_code}
        </h1>
      </header>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          {p.photo_url ? (
            <img src={p.photo_url} alt={`Poza raportului: ${categoryLabel(p.category).toLowerCase()}`} className="max-h-72 w-full rounded-card object-cover" />
          ) : (
            <div className="flex items-center gap-3 rounded-card bg-surface p-4 text-caption text-ink-muted shadow-sm">
              <ImageOff aria-hidden="true" className="h-8 w-8 flex-none" strokeWidth={2} />
              Poza nu mai e disponibilă: pozele se șterg după 30 de zile.
            </div>
          )}
          <div className="flex flex-col gap-2">
            <MiniMap point={state.f.geometry.coordinates} label={p.location_text} className="h-44 lg:h-56" />
            <p className="m-0 text-[18px] font-semibold">{p.location_text}</p>
            {p.description && <p className="m-0 text-[17px] text-ink-muted">„{p.description}”</p>}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <CategoryIcon category={category} size="sm" />
            <h2 className="m-0 flex-1 text-title-3">{categoryLabel(p.category)}</h2>
            <StatusBadge status={p.status} />
          </div>
          <div className="flex items-center gap-3">
            {p.reporter?.avatar_url ? (
              <img src={p.reporter.avatar_url} alt="" className="h-11 w-11 rounded-chip object-cover" />
            ) : (
              <span aria-hidden="true" className="flex h-11 w-11 items-center justify-center rounded-chip bg-lavender text-[18px] font-extrabold uppercase">
                {reporterName[0]}
              </span>
            )}
            <div className="flex flex-col">
              <span className="text-[18px] font-semibold">Raportat de {reporterName}</span>
              <span className="text-caption text-ink-muted">{formatDateTime(p.created_at)}</span>
            </div>
          </div>
          <Timeline report={p} />
          <div className="flex flex-col gap-2.5 rounded-card bg-surface p-4 shadow-sm hc:border-2 hc:border-border">
            <span className="flex items-center gap-2 text-[18px] font-bold">
              <Users aria-hidden="true" className="h-5 w-5" strokeWidth={2.5} />
              {confirmationText(p.confirmations)}
            </span>
            {p.status === 'in_lucru' && !mine && authStatus === 'authed' && (
              <Button variant="secondary" full loading={confirming} loadingText="Se trimite…" onClick={confirm}>
                Confirmă, am văzut și eu
              </Button>
            )}
            {p.status === 'in_lucru' && authStatus === 'anon' && (
              <ButtonLink to={`/autentificare?next=/raport/${p.public_code}`} full>
                Intră în cont ca să confirmi
              </ButtonLink>
            )}
            {mine && <span className="text-caption text-ink-muted">E raportul tău; alți oameni îl pot confirma.</span>}
            {confirmError && (
              <p role="alert" className="m-0 flex items-start gap-2 text-[17px] font-semibold text-error">
                <X aria-hidden="true" className="mt-0.5 h-5 w-5 flex-none" strokeWidth={3} />
                {confirmError}
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

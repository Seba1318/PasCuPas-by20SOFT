import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import { Check, ChevronLeft, Info, X } from 'lucide-react';
import { StepCategory, StepDetails, StepSummary, StepVehicle } from './ReportSteps.jsx';
import { RateLimited, ReportExisting, ReportSent, Suspended } from './ReportOutcomes.jsx';
import MapPointPicker from './MapPointPicker.jsx';
import Stepper from '../../ui/Stepper.jsx';
import Alert from '../../ui/Alert.jsx';
import Button from '../../ui/Button.jsx';
import MarkersLayer from '../../components/map/MarkersLayer.jsx';
import { useMapContext, useMapOverlay } from '../../components/map/MapContext.jsx';
import { bboxAround, nearestFeature, toLatLng } from '../../components/map/geo.js';
import { buildReportForm, createDraftStore, isVehicleCategory, reportSteps, validateDetails } from '../../reports/reportDraft.js';
import { categoryLabel } from '../../reports/categories.js';
import { reports, transit } from '../../api/endpoints.js';
import { useAuth } from '../../auth/AuthProvider.jsx';
import { parseLonLat } from '../route/routeUtils.js';
import { usePanel } from '../../layout/PanelContext.jsx';
import { panelWidth } from '../../layout/breakpoints.js';

const store = createDraftStore();
// Raza în care căutăm stația pentru un raport despre un vehicul (aceeași ca la traseele cu transport).
const NEAR_STOP_M = 500;
const EMPTY = { category: null, point: null, pointSource: null, location_text: '', description: '', vehicle: null, equipment: null, stop: null };

function initialDraft(params) {
  const saved = store.load() ?? {};
  const draft = { ...EMPTY, ...saved };
  const point = parseLonLat(`${params.get('lon')},${params.get('lat')}`);
  if (point) Object.assign(draft, { point, pointSource: 'map', location_text: params.get('loc') ?? draft.location_text });
  if (params.get('categorie')) draft.category = params.get('categorie');
  if (params.get('statie')) draft.stop = params.get('statie');
  return draft;
}

/**
 * Fluxul de raportare: Categorie → (Vehicul) → Detalii → Verifică și trimite (E1–E7, W14, W15).
 * Ciorna se păstrează local la fiecare schimbare, ca un 401 sau o reîncărcare să nu piardă nimic.
 */
export default function ReportFlow() {
  const { breakpoint } = useOutletContext();
  const phone = breakpoint === 'phone';
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const { map, setUserPosition } = useMapContext();

  const [draft, setDraft] = useState(() => initialDraft(params));
  const [step, setStep] = useState(() => (draft.category ? (isVehicleCategory(draft.category) ? 'vehicle' : 'details') : 'category'));
  const [photo, setPhoto] = useState(null);
  const [photoError, setPhotoError] = useState(null);
  const [errors, setErrors] = useState({});
  const [gps, setGps] = useState(null);
  const [gpsNote, setGpsNote] = useState(null);
  const [vehicleInfo, setVehicleInfo] = useState(null);
  const [stopInfo, setStopInfo] = useState(null); // null | { status: 'searching' | 'found' | 'none', name?, note? }
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [outcome, setOutcome] = useState(null); // { kind: 'sent' | 'existing' | 'rate' | 'suspended', data }

  const set = useCallback((patch) => setDraft((d) => ({ ...d, ...patch })), []);
  useEffect(() => store.save(draft), [draft]);

  const suspendedUntil = user?.suspended_until && new Date(user.suspended_until) > new Date() ? user.suspended_until : null;

  const locateMe = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsNote('Browserul nu oferă localizare. Alege locul pe hartă.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const point = [pos.coords.longitude, pos.coords.latitude];
        const g = { point, accuracy: pos.coords.accuracy };
        setGps(g);
        setUserPosition(g);
        set({ point, pointSource: 'gps' });
        setGpsNote(null);
        map?.setView(toLatLng(point), 18);
      },
      () => setGpsNote('Nu am putut afla unde ești. Alege locul pe hartă.'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, [map, set, setUserPosition]);

  // Pozitia browserului se trimite cu raportul (scorul de locație), dacă o avem.
  useEffect(() => {
    if (step === 'details' && !draft.point && !isVehicleCategory(draft.category)) locateMe();
    // doar la intrarea în pasul de detalii
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Raport despre un vehicul fără stație aleasă: pornim de la stația cea mai apropiată de utilizator
  // (planul 20SOFT · Rapoarte pentru vehicule: vehiculul se alege din sosirile stației apropiate).
  useEffect(() => {
    if (step !== 'vehicle' || draft.stop) return undefined;
    let cancelled = false;
    const none = (note) => !cancelled && setStopInfo({ status: 'none', note });
    setStopInfo({ status: 'searching' });
    if (!navigator.geolocation) {
      none('Browserul nu oferă localizare.');
      return undefined;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        if (cancelled) return;
        const point = [pos.coords.longitude, pos.coords.latitude];
        const g = { point, accuracy: pos.coords.accuracy };
        setGps(g);
        setUserPosition(g);
        try {
          const res = await transit.stops({ bbox: bboxAround(point, NEAR_STOP_M).join(',') });
          const stop = nearestFeature(point, res.features, NEAR_STOP_M);
          if (cancelled) return;
          if (!stop) {
            none(`Nu e nicio stație la mai puțin de ${NEAR_STOP_M} m de tine.`);
            return;
          }
          setStopInfo({ status: 'found', name: stop.properties.name });
          set({ stop: stop.id });
        } catch (err) {
          none(err.detail ?? 'Nu am putut încărca stațiile.');
        }
      },
      () => none('Nu știm unde ești: browserul nu are voie să folosească locația.'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
    return () => {
      cancelled = true;
    };
  }, [step, draft.stop, set, setUserPosition]);

  const onMapPick = useCallback(
    (point) => {
      set({ point, pointSource: 'map' });
      setErrors((e) => ({ ...e, location: undefined }));
    },
    [set],
  );

  const mapActive = step === 'details' && !isVehicleCategory(draft.category) && (!phone || picking);
  const overlay = useMemo(
    () => (
      <>
        {mapActive && <MapPointPicker onPick={onMapPick} />}
        {draft.point && step !== 'category' && (
          <MarkersLayer items={[{ id: 'report-point', type: 'problem', point: draft.point, label: 'Locul ales pentru raport' }]} cluster={false} selectedId="report-point" />
        )}
      </>
    ),
    [mapActive, onMapPick, draft.point, step],
  );
  useMapOverlay('report', overlay);

  const steps = reportSteps(draft.category);
  const currentIndex = { category: 0, vehicle: 1, details: isVehicleCategory(draft.category) ? 2 : 1, summary: steps.length - 1 }[step] ?? 0;
  const stepper = steps.map((label, i) => ({ label, state: i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'next' }));

  const goDetails = () => {
    const found = validateDetails({ ...draft, photo });
    setErrors(found);
    if (Object.keys(found).length) {
      const first = found.photo ? 'report-photo' : found.location_text ? 'report-location-text' : found.description ? 'report-description' : null;
      if (first) document.getElementById(first)?.focus();
      return;
    }
    setStep('summary');
  };

  const submit = async () => {
    setBusy(true);
    setSubmitError(null);
    try {
      const form = buildReportForm(new FormData(), { ...draft, photo, reporter: gps });
      const res = await reports.create(form);
      store.clear();
      setOutcome(res.merged_into ? { kind: 'existing', data: res } : { kind: 'sent', data: res });
    } catch (err) {
      if (err.status === 429) setOutcome({ kind: 'rate', data: err.detail });
      else if (err.status === 403) setOutcome({ kind: 'suspended', data: null });
      else if (err.status === 400 && /poz/i.test(err.detail)) {
        setPhotoError(err.detail);
        setStep('details');
      } else if (err.status !== 401) {
        setSubmitError(
          <Alert tone="error" urgent title="raportul nu a plecat">
            {err.detail} Ce ai completat rămâne salvat.
          </Alert>,
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const back = () => {
    if (step === 'summary') setStep('details');
    else if (step === 'details') setStep(isVehicleCategory(draft.category) ? 'vehicle' : 'category');
    else if (step === 'vehicle') setStep('category');
  };

  let body;
  if (suspendedUntil || outcome?.kind === 'suspended') body = <Suspended until={suspendedUntil} />;
  else if (outcome?.kind === 'rate') body = <RateLimited detail={outcome.data} />;
  else if (outcome?.kind === 'sent') body = <ReportSent code={outcome.data.public_code} />;
  else if (outcome?.kind === 'existing') body = <ReportExisting result={outcome.data} />;
  else {
    let content;
    if (step === 'category') {
      content = (
        <StepCategory
          value={draft.category}
          onPick={(category) => {
            set({ category });
            setStep(isVehicleCategory(category) ? 'vehicle' : 'details');
          }}
        />
      );
    } else if (step === 'vehicle') {
      content = (
        <StepVehicle
          stopId={draft.stop}
          stopInfo={stopInfo}
          value={draft.vehicle}
          error={errors.vehicle}
          onPick={(vehicle, info) => {
            set({ vehicle });
            setVehicleInfo(info);
            setErrors({});
          }}
          onContinue={() => (draft.vehicle ? setStep('details') : setErrors({ vehicle: 'Alege vehiculul în care ai fost.' }))}
        />
      );
    } else if (step === 'details') {
      content = (
        <>
          {gpsNote && !draft.point && (
            <Alert tone="info" showKind={false} title="Alege locul">
              {gpsNote}
            </Alert>
          )}
          {!phone && !photo && store.load() && draft.description && (
            <p className="m-0 text-caption text-ink-muted">Ce ai scris până acum e salvat; poza trebuie aleasă din nou.</p>
          )}
          <StepDetails
            phone={phone}
            draft={draft}
            set={set}
            photo={photo}
            setPhoto={setPhoto}
            photoError={photoError}
            setPhotoError={setPhotoError}
            errors={errors}
            gps={gps}
            onLocateMe={locateMe}
            onPickOnMap={() => setPicking(true)}
            onContinue={goDetails}
          />
        </>
      );
    } else {
      content = (
        <StepSummary
          draft={draft}
          photo={photo}
          vehicleInfo={vehicleInfo}
          busy={busy}
          error={submitError}
          onSubmit={submit}
          onEdit={(s) => setStep(s === 'category' ? 'category' : s === 'vehicle' ? 'vehicle' : 'details')}
        />
      );
    }

    const title = step === 'category' ? 'Raportează o problemă' : step === 'summary' ? 'Verifică și trimite' : categoryLabel(draft.category);
    body = (
      <>
        <header className="flex items-center gap-2">
          {step !== 'category' && (
            <button type="button" onClick={back} className="-ml-2 flex min-h-target flex-none items-center gap-0.5 rounded-[14px] pl-1 pr-3 text-[17px] font-bold hover:bg-subtle">
              <ChevronLeft aria-hidden="true" className="h-6 w-6" strokeWidth={2.5} />
              Înapoi
            </button>
          )}
          <h1 className="m-0 flex-1 text-[24px] font-extrabold leading-8">{title}</h1>
          {step === 'category' && (
            <Link to="/" className="flex h-12 flex-none items-center gap-1.5 rounded-[14px] border-2 border-border-strong px-3.5 text-[17px] font-bold text-ink no-underline hover:bg-subtle hover:text-ink">
              <X aria-hidden="true" className="h-5 w-5" strokeWidth={2.5} />
              Închide
            </Link>
          )}
        </header>
        <Stepper steps={stepper} label={`Pasul ${currentIndex + 1} din ${steps.length}`} />
        {content}
      </>
    );
  }

  if (phone) {
    if (picking) {
      return (
        <>
          <div role="status" className="absolute inset-x-3 top-3 z-[860] flex items-start gap-2 rounded-card bg-surface p-3 text-[17px] shadow-lg hc:border-2 hc:border-border">
            <Info aria-hidden="true" className="mt-0.5 h-5 w-5 flex-none text-info-strong" strokeWidth={2.5} />
            Atinge harta acolo unde e problema.
          </div>
          <div className="absolute inset-x-4 bottom-9 z-[860]">
            <Button full icon={Check} className="font-extrabold shadow-lg" disabled={!draft.point} onClick={() => setPicking(false)}>
              {draft.point ? 'Folosește locul ăsta' : 'Alege un loc pe hartă'}
            </Button>
          </div>
        </>
      );
    }
    return <div className="absolute inset-0 z-[1050] flex flex-col gap-4 overflow-y-auto bg-bg px-4 pb-8 pt-4">{body}</div>;
  }

  return (
    <>
      <div className="flex flex-col gap-4 px-6 py-5">{body}</div>
      {mapActive && (
        <MapHint breakpoint={breakpoint}>Fă clic pe hartă acolo unde e problema. Din tastatură: mută harta cu săgețile și apasă Enter.</MapHint>
      )}
    </>
  );
}

// Indicația de deasupra hărții (W14), așezată lângă panoul lateral.
function MapHint({ breakpoint, children }) {
  const { collapsed } = usePanel();
  return (
    <div
      role="status"
      style={{ left: panelWidth(breakpoint, collapsed) + 24 }}
      className="pointer-events-none fixed top-[96px] z-[1100] flex max-w-[560px] items-start gap-2 rounded-card bg-surface p-3 text-[17px] shadow-lg hc:border-2 hc:border-border">
      <Info aria-hidden="true" className="mt-0.5 h-5 w-5 flex-none text-info-strong" strokeWidth={2.5} />
      {children}
    </div>
  );
}

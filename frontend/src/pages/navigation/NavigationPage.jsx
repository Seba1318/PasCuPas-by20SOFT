import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { LoaderCircle, Repeat, ChevronRight, TriangleAlert } from 'lucide-react';
import MapView from '../../components/map/MapView.jsx';
import RouteLine from '../../components/map/RouteLine.jsx';
import MarkersLayer from '../../components/map/MarkersLayer.jsx';
import { MapProvider, useMapContext } from '../../components/map/MapContext.jsx';
import { useSheetOffset } from '../../components/map/useSheetOffset.js';
import { toLatLng } from '../../components/map/geo.js';
import { createTracker } from '../../navigation/tracker.js';
import { findStaleReport } from '../../navigation/staleReports.js';
import { useGeolocation } from '../../navigation/useGeolocation.js';
import { etaClock, pointsAlong } from '../../navigation/simulate.js';
import { speaker } from '../../accessibility/voice.js';
import { PATTERNS, vibrate } from '../../accessibility/vibrate.js';
import { usePrefs } from '../../accessibility/PrefsProvider.jsx';
import { usePhoneScreen } from '../../layout/useBreakpoint.js';
import { startRouteChecks } from '../../navigation/routeChecks.js';
import { reports as reportsApi, routes } from '../../api/endpoints.js';
import { USE_MOCKS } from '../../config/env.js';
import { formatDistance, formatDuration } from '../../lib/format.js';
import { metersSpoken } from '../../lib/ro.js';
import { prefersReducedMotion } from '../../accessibility/useReducedMotion.js';
import { categoryLabel } from '../../reports/categories.js';
import { CenterButton, InstructionCard, ManeuverIcon, ProgressSheet, VoiceButton } from './NavParts.jsx';
import Button, { ButtonLink } from '../../ui/Button.jsx';
import EmptyState from '../../ui/EmptyState.jsx';
import Spot from '../../ui/Spot.jsx';
import SkipLink from '../../layout/SkipLink.jsx';

const KEY = 'pcp_active_route';
const CHECK_EVERY_MS = 30000;

function loadActive() {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? 'null');
  } catch {
    return null;
  }
}

// În modul demo, „mersul” se simulează de-a lungul traseului, ca ecranul să poată fi arătat fără GPS.
function useSimulatedPosition(line, active) {
  const [position, setPosition] = useState(null);
  useEffect(() => {
    if (!active || !line) return undefined;
    const pts = pointsAlong(line, 12);
    let i = 0;
    setPosition({ lon: pts[0][0], lat: pts[0][1], accuracy: 8 });
    const t = setInterval(() => {
      i = Math.min(i + 1, pts.length - 1);
      setPosition({ lon: pts[i][0], lat: pts[i][1], accuracy: 8 });
      if (i === pts.length - 1) clearInterval(t);
    }, 1200);
    return () => clearInterval(t);
  }, [line, active]);
  return position;
}

function Arrived({ active }) {
  const d = active.data;
  return (
    <main id="continut" className="flex min-h-dvh flex-col justify-between gap-6 bg-bg px-4 py-8">
      <div role="status" className="flex flex-col items-center gap-3 text-center">
        <Spot kind="arrived" w={240} />
        <h1 className="m-0 text-display-sm">Ai ajuns!</h1>
        <p className="m-0 text-body-lg">{active.to?.name}</p>
        <div className="mt-2 flex gap-6 text-[18px]">
          <span>
            <b>{formatDuration(d.duration_min)}</b> pe drum
          </span>
          <span>
            <b>{formatDistance(d.length_m)}</b> fără trepte
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <ButtonLink to="/" variant="primary" full className="font-extrabold">
          Gata
        </ButtonLink>
        <ButtonLink to="/raporteaza" full>
          Am văzut o problemă pe drum
        </ButtonLink>
      </div>
    </main>
  );
}

function GpsDenied({ onSimulate, insecure }) {
  return (
    <main id="continut" className="flex min-h-dvh flex-col justify-center gap-5 bg-bg px-4 py-8">
      <EmptyState
        role="status"
        headingLevel={1}
        spot="gps"
        title="Nu știm unde ești"
        actions={
          <>
            <Button variant="primary" full onClick={() => window.location.reload()}>
              Permite accesul la locație
            </Button>
            {onSimulate && (
              <Button variant="secondary" full onClick={onSimulate}>
                Simulează mersul (demo)
              </Button>
            )}
            <ButtonLink to="/traseu" variant="text" full>
              Înapoi la traseu
            </ButtonLink>
          </>
        }
      >
        {insecure
          ? 'Browserul dă acces la locație doar pe conexiuni securizate (https). Deschide aplicația prin linkul https.'
          : 'Ai oprit accesul la locație. Îl folosim doar ca să te ghidăm pe drum. Ca să-l pornești: apasă pe iconița de lângă adresă și alege Locație → Permite.'}
      </EmptyState>
    </main>
  );
}

// D11: un singur pas mare pe ecran, fără hartă.
function Simplified({ steps, index, setIndex, toNext, onStop, onRepeat }) {
  const step = steps[index];
  return (
    <main id="continut" className="flex min-h-dvh flex-col gap-5 bg-surface px-4 pb-6 pt-5">
      <div className="flex items-center justify-between">
        <span className="text-[20px] font-extrabold">
          Pasul {index + 1} din {steps.length}
        </span>
        <button type="button" onClick={onStop} className="min-h-target px-2 text-[18px] font-bold underline underline-offset-2">
          Oprește
        </button>
      </div>
      <div aria-hidden="true" className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
        {steps.map((_, i) => (
          <span key={i} className={`h-2.5 rounded-chip ${i < index ? 'bg-success' : i === index ? 'bg-primary' : 'bg-border'}`} />
        ))}
      </div>
      <div aria-live="polite" className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
        <ManeuverIcon instruction={step.instruction} size="lg" />
        <h1 className="m-0 text-[36px] font-extrabold leading-[44px]">{step.instruction}</h1>
        {toNext != null && <p className="m-0 text-body-lg">Peste {metersSpoken(Math.round(toNext / 5) * 5)}.</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Button variant="secondary" icon={Repeat} onClick={onRepeat}>
          Repetă vocal
        </Button>
        <Button onClick={() => setIndex(Math.min(index + 1, steps.length - 1))} disabled={index === steps.length - 1}>
          Următorul
          <ChevronRight aria-hidden="true" className="h-6 w-6" strokeWidth={2.5} />
        </Button>
      </div>
    </main>
  );
}

function NavigationInner({ active, setActive }) {
  const navigate = useNavigate();
  const prefs = usePrefs();
  const { map, setMap } = useMapContext();
  // În modul mock pornim direct simularea pe http; altfel o pornește utilizatorul din ecranul fără GPS
  // (util la demo pe laptop, unde locația lipsește).
  const [simulate, setSimulate] = useState(USE_MOCKS && !window.isSecureContext);
  const geo = useGeolocation(!simulate);
  const simPos = useSimulatedPosition(active.data.route.coordinates, simulate);
  const position = simulate ? simPos : geo.position;

  const [view, setView] = useState({ index: 0, toNext: null, remaining: active.data.length_m });
  const [weakGps, setWeakGps] = useState(false);
  const [rerouting, setRerouting] = useState(null); // null | 'off_route' | 'blocked'
  const [proposal, setProposal] = useState(null); // ocol propus după o problemă nouă
  const [arrived, setArrived] = useState(false);
  const [stale, setStale] = useState(null);
  const [follow, setFollow] = useState(true);
  const [nearbyReports, setNearbyReports] = useState([]);
  const asked = useRef(new Set());
  const sheet = useRef(null);
  useSheetOffset(sheet, !prefs.simplified);

  const steps = active.data.steps;
  const tracker = useMemo(() => createTracker({ line: active.data.route.coordinates, steps }), [active, steps]);
  const speed = active.data.length_m / Math.max(1, active.data.duration_min); // metri pe minut

  const say = useCallback(
    (text, pattern = PATTERNS.turn) => {
      if (prefs.voice) speaker.speak(text);
      if (prefs.vibration) vibrate(pattern);
    },
    [prefs.voice, prefs.vibration],
  );

  const replan = useCallback(
    async (from, reason) => {
      setRerouting(reason);
      try {
        const data = await routes.plan({ start: from, end: active.to.point, mode: active.mode });
        return data;
      } catch {
        return null;
      }
    },
    [active],
  );

  // Rapoartele active din jurul traseului, pentru întrebarea „Încă e stricat?”.
  useEffect(() => {
    const xs = active.data.route.coordinates.map((c) => c[0]);
    const ys = active.data.route.coordinates.map((c) => c[1]);
    const pad = 0.002;
    const bbox = [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) + pad, Math.max(...ys) + pad].join(',');
    reportsApi
      .list({ bbox, status: 'in_lucru' })
      .then((r) => setNearbyReports(r.features))
      .catch(() => {});
  }, [active]);

  useEffect(() => {
    if (!position || arrived || rerouting) return;
    const e = tracker.update(position);
    if (e.type === 'weak_gps') {
      setWeakGps(true);
      return;
    }
    setWeakGps(false);
    if (e.type === 'arrived') {
      setArrived(true);
      say(`Ai ajuns la ${active.to.name}.`, PATTERNS.arrived);
      sessionStorage.removeItem(KEY);
      return;
    }
    if (e.type === 'off_route') {
      say('Ai ieșit de pe traseu. Recalculăm.', PATTERNS.alert);
      replan([position.lon, position.lat], 'off_route').then((data) => {
        setRerouting(null);
        if (data) setActive({ ...active, data });
      });
      return;
    }
    setView({ index: e.nextIndex, toNext: e.toNext_m, remaining: e.remaining_m });
    if (e.type === 'announce') say(`Peste ${metersSpoken(e.toNext_m)}, ${e.step.instruction.toLowerCase()}.`);
    if (!stale) {
      const r = findStaleReport([position.lon, position.lat], nearbyReports, new Date(), asked.current);
      if (r) {
        asked.current.add(r.id);
        setStale(r);
      }
    }
    if (follow && map) map.panTo(toLatLng([position.lon, position.lat]), { animate: !prefersReducedMotion() });
    // tracker-ul e recreat doar când traseul se schimbă
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position]);

  // La fiecare 30 de secunde: a apărut o problemă pe traseu? (D7)
  // Poziția stă într-un ref: dacă ar fi dependență, fiecare poziție GPS nouă (cam o dată pe secundă)
  // ar reporni ceasul și verificarea n-ar mai ajunge niciodată la 30 de secunde.
  const positionRef = useRef(position);
  positionRef.current = position;
  useEffect(
    () =>
      startRouteChecks({
        everyMs: CHECK_EVERY_MS,
        check: () => routes.check({ route: active.data.route }),
        getPosition: () => positionRef.current,
        onBlocked: async (res, pos) => {
          say('A apărut o problemă pe traseu.', PATTERNS.alert);
          const data = await replan([pos.lon, pos.lat], 'blocked');
          setProposal({ data, reason: res.reason });
        },
      }),
    [active, replan, say],
  );

  const stop = () => {
    speaker.stop();
    sessionStorage.removeItem(KEY);
    navigate('/traseu');
  };

  const overlay = (
    <>
      <RouteLine coords={active.data.route.coordinates} />
      <MarkersLayer
        cluster={false}
        items={[
          { id: 'dest', type: 'dest', point: active.data.route.coordinates.at(-1), label: `Destinație: ${active.to.name}` },
          ...(position ? [{ id: 'me', type: 'user', point: [position.lon, position.lat], label: 'Poziția ta' }] : []),
        ]}
      />
    </>
  );

  if (arrived) return <Arrived active={active} />;
  if (!simulate && (geo.status === 'denied' || geo.status === 'insecure' || geo.status === 'unavailable')) {
    return <GpsDenied insecure={geo.status === 'insecure'} onSimulate={() => setSimulate(true)} />;
  }

  const minutes = rerouting ? null : Math.max(1, Math.round(view.remaining / speed));
  const step = steps[Math.min(view.index, steps.length - 1)];
  const nextStep = steps[view.index + 1];

  if (prefs.simplified) {
    return (
      <Simplified
        steps={steps}
        index={view.index}
        setIndex={(i) => setView((v) => ({ ...v, index: i, toNext: null }))}
        toNext={view.toNext}
        onStop={stop}
        onRepeat={() => speaker.speak(step.instruction)}
      />
    );
  }

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-bg">
      <SkipLink />
      <h1 className="sr-only">Navigare spre {active.to.name}</h1>
      <div className="absolute inset-0" onPointerDown={() => setFollow(false)}>
        <MapView dark={prefs.theme === 'dark'} onReady={setMap} zoom={18} center={active.data.route.coordinates[0]} label="Harta traseului">
          {overlay}
        </MapView>
      </div>
      <div id="continut" className="absolute inset-x-3 top-3 z-[1050] flex flex-col gap-2.5">
        {rerouting === 'off_route' ? (
          <section role="status" aria-busy="true" className="flex flex-col gap-2 rounded-sheet bg-surface p-4 shadow-lg">
            <h2 className="m-0 text-title-3">Ai ieșit de pe traseu</h2>
            <p className="m-0 text-[18px]">Nicio grijă. Recalculăm drumul de unde ești acum, tot după profilul tău.</p>
            <span className="flex items-center gap-2 font-bold">
              <LoaderCircle aria-hidden="true" className="h-5 w-5 motion-safe:animate-spin" /> Recalculăm…
            </span>
          </section>
        ) : proposal ? (
          <section role="alert" className="flex flex-col gap-2 rounded-sheet border-2 border-warning bg-warning-bg p-4 shadow-lg">
            <h2 className="m-0 flex items-center gap-2 text-title-3">
              <TriangleAlert aria-hidden="true" className="h-6 w-6 text-warning" strokeWidth={2.5} />
              Problemă nouă pe traseu
            </h2>
            <p className="m-0 text-[18px]">{proposal.reason ?? 'Cineva a raportat o problemă pe drumul tău.'} {proposal.data ? 'Am găsit un ocol.' : 'Nu am găsit încă un ocol.'}</p>
            <div className="flex flex-wrap gap-2">
              {proposal.data && (
                <Button
                  onClick={() => {
                    setActive({ ...active, data: proposal.data });
                    setProposal(null);
                    setRerouting(null);
                  }}
                >
                  Folosește ocolul
                </Button>
              )}
              <Button
                variant="secondary"
                onClick={() => {
                  setProposal(null);
                  setRerouting(null);
                }}
              >
                Continuă pe traseul ăsta
              </Button>
            </div>
          </section>
        ) : (
          <InstructionCard step={step} nextStep={nextStep} toNext={view.toNext} />
        )}
        {weakGps && (
          <div role="alert" className="flex flex-col gap-1 rounded-card border-2 border-warning bg-warning-bg p-3.5 shadow-md">
            <span className="text-[18px] font-bold">
              <span className="text-warning">Atenție:</span> semnal GPS slab
            </span>
            <span className="text-[17px]">Poziția poate fi aproximativă. Ghidează-te după repere până revine semnalul.</span>
          </div>
        )}
        {stale && (
          <section aria-labelledby="stale-title" className="flex flex-col gap-2 rounded-card bg-surface p-4 shadow-lg hc:border-2 hc:border-border">
            <span className="text-caption text-ink-muted">
              {categoryLabel(stale.properties.category)} · {stale.properties.location_text}
            </span>
            <h2 id="stale-title" className="m-0 text-title-3">
              Încă e stricat?
            </h2>
            <p className="m-0 text-[17px]">Ești chiar lângă el. Răspunsul tău îi ajută pe ceilalți; navigarea continuă oricum.</p>
            {[
              ['inca_exista', 'Da, încă există'],
              ['rezolvat', 'A fost reparat'],
            ].map(([kind, label]) => (
              <Button
                key={kind}
                variant="secondary"
                full
                onClick={() => {
                  reportsApi.confirm(stale.id, kind).catch(() => {});
                  setStale(null);
                }}
              >
                {label}
              </Button>
            ))}
            <button type="button" onClick={() => setStale(null)} className="min-h-target text-[17px] font-semibold underline underline-offset-2">
              Nu sunt sigur, mai târziu
            </button>
          </section>
        )}
        <div className="flex gap-2">
          <VoiceButton on={prefs.voice} onToggle={() => prefs.setPref('voice', !prefs.voice)} />
          <CenterButton
            onClick={() => {
              setFollow(true);
              if (position && map) map.setView(toLatLng([position.lon, position.lat]), 18);
            }}
          />
        </div>
        {simulate && <span className="self-start rounded-chip bg-surface px-3 py-1 text-caption font-bold shadow-sm">Demo: mers simulat</span>}
      </div>
      <ProgressSheet
        sheetRef={sheet}
        minutes={minutes}
        distance={rerouting ? null : formatDistance(view.remaining)}
        eta={etaClock(minutes ?? 0)}
        onStop={stop}
      />
    </div>
  );
}

/**
 * Navigarea pas cu pas cu GPS (D4–D11). Doar pe telefon: de la 768 px trimitem la planificare.
 * Traseul vine din planificare (sessionStorage), ca un refresh să nu-l piardă.
 */
export default function NavigationPage() {
  const phoneScreen = usePhoneScreen();
  const [active, setActiveState] = useState(loadActive);
  const setActive = (a) => {
    setActiveState(a);
    try {
      sessionStorage.setItem(KEY, JSON.stringify(a));
    } catch {
      /* fără stocare */
    }
  };
  if (!phoneScreen) return <Navigate to="/traseu" replace />;
  if (!active?.data) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-bg p-6">
        <EmptyState
          headingLevel={1}
          spot="routeNone"
          title="Niciun traseu pornit"
          actions={
            <ButtonLink to="/traseu" variant="primary" full>
              Planifică un traseu
            </ButtonLink>
          }
        >
          Alege întâi unde vrei să ajungi, apoi apasă „Pornește”.
        </EmptyState>
      </main>
    );
  }
  return (
    <MapProvider>
      <NavigationInner active={active} setActive={setActive} />
      <Link to="/" className="sr-only">
        Înapoi la hartă
      </Link>
    </MapProvider>
  );
}

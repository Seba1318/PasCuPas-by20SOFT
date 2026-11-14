import { useEffect, useMemo, useRef, useState } from 'react';
import { useSheetOffset } from '../../components/map/useSheetOffset.js';
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import { Rectangle } from 'react-leaflet';
import { ArrowUpDown, Check, Info, Play, TriangleAlert, X } from 'lucide-react';
import L from 'leaflet';
import PlaceInput from './PlaceInput.jsx';
import { NoRoute, OutOfArea, RouteLoading } from './RouteStates.jsx';
import TransitLegs from './TransitLegs.jsx';
import { lastRoute } from '../../offline/lastRoute.js';
import { transitSummary } from './transitUtils.js';
import { useRoutePlan } from './useRoutePlan.js';
import { formatLonLat, parseLonLat, routeTags } from './routeUtils.js';
import RouteLine from '../../components/map/RouteLine.jsx';
import MarkersLayer from '../../components/map/MarkersLayer.jsx';
import { useMapContext, useMapOverlay } from '../../components/map/MapContext.jsx';
import { bboxToLatLngBounds, lineToLatLngs, toLatLng } from '../../components/map/geo.js';
import { PanelHeader } from '../../layout/SidePanel.jsx';
import { useProfile } from '../../profile/useProfile.js';
import { formatDistance, formatDuration } from '../../lib/format.js';
import { DEMO_BBOX } from '../../config/env.js';
import { ZONE_COLOR } from '../../theme/mapColors.js';
import { prefersReducedMotion } from '../../accessibility/useReducedMotion.js';
import { usePhoneScreen } from '../../layout/useBreakpoint.js';
import Button from '../../ui/Button.jsx';
import Alert from '../../ui/Alert.jsx';
import { Tag } from '../../ui/Chip.jsx';

const ME = 'Poziția ta';

function pointFromParams(params, key) {
  const point = parseLonLat(params.get(key));
  return point ? { name: params.get(`${key}Name`) || 'Punct ales pe hartă', point } : null;
}

function ModeSwitch({ mode, onChange }) {
  const opts = [
    ['walk', 'Pe jos'],
    ['transit', 'Cu transportul'],
  ];
  return (
    <fieldset className="m-0 flex rounded-field border-2 border-border-strong p-1">
      <legend className="sr-only">Mod de deplasare</legend>
      {opts.map(([value, label]) => (
        <label
          key={value}
          className={`flex h-12 flex-1 cursor-pointer items-center justify-center rounded-icon text-[17px] font-bold has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-focus ${
            mode === value ? 'bg-ink text-surface' : 'text-ink hover:bg-subtle'
          }`}
        >
          <input type="radio" name="mode" value={value} checked={mode === value} onChange={() => onChange(value)} className="sr-only" />
          {mode === value && <Check aria-hidden="true" className="mr-1.5 h-5 w-5" strokeWidth={3} />}
          {label}
        </label>
      ))}
    </fieldset>
  );
}

// D1, D2 (telefon), W10, W11 (desktop), W12 (tabletă): planificarea traseului.
export default function RoutePlanner() {
  const { breakpoint } = useOutletContext();
  const phone = breakpoint === 'phone';
  // Un telefon rotit primește layoutul de tabletă, dar poate porni în continuare navigarea.
  const canNavigate = usePhoneScreen();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const profile = useProfile();
  const { map, setUserPosition } = useMapContext();
  const [from, setFrom] = useState(() => pointFromParams(params, 'from'));
  const [to, setTo] = useState(() => pointFromParams(params, 'to'));
  const [mode, setMode] = useState(params.get('mode') === 'transit' ? 'transit' : 'walk');
  const [gpsNote, setGpsNote] = useState(null);
  const [step, setStep] = useState(null);
  const [retry, setRetry] = useState(0);
  const { status, data, error } = useRoutePlan(from, to, mode, retry);
  const sheet = useRef(null);
  useSheetOffset(sheet, phone);

  const useMyPosition = () => {
    if (!navigator.geolocation) {
      setGpsNote('Browserul nu oferă localizare. Scrie de unde pleci.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const point = [pos.coords.longitude, pos.coords.latitude];
        setUserPosition({ point, accuracy: pos.coords.accuracy });
        setFrom({ name: ME, point });
        setGpsNote(null);
      },
      () => setGpsNote('Nu știm unde ești: browserul nu are voie să folosească locația. Scrie de unde pleci sau alege un loc.'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  // Plecarea implicită: poziția utilizatorului.
  useEffect(() => {
    if (!from && (params.get('from') === 'me' || !params.get('from'))) useMyPosition();
    // doar la deschidere
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Punctele alese stau în URL, ca traseul să poată fi trimis ca link.
  useEffect(() => {
    const next = {};
    if (from) Object.assign(next, from.name === ME ? { from: 'me' } : { from: formatLonLat(from.point), fromName: from.name });
    if (to) Object.assign(next, { to: formatLonLat(to.point), toName: to.name });
    if (mode === 'transit') next.mode = 'transit';
    setParams(next, { replace: true });
  }, [from, to, mode, setParams]);

  // Desenul de pe hartă: traseul evitat (gri punctat, doar explicativ), traseul ales, capetele.
  const overlay = useMemo(() => {
    if (status === 'out_of_area') {
      return (
        <Rectangle
          bounds={bboxToLatLngBounds(DEMO_BBOX)}
          pathOptions={{ color: ZONE_COLOR, weight: 3, dashArray: '8 6', fill: false, interactive: false }}
        />
      );
    }
    if (status !== 'ok') return null;
    const marks = [
      { id: 'start', type: 'user', point: data.route.coordinates[0], label: `Plecare: ${from?.name}` },
      { id: 'dest', type: 'dest', point: data.route.coordinates.at(-1), label: `Destinație: ${to?.name}` },
    ];
    if (data.avoided?.stairs_at) {
      marks.push({ id: 'stairs', type: 'stairs', point: data.avoided.stairs_at, label: `Obstacol: ${data.avoided.reason}`, name: 'Scări' });
    }
    return (
      <>
        {data.avoided && <RouteLine coords={data.avoided.geometry.coordinates} variant="blocked" />}
        {data.legs ? (
          data.legs.map((leg, i) => (
            <RouteLine key={i} coords={leg.geometry.coordinates} variant={leg.type === 'transit' ? 'transit' : 'main'} />
          ))
        ) : (
          <RouteLine coords={data.route.coordinates} variant="main" />
        )}
        <MarkersLayer items={marks} cluster={false} />
      </>
    );
  }, [status, data, from, to, mode]);
  useMapOverlay('route', overlay);

  // Fiecare traseu calculat rămâne disponibil și fără conexiune (G8).
  useEffect(() => {
    if (status === 'ok') lastRoute.save({ from, to, mode, data });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, data]);

  useEffect(() => {
    if (!map) return;
    const animate = !prefersReducedMotion();
    if (status === 'ok') {
      map.fitBounds(L.latLngBounds(lineToLatLngs(data.route.coordinates)), {
        paddingTopLeft: phone ? [24, 220] : [48, 48],
        paddingBottomRight: phone ? [24, 320] : [48, 48],
        animate,
      });
    } else if (status === 'out_of_area') {
      map.fitBounds(bboxToLatLngBounds(DEMO_BBOX), { padding: [24, 24], animate });
    }
  }, [map, status, data, phone]);

  const focusStep = (i) => {
    setStep(i);
    const s = data.steps[i];
    if (map && s?.coord) map.setView(toLatLng(s.coord), 18, { animate: !prefersReducedMotion() });
  };

  const pickOther = () => {
    setTo(null);
    setTimeout(() => document.getElementById('route-to')?.focus(), 0);
  };

  const inputs = (
    <div className="flex flex-col gap-3">
      <div className="flex items-end gap-2">
        <div className="flex flex-1 flex-col gap-2.5">
          <PlaceInput
            id="route-from"
            label="De la"
            value={from}
            onChange={(v) => {
              setFrom(v);
              setGpsNote(null);
            }}
            onUseMyPosition={useMyPosition}
          />
          <PlaceInput id="route-to" label="Până la" value={to} onChange={setTo} />
        </div>
        <button
          type="button"
          onClick={() => {
            setFrom(to);
            setTo(from);
          }}
          disabled={!from && !to}
          className="flex min-h-[112px] w-[92px] flex-none flex-col items-center justify-center gap-1 rounded-field border-2 border-border-strong px-1 text-[15px] font-bold hover:bg-subtle disabled:opacity-50"
        >
          <ArrowUpDown aria-hidden="true" className="h-6 w-6" strokeWidth={2.5} />
          Inversează
          <span className="sr-only"> plecarea cu destinația</span>
        </button>
      </div>
      <ModeSwitch mode={mode} onChange={setMode} />
      {gpsNote && (
        <Alert tone="info" showKind={false} title="Alege de unde pleci">
          {gpsNote}
        </Alert>
      )}
    </div>
  );

  let content = null;
  if (status === 'idle') {
    content = (
      <p className="m-0 flex items-start gap-2 text-[18px] text-ink-muted">
        <Info aria-hidden="true" className="mt-1 h-5 w-5 flex-none" strokeWidth={2.5} />
        {to ? 'Alege de unde pleci.' : 'Alege unde vrei să ajungi: scrie un loc sau o adresă din zonă.'}
      </p>
    );
  } else if (status === 'loading') content = <RouteLoading profile={profile} />;
  // Cu transportul, 404 înseamnă „nicio linie potrivită acum”, nu că locul e inaccesibil (G1).
  else if (status === 'no_route' && mode === 'transit') {
    content = (
      <Alert tone="info" title="nicio linie potrivită" actions={<Button size="sm" variant="secondary" onClick={() => setMode('walk')}>Vezi traseul pe jos</Button>}>
        {error}
      </Alert>
    );
  } else if (status === 'no_route') content = <NoRoute from={from} to={to} onPickOther={pickOther} />;
  else if (status === 'out_of_area') content = <OutOfArea onPickOther={pickOther} />;
  else if (status === 'error') {
    content = (
      <Alert tone="error" urgent title="nu am putut calcula traseul" actions={<Button size="sm" variant="secondary" onClick={() => setRetry((n) => n + 1)}>Încearcă din nou</Button>}>
        {error}
      </Alert>
    );
  } else {
    const tags = routeTags(data, profile);
    content = (
      <section aria-labelledby="route-summary" className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col">
            <h2 id="route-summary" className="m-0 text-[32px] font-extrabold leading-10">
              {formatDuration(data.duration_min)}
            </h2>
            <span className="text-[18px] text-ink-muted">
              {data.legs ? transitSummary(data.legs, profile) : `${formatDistance(data.length_m)} · pe jos`}
            </span>
          </div>
          {canNavigate && (
            <Button
              icon={Play}
              className="font-extrabold"
              onClick={() => {
                lastRoute.save({ from, to, mode, data });
                try {
                  sessionStorage.setItem('pcp_active_route', JSON.stringify({ from, to, mode, data }));
                } catch {
                  /* fără stocare: navigarea recalculează */
                }
                navigate('/navigare');
              }}
            >
              Pornește
            </Button>
          )}
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {tags.map((t) => (
              <Tag key={t.text} tone={t.tone} icon={t.tone === 'success' ? Check : TriangleAlert}>
                {t.text}
              </Tag>
            ))}
          </div>
        )}
        {data.explanation && (
          <p className="m-0 flex items-start gap-2 rounded-field bg-info-bg p-3 text-[17px] leading-6">
            <Info aria-hidden="true" className="mt-0.5 h-5 w-5 flex-none text-info-strong" strokeWidth={2.5} />
            {data.explanation}
          </p>
        )}
        {!phone && data.avoided && (
          <div role="radiogroup" aria-label="Variante" className="grid grid-cols-2 gap-2.5">
            <button type="button" role="radio" aria-checked="true" className="flex flex-col items-start rounded-card border-[3px] border-ink bg-peach p-3 text-left">
              <span className="flex items-center gap-1 text-[16px] font-bold text-success">
                <Check aria-hidden="true" className="h-4 w-4" strokeWidth={3} />
                Fără trepte
              </span>
              <span className="text-[22px] font-extrabold">{formatDuration(data.duration_min)}</span>
              <span className="text-caption text-ink-muted">{formatDistance(data.length_m)}</span>
            </button>
            <button type="button" role="radio" aria-checked="false" aria-disabled="true" className="flex cursor-not-allowed flex-col items-start rounded-card border-2 border-line-soft bg-subtle p-3 text-left text-ink-muted">
              <span className="flex items-center gap-1 text-[16px] font-bold">
                <X aria-hidden="true" className="h-4 w-4" strokeWidth={3} />
                Are scări
              </span>
              <span className="text-[22px] font-extrabold">{formatDuration(Math.max(1, data.duration_min - 2))}</span>
              <span className="text-caption">{formatDistance(data.length_m - (data.extra_m ?? 0))} · nu se potrivește</span>
            </button>
          </div>
        )}
        {data.legs ? (
          <TransitLegs legs={data.legs} />
        ) : (
        <details open={!phone} className="group">
          <summary className="flex min-h-target cursor-pointer items-center text-[20px] font-bold">Pașii traseului</summary>
          <ol className="m-0 flex list-none flex-col gap-1 p-0">
            {data.steps.map((s, i) => (
              <li key={i}>
                <button
                  type="button"
                  aria-current={step === i ? 'step' : undefined}
                  onClick={() => focusStep(i)}
                  className={`flex min-h-14 w-full items-start gap-3 rounded-field border-2 p-2 text-left ${step === i ? 'border-info bg-info-bg' : 'border-transparent hover:bg-subtle'}`}
                >
                  <span className={`flex h-8 w-8 flex-none items-center justify-center rounded-chip text-[16px] font-extrabold ${step === i ? 'bg-info text-surface' : 'bg-subtle'}`}>
                    {i + 1}
                  </span>
                  <span className="flex flex-1 flex-col">
                    <span className="text-[17px] font-semibold leading-6">{s.instruction}</span>
                    {s.distance_m > 0 && <span className="text-caption text-ink-muted">{formatDistance(s.distance_m)}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </details>
        )}
        {!phone && (
          <div className="flex flex-col gap-1.5">
            <Button
              variant="secondary"
              full
              onClick={() => focusStep(step == null ? 0 : (step + 1) % data.steps.length)}
            >
              {step == null ? 'Previzualizează pas cu pas' : 'Pasul următor'}
            </Button>
            {!canNavigate && <span className="text-caption text-ink-muted">Navigarea cu GPS e disponibilă în aplicația de pe telefon.</span>}
          </div>
        )}
      </section>
    );
  }

  if (phone) {
    return (
      <>
        <h1 className="sr-only">Traseu</h1>
        <section aria-label="Alege traseul" className="absolute inset-x-3 top-3 z-[860] rounded-card bg-surface p-3 shadow-lg hc:border-2 hc:border-border">
          {inputs}
        </section>
        <section
          ref={sheet}
          aria-label="Traseul"
          className="absolute inset-x-0 bottom-0 z-[850] flex max-h-[48%] flex-col gap-3 overflow-y-auto rounded-t-sheet bg-surface px-4 pb-5 pt-2 shadow-lg hc:border-t-[3px] hc:border-border"
        >
          <span aria-hidden="true" className="mx-auto mb-1 h-[5px] w-11 flex-none rounded-chip bg-route-blocked" />
          {content}
        </section>
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-6 py-5">
      <PanelHeader title="Traseu" />
      {inputs}
      {content}
    </div>
  );
}

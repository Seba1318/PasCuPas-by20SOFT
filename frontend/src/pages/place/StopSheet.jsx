import { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import { Accessibility, Check, Footprints, MonitorSmartphone, Volume2, X } from 'lucide-react';
import MapSheet from './MapSheet.jsx';
import { arrivalSuitability, etaText, stopFeatures } from './sheetUtils.js';
import { transit } from '../../api/endpoints.js';
import { DEMO_BBOX } from '../../config/env.js';
import { useFocusPoint } from '../../components/map/useFocusPoint.jsx';
import { useMapContext } from '../../components/map/MapContext.jsx';
import { distanceM } from '../../components/map/geo.js';
import { useProfile } from '../../profile/useProfile.js';
import { formatDistance } from '../../lib/format.js';
import Skeleton from '../../ui/Skeleton.jsx';
import Alert from '../../ui/Alert.jsx';

const VEHICLE_FEATURES = [
  ['ramp', 'Rampă', Accessibility, (v) => v.has_ramp && v.ramp_ok !== false],
  ['low', 'Podea joasă', Footprints, (v) => v.low_floor],
  ['audio', 'Anunțuri sonore', Volume2, (v) => v.has_audio_announce && v.audio_ok !== false],
  ['screen', 'Afișaj', MonitorSmartphone, (v) => v.has_visual_display],
];

function VehicleFeatures({ vehicle, dim }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {VEHICLE_FEATURES.map(([key, label, Icon, has]) => {
        const ok = has(vehicle);
        return (
          <span
            key={key}
            className={`inline-flex items-center gap-1 rounded-chip border-2 px-2 py-0.5 text-[15px] font-semibold ${
              ok ? (dim ? 'border-line-soft bg-subtle text-ink-muted' : 'border-success bg-success-bg text-success') : 'border-line-soft bg-surface text-ink-muted line-through'
            }`}
          >
            <Icon aria-hidden="true" className="h-4 w-4" strokeWidth={2.5} />
            {label}
            <span className="sr-only">{ok ? ': da' : ': nu'}</span>
          </span>
        );
      })}
    </div>
  );
}

// C7 (telefon) și W8 (desktop): stația, dotările ei și următoarele sosiri.
// ['autobuz', 'troleibuz'] → „Autobuz și troleibuz” (tipurile de linii care opresc aici).
function modesText(modes) {
  if (!modes?.length) return 'Transport public';
  const text = modes.length === 1 ? modes[0] : `${modes.slice(0, -1).join(', ')} și ${modes.at(-1)}`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export default function StopSheet() {
  const { id } = useParams();
  const { breakpoint } = useOutletContext();
  const { userPosition } = useMapContext();
  const profile = useProfile();
  const [stop, setStop] = useState(null);
  const [arrivals, setArrivals] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setStop(null);
    setArrivals(null);
    Promise.all([transit.stops({ bbox: DEMO_BBOX.join(',') }), transit.arrivals(id)])
      .then(([stops, arr]) => {
        if (cancelled) return;
        setStop(stops.features.find((s) => String(s.id) === String(id)) ?? null);
        setArrivals(arr);
      })
      .catch((err) => !cancelled && setError(err.detail));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const focus = useMemo(
    () => stop && { id: `stop-${stop.id}`, type: 'station', point: stop.geometry.coordinates, label: `Stația ${stop.properties.name}, selectată` },
    [stop],
  );
  useFocusPoint(focus);

  const H = breakpoint === 'phone' ? 'h2' : 'h1';
  let body;
  if (error) body = <Alert tone="error" title="nu am putut încărca stația">{error}</Alert>;
  else if (!stop || !arrivals) body = <Skeleton text="Se încarcă sosirile…" />;
  else {
    const dist = userPosition ? ` · la ${formatDistance(distanceM(userPosition.point, stop.geometry.coordinates))}` : '';
    body = (
      <>
        <div className="flex flex-col gap-0.5">
          <span className="text-caption font-bold uppercase tracking-wide text-ink-muted">Stație</span>
          <H className="m-0 text-title-3 md:text-title-2">Stația {stop.properties.name}</H>
          <span className="text-caption text-ink-muted">{modesText(stop.properties.modes)}{dist}</span>
        </div>
        <ul aria-label="Dotările stației" className="m-0 flex list-none flex-wrap gap-2 p-0">
          {stopFeatures(stop.properties).map((f) => (
            <li
              key={f.label}
              className={`inline-flex items-center gap-1.5 rounded-chip px-3 py-1.5 text-caption font-bold ${f.ok ? 'bg-success-bg text-success' : 'bg-subtle text-ink-muted'}`}
            >
              {f.ok ? <Check aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={3} /> : <X aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={3} />}
              {f.label}
            </li>
          ))}
        </ul>
        <h3 className="m-0 text-[20px] font-bold">Următoarele sosiri</h3>
        {arrivals.length === 0 ? (
          <p className="m-0 text-ink-muted">Nu avem sosiri în următoarea oră.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
            {arrivals.map((a) => {
              const fit = arrivalSuitability(a.vehicle, profile);
              return (
                <li
                  key={a.trip_id}
                  className={`flex flex-col gap-2 rounded-card border-2 p-3.5 ${fit.ok ? 'border-border bg-surface' : 'border-line-soft bg-subtle text-ink-muted'}`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-11 min-w-11 flex-none items-center justify-center rounded-icon px-2 text-[20px] font-extrabold ${fit.ok ? 'bg-primary text-on-primary' : 'border-2 border-line-soft bg-subtle text-ink-muted'}`}
                    >
                      {a.route}
                    </span>
                    <span className="flex-1 text-[18px] font-semibold">
                      {a.type} {a.route} · spre {a.headsign}
                    </span>
                    <span className="text-[18px] font-extrabold">{etaText(a.arrival_time)}</span>
                  </div>
                  <VehicleFeatures vehicle={a.vehicle} dim={!fit.ok} />
                  {!fit.ok && <span className="text-caption font-semibold">Nu se potrivește profilului tău: {fit.reason.toLowerCase()}</span>}
                </li>
              );
            })}
          </ul>
        )}
        <span className="text-caption text-ink-muted">Ore estimate după orar. Pot apărea mici întârzieri.</span>
        <Link to={`/raporteaza?categorie=dotare_vehicul&statie=${stop.id}`} className="inline-flex min-h-target items-center text-[18px] font-semibold">
          Raportează o problemă la un vehicul
        </Link>
      </>
    );
  }
  return (
    <MapSheet breakpoint={breakpoint} label="Fișa stației" backLabel={breakpoint === 'phone' ? 'Înapoi' : 'Înapoi la hartă'}>
      {body}
    </MapSheet>
  );
}

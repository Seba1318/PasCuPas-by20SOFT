import { useEffect, useMemo, useState } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { Check, CircleHelp, Route, TriangleAlert, X } from 'lucide-react';
import MapSheet from './MapSheet.jsx';
import { placeFeatures } from './sheetUtils.js';
import { places } from '../../api/endpoints.js';
import { useFocusPoint } from '../../components/map/useFocusPoint.jsx';
import { useMapContext } from '../../components/map/MapContext.jsx';
import { markerTypeFor } from '../../components/map/markerSvg.js';
import { distanceM } from '../../components/map/geo.js';
import { useProfile } from '../../profile/useProfile.js';
import { formatDistance, formatRelative } from '../../lib/format.js';
import { ButtonLink } from '../../ui/Button.jsx';
import Skeleton from '../../ui/Skeleton.jsx';
import Alert from '../../ui/Alert.jsx';

const CATEGORY_NAMES = {
  ramp: 'Rampă', lift: 'Lift', entrance: 'Intrare accesibilă', toilet: 'Toaletă accesibilă',
  parking: 'Parcare pentru persoane cu dizabilități', tactile: 'Ghidaj tactil', audio_signal: 'Semafor sonor', bench: 'Bancă',
};

const STATE = {
  yes: { Icon: Check, cls: 'bg-success-bg text-success' },
  no: { Icon: X, cls: 'bg-subtle text-ink-muted' },
  unknown: { Icon: CircleHelp, cls: 'bg-subtle text-ink-muted' },
};

// C6 (telefon) și W9 (desktop): fișa de accesibilitate a unui loc.
export default function PlaceSheet() {
  const { id } = useParams();
  const { breakpoint } = useOutletContext();
  const { userPosition } = useMapContext();
  const profile = useProfile();
  const [state, setState] = useState({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    places
      .get(id)
      .then((f) => !cancelled && setState({ status: 'ok', f }))
      .catch((err) => !cancelled && setState({ status: 'error', error: err.detail }));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const f = state.f;
  const focus = useMemo(
    () =>
      f && {
        id: `place-${f.id}`,
        type: markerTypeFor(f.properties.category),
        point: f.geometry.coordinates,
        label: `${f.properties.name}, selectat`,
      },
    [f],
  );
  useFocusPoint(focus);

  let body;
  if (state.status === 'loading') body = <Skeleton text="Se încarcă fișa…" />;
  else if (state.status === 'error') body = <Alert tone="error" title="nu am putut deschide fișa">{state.error}</Alert>;
  else {
    const p = f.properties;
    const a = p.attributes ?? {};
    const [lon, lat] = f.geometry.coordinates;
    const dist = userPosition ? ` · la ${formatDistance(distanceM(userPosition.point, f.geometry.coordinates))} de tine` : '';
    const rows = p.category === 'building' ? placeFeatures(a, profile) : [];
    const kind = a.kind ?? CATEGORY_NAMES[p.category] ?? 'Loc';
    const H = breakpoint === 'phone' ? 'h2' : 'h1';
    body = (
      <>
        <div className="flex flex-col gap-0.5">
          <span className="text-caption font-bold uppercase tracking-wide text-ink-muted">{kind}</span>
          <H className="m-0 text-title-3 md:text-title-2">{p.name}</H>
          {(a.address || dist) && (
            <span className="text-caption text-ink-muted">
              {a.address}
              {dist}
            </span>
          )}
        </div>
        {rows.length > 0 && (
          <ul className="m-0 list-none p-0">
            {rows.map((r) => {
              const s = STATE[r.state];
              return (
                <li key={r.label} className="flex min-h-[60px] items-center gap-3 border-t border-border py-2">
                  <span className={`flex h-9 w-9 flex-none items-center justify-center rounded-chip ${s.cls}`}>
                    <s.Icon aria-hidden="true" className="h-5 w-5" strokeWidth={3} />
                  </span>
                  <span className="flex flex-1 flex-col">
                    <span className="text-[18px] font-semibold">{r.label}</span>
                    {r.note && <span className="text-caption text-ink-muted">{r.note}</span>}
                  </span>
                  <span className="text-[18px] font-bold">{r.value}</span>
                </li>
              );
            })}
          </ul>
        )}
        {a.updated_at && (
          <span className="text-caption text-ink-muted">Fișă confirmată de comunitate · actualizată {formatRelative(a.updated_at)}</span>
        )}
        <div className="flex flex-col gap-2.5">
          <ButtonLink to={`/traseu?to=${lon},${lat}&toName=${encodeURIComponent(p.name)}`} variant="primary" icon={Route} full className="font-extrabold">
            Planifică traseu aici
          </ButtonLink>
          <ButtonLink to={`/raporteaza?lon=${lon}&lat=${lat}&loc=${encodeURIComponent(p.name)}`} icon={TriangleAlert} full>
            Raportează o problemă aici
          </ButtonLink>
        </div>
      </>
    );
  }

  return (
    <MapSheet breakpoint={breakpoint} label="Fișa locului" backLabel={breakpoint === 'phone' ? 'Înapoi' : 'Înapoi la hartă'}>
      {body}
    </MapSheet>
  );
}

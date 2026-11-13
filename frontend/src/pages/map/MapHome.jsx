import { useEffect, useMemo, useState } from 'react';
import SearchResults from '../search/SearchResults.jsx';
import Spot from '../../ui/Spot.jsx';
import { ButtonLink } from '../../ui/Button.jsx';
import { Link, useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useMapContext, useMapOverlay } from '../../components/map/MapContext.jsx';
import MarkersLayer from '../../components/map/MarkersLayer.jsx';
import WorksLayer from '../../components/map/WorksLayer.jsx';
import { markerTypeFor } from '../../components/map/markerSvg.js';
import { bboxFromBounds } from '../../components/map/geo.js';
import { PanelHeader } from '../../layout/SidePanel.jsx';
import Alert from '../../ui/Alert.jsx';
import LayerChips from './LayerChips.jsx';
import { DEFAULT_LAYERS, toggleLayer, visiblePlaces } from './layers.js';
import { useMapData } from './useMapData.js';
import { categoryLabel } from '../../reports/categories.js';

// Numele scurte afișate sub locurile importante (design/C1).
const SHORT_NAMES = {
  'Rectoratul UPT': 'Rectoratul UPT',
  'Universitatea de Vest': 'UVT',
  'Facultatea de Automatică și Calculatoare': 'AC',
  'UMF „Victor Babeș”': 'UMF',
  'Căminul 1': 'Căminul 1',
  'Cantina Complexului Studențesc': 'Cantina',
};

function useBbox() {
  const { map } = useMapContext();
  const [bbox, setBbox] = useState(null);
  useEffect(() => {
    if (!map) return undefined;
    const update = () => setBbox(bboxFromBounds(map.getBounds()));
    update();
    map.on('moveend', update);
    return () => map.off('moveend', update);
  }, [map]);
  return bbox;
}

// C1 (telefon) și W5 (desktop): harta cu dotări, probleme, lucrări și stații.
export default function MapHome() {
  const { breakpoint } = useOutletContext();
  const phone = breakpoint === 'phone';
  const bbox = useBbox();
  const { places, reports, works, stops, status, error } = useMapData(bbox);
  const [active, setActive] = useState(DEFAULT_LAYERS);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const query = params.get('q') ?? '';

  const items = useMemo(() => {
    const out = visiblePlaces(places, active).map((f) => ({
      id: `place-${f.id}`,
      type: markerTypeFor(f.properties.category),
      point: f.geometry.coordinates,
      label: [f.properties.name, f.properties.attributes?.address].filter(Boolean).join(', '),
      name: SHORT_NAMES[f.properties.name],
      title: f.properties.name,
      subtitle: f.properties.attributes?.address,
      to: `/loc/${f.id}`,
    }));
    if (active.has('statii')) {
      for (const s of stops) {
        out.push({ id: `stop-${s.id}`, type: 'station', point: s.geometry.coordinates, label: `Stația ${s.properties.name}`, title: `Stația ${s.properties.name}`, to: `/statie/${s.id}` });
      }
    }
    if (active.has('probleme')) {
      for (const r of reports) {
        const p = r.properties;
        const label = `Problemă: ${categoryLabel(p.category).toLowerCase()}, ${p.location_text}`;
        out.push({ id: `report-${r.id}`, type: 'problem', point: r.geometry.coordinates, label, title: categoryLabel(p.category), subtitle: `${p.location_text} · ${p.public_code}`, to: `/raport/${p.public_code}` });
      }
    }
    return out;
  }, [places, stops, reports, active]);

  const markers = useMemo(
    () => <MarkersLayer items={items} onSelect={(it) => navigate(it.to)} />,
    [items, navigate],
  );
  useMapOverlay('home-markers', markers);
  const worksLayer = useMemo(() => (active.has('lucrari') ? <WorksLayer works={works} /> : null), [works, active]);
  useMapOverlay('home-works', worksLayer);

  const onToggle = (id) => setActive((a) => toggleLayer(a, id));
  // G12: stratul „Probleme” e pornit, dar în zona vizibilă nu e nicio problemă activă.
  const allClear = status === 'ready' && active.has('probleme') && reports.length === 0 && (
    <section role="status" className="flex flex-col items-center gap-2 rounded-card bg-surface p-4 text-center shadow-lg hc:border-2 hc:border-border">
      <Spot kind="allClear" w={120} />
      <h2 className="m-0 text-title-3">Nicio problemă raportată în zonă</h2>
      <p className="m-0 text-[17px] text-ink-muted">Drumurile din jur arată bine acum. Dacă vezi ceva, spune-ne.</p>
      <div className="grid w-full grid-cols-2 gap-2">
        <ButtonLink to="/raporteaza" size="sm" variant="primary">
          Raportează
        </ButtonLink>
        <ButtonLink to="/traseu" size="sm">
          Planifică traseu
        </ButtonLink>
      </div>
    </section>
  );
  const errorBox = status === 'error' && (
    <Alert tone="error" title="nu am putut încărca punctele de pe hartă">
      {error} Harta de fundal rămâne disponibilă.
    </Alert>
  );

  if (phone) {
    return (
      <>
        <h1 className="sr-only">Harta zonei</h1>
        <div className="pointer-events-none absolute inset-x-0 top-4 z-[800] flex flex-col gap-2.5">
          <div className="pointer-events-auto px-4">
            <Link
              to="/cauta"
              className="flex h-14 items-center gap-2.5 rounded-field bg-surface px-4 text-ink no-underline shadow-md hover:text-ink hc:border-2 hc:border-border"
            >
              <Search aria-hidden="true" className="h-6 w-6" strokeWidth={2.5} />
              <span className="flex-1 text-[18px] font-semibold">Unde mergi?</span>
            </Link>
          </div>
          <div className="pointer-events-auto">
            <LayerChips variant="row" active={active} onToggle={onToggle} count={7} />
          </div>
          {errorBox && <div className="pointer-events-auto px-4">{errorBox}</div>}
        </div>
        {allClear && <div className="absolute inset-x-4 bottom-28 z-[850]">{allClear}</div>}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-3.5 px-6 py-5">
      <PanelHeader title="Hartă" />
      <LayerChips active={active} onToggle={onToggle} />
      {errorBox}
      {allClear}
      {query.trim() ? (
        <SearchResults query={query} />
      ) : (
      <details className="group">
        <summary className="flex min-h-target cursor-pointer items-center text-[18px] font-bold">
          Vezi ca listă ({items.length})
        </summary>
        <ul className="m-0 list-none p-0">
          {items.map((it) => (
            <li key={it.id} className="border-t border-border">
              <Link to={it.to} className="flex min-h-[60px] w-full flex-col justify-center text-ink no-underline hover:bg-subtle hover:text-ink">
                <span className="text-[18px] font-semibold">{it.title}</span>
                {it.subtitle && <span className="text-caption text-ink-muted">{it.subtitle}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </details>
      )}
    </div>
  );
}

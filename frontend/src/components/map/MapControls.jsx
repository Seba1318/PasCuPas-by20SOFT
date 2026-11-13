import { useState } from 'react';
import { BookOpen, LocateFixed, Minus, Plus } from 'lucide-react';
import { useMapContext } from './MapContext.jsx';
import { toLatLng } from './geo.js';
import { useToast } from '../../ui/Toast.jsx';

const CONTROL =
  'flex h-12 items-center gap-2 rounded-field bg-surface px-3.5 text-[17px] font-bold text-ink shadow-md hover:bg-subtle hc:border-2 hc:border-border';

export function usePositionMe() {
  const { map, setUserPosition } = useMapContext();
  const { show } = useToast();
  const [busy, setBusy] = useState(false);

  const locate = () => {
    if (!navigator.geolocation) {
      show({ tone: 'error', title: 'Poziția nu e disponibilă', message: 'Browserul nu oferă localizare. Alege punctul pe hartă.' });
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBusy(false);
        const point = [pos.coords.longitude, pos.coords.latitude];
        setUserPosition({ point, accuracy: pos.coords.accuracy });
        map?.setView(toLatLng(point), Math.max(map.getZoom(), 17));
      },
      () => {
        setBusy(false);
        show({
          tone: 'error',
          title: 'Nu am putut afla unde ești',
          message: 'Verifică dacă browserul are voie să folosească locația. Poți alege punctul și pe hartă.',
        });
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };
  return { locate, busy };
}

function PositionButton({ className = '' }) {
  const { locate, busy } = usePositionMe();
  return (
    <button type="button" onClick={locate} aria-busy={busy || undefined} className={`${CONTROL} ${className}`}>
      <LocateFixed aria-hidden="true" className="h-[22px] w-[22px]" strokeWidth={2.5} />
      {busy ? 'Se caută…' : 'Poziția mea'}
    </button>
  );
}

function LegendButton({ className = '' }) {
  const { legendOpen, setLegendOpen } = useMapContext();
  return (
    <button
      type="button"
      aria-expanded={legendOpen}
      aria-keyshortcuts="L"
      onClick={() => setLegendOpen(!legendOpen)}
      className={`flex h-[52px] items-center gap-2 rounded-field border-2 border-ink bg-surface px-4 text-[17px] font-bold text-ink shadow-md hover:bg-subtle ${className}`}
    >
      <BookOpen aria-hidden="true" className="h-[22px] w-[22px]" strokeWidth={2.5} />
      Legendă
    </button>
  );
}

// Controalele hărții, toate cu text (design/W5, C1). Telefon: jos; desktop: dreapta-sus + legendă jos.
export default function MapControls({ breakpoint }) {
  const { map, legendOpen } = useMapContext();
  if (breakpoint === 'phone') {
    return (
      <>
        <LegendButton className="absolute bottom-9 left-4 z-[800]" />
        <PositionButton className="absolute bottom-9 right-4 z-[800] h-[52px]" />
      </>
    );
  }
  return (
    <>
      <div className="absolute right-6 top-6 z-[800] flex flex-col items-stretch gap-2">
        <button type="button" aria-keyshortcuts="+" onClick={() => map?.zoomIn()} className={CONTROL}>
          <Plus aria-hidden="true" className="h-[22px] w-[22px]" strokeWidth={2.75} />
          Mărește
        </button>
        <button type="button" aria-keyshortcuts="-" onClick={() => map?.zoomOut()} className={CONTROL}>
          <Minus aria-hidden="true" className="h-[22px] w-[22px]" strokeWidth={2.75} />
          Micșorează
        </button>
        <PositionButton />
      </div>
      {!legendOpen && <LegendButton className="absolute bottom-9 right-6 z-[800]" />}
    </>
  );
}

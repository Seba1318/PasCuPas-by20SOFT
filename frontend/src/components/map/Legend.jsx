import { Pin, PinOff, X } from 'lucide-react';
import { markerSvg } from './markerSvg.js';
import { useMapContext } from './MapContext.jsx';
import { usePrefs } from '../../accessibility/PrefsProvider.jsx';
import { ROUTE_COLORS, WORKS_COLORS } from '../../theme/mapColors.js';
import Dialog from '../../ui/Dialog.jsx';

const AMENITIES = [
  ['ramp', 'Rampă'], ['lift', 'Lift'], ['entrance', 'Intrare accesibilă'], ['wc', 'Toaletă'],
  ['parking', 'Parcare'], ['tactile', 'Ghidaj tactil'], ['sound', 'Semafor sonor'], ['bench', 'Bancă'],
];
const ROWS = [
  ['station', 'Stație', 'Pătrat albastru deschis'],
  ['place', 'Loc cu fișă', 'Romb lavandă, cu detalii'],
  ['user', 'Poziția ta', 'Punct albastru'],
  ['problem', 'Problemă raportată', 'Triunghi galben, ca un indicator'],
  ['stairs', 'Scări', 'Pătrat închis cu trepte: obstacol'],
];

function useRouteColors() {
  const { theme, contrast } = usePrefs();
  return ROUTE_COLORS[contrast === 'high' ? 'high' : theme];
}

function MarkerPreview({ type, size = 48 }) {
  const { contrast } = usePrefs();
  return (
    <span
      aria-hidden="true"
      className="inline-block flex-none"
      style={{ width: size, height: size }}
      // SVG generat local din markerSvg, fără date de la utilizator
      dangerouslySetInnerHTML={{ __html: markerSvg({ type, highContrast: contrast === 'high' }).replace('width="48" height="48"', `width="${size}" height="${size}"`) }}
    />
  );
}

function LinePreview({ kind }) {
  const c = useRouteColors();
  const lines = {
    main: [{ stroke: c.casing, w: 12 }, { stroke: c.route, w: 7 }],
    alt: [{ stroke: c.route, w: 5, op: 0.5 }],
    transit: [{ stroke: c.casing, w: 12 }, { stroke: c.route, w: 7 }, { stroke: c.casing, w: 3, dash: '0.1 9' }],
    blocked: [{ stroke: c.blocked, w: 5, dash: '0.1 9' }],
  }[kind];
  return (
    <svg width="56" height="24" viewBox="0 0 56 24" aria-hidden="true" className="flex-none">
      {lines.map((l, i) => (
        <path key={i} d="M4 12 H52" fill="none" stroke={l.stroke} strokeWidth={l.w} strokeOpacity={l.op ?? 1} strokeDasharray={l.dash} strokeLinecap="round" />
      ))}
    </svg>
  );
}

function WorksPreview() {
  return (
    <svg width="56" height="24" viewBox="0 0 56 24" aria-hidden="true" className="flex-none">
      <rect x="2" y="4" width="52" height="16" rx="4" fill="url(#pcp-works-hatch)" stroke={WORKS_COLORS.outline} strokeWidth="2" strokeDasharray="5 3" />
    </svg>
  );
}

function Row({ preview, name, desc }) {
  return (
    <li className="flex min-h-[52px] items-center gap-3.5 border-t border-border">
      <div className="flex w-14 flex-none justify-center">{preview}</div>
      <div className="flex flex-col">
        <span className="text-[17px] font-bold">{name}</span>
        {desc && <span className="text-caption text-ink-muted">{desc}</span>}
      </div>
    </li>
  );
}

// Conținutul complet (design/C2), refolosit în foaia de pe telefon.
function LegendFull() {
  return (
    <>
      <h3 className="mb-0.5 mt-2 text-[18px] font-bold text-ink-muted">Trasee</h3>
      <ul className="m-0 list-none p-0">
        <Row preview={<LinePreview kind="main" />} name="Traseul tău" desc="Linie coral groasă, cu margine" />
        <Row preview={<LinePreview kind="alt" />} name="Traseu alternativ" desc="Coral mai pal și mai subțire" />
        <Row preview={<LinePreview kind="transit" />} name="Cu transportul public" desc="Coral cu puncte" />
        <Row preview={<LinePreview kind="blocked" />} name="Mai scurt, dar inaccesibil" desc="Gri, din puncte" />
      </ul>
      <h3 className="mb-1.5 mt-3 text-[18px] font-bold text-ink-muted">Dotări · cerc alb</h3>
      <ul className="m-0 grid list-none grid-cols-4 gap-x-1.5 gap-y-1 p-0">
        {AMENITIES.map(([type, name]) => (
          <li key={type} className="flex flex-col items-center gap-0.5 text-center">
            <MarkerPreview type={type} />
            <span className="text-[15px] font-semibold leading-[19px]">{name}</span>
          </li>
        ))}
      </ul>
      <h3 className="mb-0.5 mt-3 text-[18px] font-bold text-ink-muted">Locuri, probleme, lucrări</h3>
      <ul className="m-0 list-none p-0">
        {ROWS.map(([type, name, desc]) => (
          <Row key={type} preview={<MarkerPreview type={type} />} name={name} desc={desc} />
        ))}
        <Row preview={<WorksPreview />} name="Lucrări" desc="Dungi diagonale galben și gri" />
      </ul>
    </>
  );
}

// Varianta scurtă din colțul hărții pe desktop (design/W5).
function LegendCompact() {
  const rows = [
    [<LinePreview key="l" kind="main" />, 'Traseu', 'coral'],
    [<LinePreview key="b" kind="blocked" />, 'Inaccesibil', 'gri punctat'],
    [<MarkerPreview key="r" type="ramp" size={36} />, 'Dotare', 'cerc'],
    [<MarkerPreview key="s" type="station" size={36} />, 'Stație', 'pătrat'],
    [<MarkerPreview key="p" type="place" size={36} />, 'Loc cu fișă', 'romb'],
    [<MarkerPreview key="x" type="problem" size={36} />, 'Problemă', 'triunghi galben'],
    [<MarkerPreview key="t" type="stairs" size={36} />, 'Scări', 'pătrat închis'],
    [<WorksPreview key="w" />, 'Lucrări', 'dungi galben/gri'],
  ];
  return (
    <ul className="m-0 flex list-none flex-col p-0">
      {rows.map(([preview, name, desc]) => (
        <li key={name} className="flex min-h-9 items-center gap-2.5">
          <span className="flex w-14 flex-none justify-center">{preview}</span>
          <span className="text-caption leading-5">
            <b>{name}</b> · {desc}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function Legend({ breakpoint, pinned, onPinnedChange }) {
  const { legendOpen, setLegendOpen } = useMapContext();

  if (breakpoint === 'phone') {
    return (
      <Dialog
        open={legendOpen}
        onClose={() => setLegendOpen(false)}
        title="Legenda hărții"
        className="mb-0 mt-auto max-h-[calc(100dvh-56px)] w-full max-w-full rounded-b-none"
      >
        <LegendFull />
      </Dialog>
    );
  }

  if (!legendOpen) return null;
  return (
    <section
      aria-labelledby="legend-title"
      className="absolute bottom-9 right-6 z-[800] flex w-[300px] flex-col gap-1 rounded-card bg-surface px-3.5 pb-3.5 pt-3 shadow-lg hc:border-2 hc:border-border"
    >
      <div className="flex items-center gap-1">
        <h2 id="legend-title" className="m-0 flex-1 text-[18px] font-extrabold">
          Legendă
        </h2>
        <button
          type="button"
          aria-pressed={pinned}
          onClick={() => onPinnedChange(!pinned)}
          className="flex h-11 items-center gap-1 rounded-icon bg-subtle px-2.5 text-[15px] font-bold hover:bg-border"
        >
          {pinned ? <Pin aria-hidden="true" className="h-[18px] w-[18px]" /> : <PinOff aria-hidden="true" className="h-[18px] w-[18px]" />}
          {pinned ? 'Fixată' : 'Fixează'}
        </button>
        <button
          type="button"
          onClick={() => setLegendOpen(false)}
          className="flex h-11 items-center gap-1 rounded-icon px-2 text-[15px] font-bold underline underline-offset-2 hover:bg-subtle"
        >
          <X aria-hidden="true" className="h-[18px] w-[18px]" />
          Închide
        </button>
      </div>
      <LegendCompact />
    </section>
  );
}

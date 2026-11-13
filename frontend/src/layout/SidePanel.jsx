import { useNavigate } from 'react-router-dom';
import { Layers, PanelLeftClose, PanelLeftOpen, Route, Search } from 'lucide-react';
import { usePanel } from './PanelContext.jsx';
import { panelWidth } from './breakpoints.js';

const RAIL = [
  { label: 'Caută', Icon: Search, focus: '#desk-search' },
  { label: 'Straturi', Icon: Layers },
  { label: 'Traseu', Icon: Route, to: '/traseu' },
];

// design/W5 (panou 420 px) și W7 (restrâns la 72 px, cu bară de scurtături).
export default function SidePanel({ breakpoint, label, children }) {
  const { collapsed, toggle, setCollapsed } = usePanel();
  const navigate = useNavigate();
  const width = panelWidth(breakpoint, collapsed);

  if (collapsed) {
    return (
      <aside
        aria-label="Panou restrâns"
        style={{ width }}
        className="relative z-[1000] flex flex-none flex-col items-center gap-2 border-r border-border bg-surface pt-4 shadow-md hc:border-r-[3px]"
      >
        <button
          type="button"
          onClick={toggle}
          aria-expanded="false"
          aria-keyshortcuts="["
          className="flex min-h-16 w-16 flex-col items-center justify-center gap-0.5 rounded-[14px] border-2 border-border-strong bg-surface hover:bg-subtle"
        >
          <PanelLeftOpen aria-hidden="true" className="h-6 w-6" strokeWidth={2.25} />
          <span className="text-[14px] font-bold">Extinde</span>
        </button>
        {RAIL.map(({ label: l, Icon, to, focus }) => (
          <button
            key={l}
            type="button"
            onClick={() => {
              setCollapsed(false);
              if (to) navigate(to);
              if (focus) setTimeout(() => document.querySelector(focus)?.focus(), 0);
            }}
            className="flex min-h-16 w-16 flex-col items-center justify-center gap-0.5 rounded-[14px] hover:bg-subtle"
          >
            <Icon aria-hidden="true" className="h-6 w-6" strokeWidth={2.25} />
            <span className="text-[14px] font-bold">{l}</span>
          </button>
        ))}
      </aside>
    );
  }

  return (
    <aside
      aria-label={label}
      style={{ width }}
      className="relative z-[1000] flex flex-none flex-col overflow-y-auto border-r border-border bg-surface shadow-md hc:border-r-[3px]"
    >
      {children}
    </aside>
  );
}

// Antetul panoului: titlu + „Restrânge”.
export function PanelHeader({ title, children }) {
  const { toggle } = usePanel();
  return (
    <div className="flex items-center justify-between gap-3">
      <h1 className="m-0 text-[24px] font-extrabold leading-8">{title}</h1>
      <div className="flex items-center gap-2">
        {children}
        <button
          type="button"
          onClick={toggle}
          aria-expanded="true"
          aria-keyshortcuts="["
          className="flex h-12 items-center gap-2 rounded-[14px] border-2 border-border-strong px-3.5 text-[17px] font-bold hover:bg-subtle"
        >
          <PanelLeftClose aria-hidden="true" className="h-[22px] w-[22px]" strokeWidth={2.25} />
          Restrânge
        </button>
      </div>
    </div>
  );
}

import { NavLink, useLocation } from 'react-router-dom';
import { NAV_ITEMS, activeNav } from './breakpoints.js';
import { NAV_ICONS } from './navIcons.js';

// design/TabBar: 80 px, 4 taburi; tabul activ are pastilă piersică și text îngroșat.
export default function TabBar() {
  const active = activeNav(useLocation().pathname);
  return (
    <nav
      aria-label="Navigare principală"
      className="grid h-20 flex-none grid-cols-4 border-t border-border bg-surface px-1 pb-[env(safe-area-inset-bottom)] hc:border-t-[3px]"
    >
      {NAV_ITEMS.map((item) => {
        const on = item.id === active;
        const Icon = NAV_ICONS[item.id];
        return (
          <NavLink
            key={item.id}
            to={item.to}
            aria-current={on ? 'page' : undefined}
            className="flex min-h-14 flex-col items-center justify-center gap-1 text-ink no-underline hover:text-ink"
          >
            <span
              className={`flex h-8 w-14 items-center justify-center rounded-chip ${on ? 'bg-peach hc:outline hc:outline-2 hc:outline-border' : ''}`}
            >
              <Icon aria-hidden="true" className="h-6 w-6" strokeWidth={on ? 2.75 : 2.25} />
            </span>
            <span className={`text-caption ${on ? 'font-extrabold' : 'font-semibold'}`}>{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}

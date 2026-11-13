import { Link, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { NAV_ITEMS, activeNav } from './breakpoints.js';
import { NAV_ICONS } from './navIcons.js';
import Logo from './Logo.jsx';
import { useAuth } from '../auth/AuthProvider.jsx';
import { useShortcutsDialog } from '../accessibility/ShortcutsContext.jsx';
import { isAdmin } from '../admin/adminUtils.js';
import { LayoutDashboard } from 'lucide-react';
import Avatar from '../ui/Avatar.jsx';
import { displayName } from '../pages/account/accountUtils.js';

function Kbd({ children }) {
  return (
    <span aria-hidden="true" className="flex h-7 min-w-7 items-center justify-center rounded-lg border-2 border-line-soft px-1 text-caption font-bold text-ink-muted">
      {children}
    </span>
  );
}

// design/DeskNav: bara de sus de 72 px pe tabletă și desktop.
export default function DeskNav() {
  const onShortcuts = useShortcutsDialog();
  const { pathname } = useLocation();
  const active = activeNav(pathname);
  const navigate = useNavigate();
  const { user } = useAuth();
  const [params] = useSearchParams();
  // Textul căutării stă în URL (/?q=...), iar panoul hărții afișează rezultatele (W5).
  const q = pathname === '/' ? (params.get('q') ?? '') : '';
  const setQ = (value) => navigate(value ? `/?q=${encodeURIComponent(value)}` : '/', { replace: pathname === '/' });
  const name = displayName(user);

  return (
    <header className="relative z-[1100] flex h-[72px] flex-none items-center gap-3 border-b border-border bg-surface px-4 hc:border-b-[3px] lg:gap-6 lg:px-6">
      <Logo compact />
      <form
        role="search"
        className="hidden min-w-[220px] max-w-[440px] flex-1 items-center gap-2.5 lg:flex"
        onSubmit={(e) => {
          e.preventDefault();
          navigate(`/?q=${encodeURIComponent(q)}`);
        }}
      >
        <label htmlFor="desk-search" className="flex-none text-label">
          Caută
        </label>
        <div className="relative flex flex-1">
          <input
            id="desk-search"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-keyshortcuts="/"
            autoComplete="off"
            className="h-12 w-full rounded-[14px] border-2 border-border-strong bg-surface pl-4 pr-11 text-[18px] text-ink"
          />
          <span className="absolute right-2.5 top-2.5">
            <Kbd>/</Kbd>
          </span>
        </div>
      </form>
      <nav aria-label="Navigare principală" className="ml-auto flex gap-1">
        {NAV_ITEMS.map((item) => {
          const on = item.id === active;
          const Icon = NAV_ICONS[item.id];
          return (
            <NavLink
              key={item.id}
              to={item.to}
              aria-current={on ? 'page' : undefined}
              className={`flex h-12 items-center gap-2 rounded-[14px] px-3 text-[18px] lg:px-4 text-ink no-underline hover:bg-subtle hover:text-ink ${
                on ? 'bg-peach font-extrabold hc:outline hc:outline-2 hc:outline-border' : 'font-semibold'
              }`}
            >
              <Icon aria-hidden="true" className="h-[22px] w-[22px]" strokeWidth={on ? 2.75 : 2.25} />
              {item.label}
            </NavLink>
          );
        })}
      </nav>
      <button
        type="button"
        onClick={onShortcuts}
        aria-keyshortcuts="?"
        className="hidden h-12 flex-none items-center gap-2 rounded-[14px] border-2 border-border-strong px-3.5 text-[17px] font-bold hover:bg-subtle lg:flex"
      >
        <Kbd>?</Kbd>
        Scurtături
      </button>
      {isAdmin(user) && (
        <Link
          to="/admin"
          className="flex h-12 flex-none items-center gap-2 rounded-[14px] border-2 border-border-strong px-3 text-[17px] font-bold text-ink no-underline hover:bg-subtle hover:text-ink lg:px-3.5"
        >
          <LayoutDashboard aria-hidden="true" className="hidden h-[22px] w-[22px] lg:block" strokeWidth={2.25} />
          <span className="lg:hidden">Admin</span>
          <span className="hidden lg:inline">Administrare</span>
        </Link>
      )}
      {user ? (
        <Link
          to="/profil"
          className="flex h-12 flex-none items-center gap-2 rounded-chip border-2 border-border-strong py-0 pl-0.5 pr-4 text-[17px] font-bold text-ink no-underline hover:bg-subtle hover:text-ink"
        >
          <Avatar name={name} url={user.avatar_url} size="sm" />
          <span className="sr-only">Contul meu: </span>
          {name}
        </Link>
      ) : (
        <Link
          to={`/autentificare?next=${encodeURIComponent(pathname)}`}
          className="flex h-12 flex-none items-center rounded-chip border-2 border-border-strong px-4 text-[17px] font-bold text-ink no-underline hover:bg-subtle hover:text-ink"
        >
          Intră în cont
        </Link>
      )}
    </header>
  );
}

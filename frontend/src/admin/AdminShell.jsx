import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Accessibility, BarChart3, Bus, ChevronsLeft, ChevronsRight, ClipboardList, Construction, LayoutDashboard, Map, TriangleAlert, Users,
} from 'lucide-react';
import { LogoMark } from '../layout/Logo.jsx';
import SkipLink from '../layout/SkipLink.jsx';
import { useBreakpoint } from '../layout/useBreakpoint.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { canAccess, roleLabel, visibleNav } from './adminUtils.js';
import EmptyState from '../ui/EmptyState.jsx';
import DemoBadge from '../layout/DemoBadge.jsx';
import { ButtonLink } from '../ui/Button.jsx';
import Avatar from '../ui/Avatar.jsx';
import { displayName } from '../pages/account/accountUtils.js';

const ICONS = {
  prezentare: LayoutDashboard, rapoarte: TriangleAlert, harta: Map, lucrari: Construction, proiecte: ClipboardList,
  dotari: Accessibility, vehicule: Bus, statistici: BarChart3, utilizatori: Users,
};

const initials = (s) => s.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

// design/AdminSide: meniul lateral, restrângibil la 72 px.
function AdminSide({ user, collapsed, onToggle }) {
  const { pathname } = useLocation();
  return (
    <nav
      aria-label="Meniu administrare"
      className={`flex flex-none flex-col gap-1 border-r border-border bg-surface px-3 py-4 hc:border-r-[3px] ${collapsed ? 'w-[72px] items-center' : 'w-[248px]'}`}
    >
      <Link to="/admin" className="mb-3 flex min-h-target items-center gap-2.5 px-1 text-ink no-underline hover:text-ink">
        <LogoMark size={36} />
        {!collapsed && (
          <span className="flex flex-col leading-tight">
            <span className="text-[18px] font-extrabold">
              Pas <span className="font-medium text-ink-muted">cu</span> Pas
            </span>
            <span className="text-[15px] font-bold text-ink-muted">Administrare</span>
          </span>
        )}
        {collapsed && <span className="sr-only">Pas cu Pas, administrare</span>}
      </Link>
      {visibleNav(user).map((item) => {
        const Icon = ICONS[item.id];
        const on = item.to === '/admin' ? pathname === '/admin' : pathname.startsWith(item.to);
        return (
          <NavLink
            key={item.id}
            to={item.to}
            aria-current={on ? 'page' : undefined}
            className={`flex min-h-12 items-center gap-3 rounded-[14px] text-[17px] text-ink no-underline hover:bg-subtle hover:text-ink ${
              collapsed ? 'w-12 justify-center' : 'px-3'
            } ${on ? 'bg-peach font-extrabold hc:outline hc:outline-2 hc:outline-border' : 'font-semibold'}`}
          >
            <Icon aria-hidden="true" className="h-[22px] w-[22px] flex-none" strokeWidth={on ? 2.75 : 2.25} />
            {collapsed ? <span className="sr-only">{item.label}</span> : item.label}
          </NavLink>
        );
      })}
      <div className="mt-auto flex flex-col gap-1">
        <Link to="/" className={`flex min-h-12 items-center rounded-[14px] text-[16px] font-semibold ${collapsed ? 'sr-only' : 'px-3'}`}>
          Înapoi la aplicație
        </Link>
        <button
          type="button"
          aria-expanded={!collapsed}
          onClick={onToggle}
          className={`flex min-h-12 items-center gap-2 rounded-[14px] text-[16px] font-bold hover:bg-subtle ${collapsed ? 'w-12 flex-col justify-center gap-0 text-[13px]' : 'px-3'}`}
        >
          {collapsed ? <ChevronsRight aria-hidden="true" className="h-5 w-5" /> : <ChevronsLeft aria-hidden="true" className="h-5 w-5" />}
          {collapsed ? 'Extinde' : 'Restrânge meniul'}
        </button>
      </div>
    </nav>
  );
}

// design/AdminHead: instituția, căutarea după cod de raport, contul.
function AdminHead({ user }) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const inst = user.institution?.name ?? 'Toate instituțiile';
  const name = displayName(user);
  return (
    <header className="flex h-16 flex-none items-center gap-4 border-b border-border bg-surface px-6 hc:border-b-[3px]">
      <div className="flex items-center gap-2.5">
        <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-icon bg-lavender text-[15px] font-extrabold">
          {initials(inst)}
        </span>
        <span className="flex flex-col leading-tight">
          <span className="text-caption text-ink-muted">Instituția</span>
          <span className="text-[17px] font-bold">{inst}</span>
        </span>
      </div>
      <form
        role="search"
        className="ml-auto flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) navigate(`/admin/rapoarte?q=${encodeURIComponent(q.trim().toUpperCase())}`);
        }}
      >
        <label htmlFor="admin-q" className="text-label">
          Caută
        </label>
        <input
          id="admin-q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="cod raport, de ex. TM-2026-000123"
          className="h-12 w-[300px] rounded-[14px] border-2 border-border-strong bg-surface px-3 text-[17px]"
        />
      </form>
      <div className="flex items-center gap-2">
        <Avatar name={name} url={user.avatar_url} background="bg-sky" />
        <span className="hidden flex-col leading-tight lg:flex">
          <span className="text-[17px] font-bold">{name}</span>
          <span className="text-caption text-ink-muted">{roleLabel(user)}</span>
        </span>
      </div>
    </header>
  );
}

// X13 în cadrul panoului: secțiune nepermisă pentru rolul curent.
export function AdminSection({ id, children }) {
  const { user } = useAuth();
  if (canAccess(user, id)) return children;
  const first = visibleNav(user)[1] ?? visibleNav(user)[0];
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <EmptyState
        role="alert"
        spot="key"
        headingLevel={1}
        title="Nu ai acces la această secțiune"
        actions={
          first && (
            <ButtonLink to={first.to} variant="primary" full>
              Mergi la {first.label.toLowerCase()}
            </ButtonLink>
          )
        }
      >
        Secțiunea e gestionată de altă instituție. Contul tău de la {user.institution?.name ?? 'instituția ta'} vede doar ce ține de ea. Dacă ai
        nevoie de acces, cere-l unui superadmin.
      </EmptyState>
    </div>
  );
}

/** Panoul de administrare: layout separat, fără navigarea utilizatorului. Doar tabletă și desktop. */
export default function AdminShell() {
  const { user } = useAuth();
  const bp = useBreakpoint();
  const [collapsed, setCollapsed] = useState(bp === 'tablet');

  if (bp === 'phone') {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-bg p-6">
        <EmptyState
          headingLevel={1}
          spot="key"
          title="Panoul de administrare e pentru tabletă și desktop"
          actions={
            <ButtonLink to="/" full>
              Înapoi la aplicație
            </ButtonLink>
          }
        >
          Deschide-l pe un ecran mai lat, ca tabelele și harta să încapă.
        </EmptyState>
      </main>
    );
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-bg">
      <SkipLink />
      <AdminSide user={user} collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <DemoBadge />
        <AdminHead user={user} />
        <main id="continut" tabIndex={-1} className="relative flex min-h-0 flex-1 flex-col overflow-y-auto outline-none">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

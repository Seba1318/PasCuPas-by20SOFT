import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, Keyboard, LayoutDashboard, LogOut, ShieldCheck, ClipboardList } from 'lucide-react';
import { isAdmin } from '../../admin/adminUtils.js';
import { useAuth } from '../../auth/AuthProvider.jsx';
import { usePrefs } from '../../accessibility/PrefsProvider.jsx';
import { useProfile } from '../../profile/useProfile.js';
import { profileSummary } from '../../profile/presets.js';
import { useProfileEditor } from '../../profile/useProfileEditor.js';
import { reports } from '../../api/endpoints.js';
import { useBreakpoint } from '../../layout/useBreakpoint.js';
import { useShortcutsDialog } from '../../accessibility/ShortcutsContext.jsx';
import { trustInfo } from './accountUtils.js';
import { ThemeChoice } from '../../accessibility/DisplaySettings.jsx';
import AccountIdentity from './AccountIdentity.jsx';
import ProfileForm from '../onboarding/ProfileForm.jsx';
import Switch from '../../ui/Switch.jsx';
import Button from '../../ui/Button.jsx';
import Alert from '../../ui/Alert.jsx';
import Skeleton from '../../ui/Skeleton.jsx';
import { Tag } from '../../ui/Chip.jsx';
import { useToast } from '../../ui/Toast.jsx';

const card = 'flex flex-col gap-3 rounded-card bg-surface p-5 shadow-sm hc:border-2 hc:border-border';

function TrustCard({ user }) {
  const info = trustInfo(user.trust_level, user.confirmed_reports_count);
  return (
    <section aria-labelledby="trust-title" className={card}>
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 flex-none items-center justify-center rounded-chip bg-success-bg text-success">
          <ShieldCheck aria-hidden="true" className="h-6 w-6" strokeWidth={2.5} />
        </span>
        <h2 id="trust-title" className="m-0 text-title-3">
          {info.title}
        </h2>
      </div>
      <div role="img" aria-label={`Nivelul ${info.level + 1} din 3`} className="grid grid-cols-3 gap-1.5">
        {[0, 1, 2].map((i) => (
          <span key={i} className={`h-2.5 rounded-chip ${i <= info.level ? 'bg-success' : 'bg-border'}`} />
        ))}
      </div>
      <div aria-hidden="true" className="grid grid-cols-3 text-caption text-ink-muted">
        <span>Scăzut</span>
        <span className="text-center">Mediu</span>
        <span className="text-right">Ridicat</span>
      </div>
      <p className="m-0 text-[17px] leading-6">{info.text}</p>
    </section>
  );
}

function DisplayToggles() {
  const prefs = usePrefs();
  const rows = [
    ['highContrast', 'Contrast ridicat'],
    ['simplified', 'Mod simplificat'],
    ['voice', 'Indicații vocale'],
    ['vibration', 'Vibrații la viraje'],
  ];
  return (
    <section className={card}>
      <h2 className="m-0 text-[20px] font-bold">Afișare și indicații</h2>
      {rows.map(([key, label]) => (
        <Switch key={key} id={`pref-${key}`} label={label} checked={prefs[key]} onChange={(v) => prefs.setPref(key, v)} className="border-t border-border" />
      ))}
      <ThemeChoice />
    </section>
  );
}

// Editorul complet pe desktop (W3), cu salvare pe loc.
function InlineEditor() {
  const { value, setValue, save, busy, error } = useProfileEditor();
  const { show } = useToast();
  return (
    <div className="flex flex-col gap-4">
      <h2 className="m-0 text-title-3">Profilul de nevoi</h2>
      {error && (
        <Alert tone="error" urgent title="nu am putut salva profilul">
          {error}
        </Alert>
      )}
      {value ? <ProfileForm value={value} onChange={setValue} /> : <Skeleton text="Se încarcă profilul…" />}
      <ThemeChoice />
      <Button
        className="self-start font-extrabold"
        loading={busy}
        loadingText="Se salvează…"
        disabled={!value}
        onClick={async () => {
          if (await save()) show({ tone: 'success', title: 'Profil salvat', message: 'Traseele țin cont de el de acum.' });
        }}
      >
        Salvează profilul
      </Button>
    </div>
  );
}

// F1 (telefon) și W3 (desktop): contul, încrederea, profilul de nevoi și preferințele.
export default function ProfilePage() {
  const { user, logout } = useAuth();
  const profile = useProfile();
  const navigate = useNavigate();
  const bp = useBreakpoint();
  const openShortcuts = useShortcutsDialog();
  const [count, setCount] = useState(null);

  useEffect(() => {
    reports
      .mine()
      .then((r) => setCount(r.length))
      .catch(() => {});
  }, []);

  if (!user) return <Skeleton text="Se încarcă profilul…" />;
  const wide = bp === 'desktop';

  const links = [
    ...(isAdmin(user) ? [{ to: '/admin', label: 'Panoul de administrare', meta: '', Icon: LayoutDashboard }] : []),
    { to: '/rapoartele-mele', label: 'Rapoartele mele', meta: count ?? '', Icon: ClipboardList },
    { to: '/confidentialitate', label: 'Confidențialitate și date', meta: '', Icon: ShieldCheck },
  ];

  const account = (
    <div className="flex flex-col gap-4">
      <AccountIdentity user={user} />
      <TrustCard user={user} />
      {!wide && (
        <section className={card}>
          <div className="flex items-center justify-between">
            <h2 className="m-0 text-[20px] font-bold">Profilul de nevoi</h2>
            <Link to="/profil/nevoi" className="inline-flex min-h-target items-center text-[18px] font-bold">
              Ajustează
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            {profileSummary(profile).length ? (
              profileSummary(profile).map((t) => <Tag key={t} tone="peach">{t}</Tag>)
            ) : (
              <span className="text-ink-muted">Fără reguli: îți arătăm cel mai scurt drum.</span>
            )}
          </div>
        </section>
      )}
      {!wide && <DisplayToggles />}
      <nav aria-label="Cont" className="flex flex-col rounded-card bg-surface px-5 shadow-sm hc:border-2 hc:border-border">
        {links.map(({ to, label, meta, Icon }, i) => (
          <Link key={to} to={to} className={`flex min-h-16 items-center gap-3 text-ink no-underline hover:text-ink ${i ? 'border-t border-border' : ''}`}>
            <Icon aria-hidden="true" className="h-6 w-6" strokeWidth={2.25} />
            <span className="flex-1 text-[18px] font-semibold">{label}</span>
            {meta !== '' && <span className="text-[18px] text-ink-muted">{meta}</span>}
            <ChevronRight aria-hidden="true" className="h-5 w-5" strokeWidth={2.5} />
          </Link>
        ))}
        {bp !== 'phone' && (
          <button type="button" onClick={openShortcuts} className="flex min-h-16 items-center gap-3 border-t border-border text-left">
            <Keyboard aria-hidden="true" className="h-6 w-6" strokeWidth={2.25} />
            <span className="flex-1 text-[18px] font-semibold">Ajutor și scurtături</span>
            <ChevronRight aria-hidden="true" className="h-5 w-5" strokeWidth={2.5} />
          </button>
        )}
      </nav>
      <Button
        variant="secondary"
        icon={LogOut}
        full
        onClick={() => {
          logout();
          navigate('/autentificare', { replace: true });
        }}
      >
        Deconectează-te
      </Button>
    </div>
  );

  if (!wide) return account;
  return (
    <div className="grid grid-cols-[380px_minmax(0,1fr)] gap-8">
      {account}
      <InlineEditor />
    </div>
  );
}

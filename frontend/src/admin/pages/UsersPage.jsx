import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Trash2, X } from 'lucide-react';
import AdminPage, { Select } from './AdminPage.jsx';
import { admin } from '../../api/endpoints.js';
import { TRUST_OPTIONS, trustLabel, validateInstitution, validateTrustChange } from '../usersUtils.js';
import { formatDate, formatDateTime } from '../../lib/format.js';
import Field from '../../ui/Field.jsx';
import Button from '../../ui/Button.jsx';
import Alert from '../../ui/Alert.jsx';
import Skeleton from '../../ui/Skeleton.jsx';
import { Tag } from '../../ui/Chip.jsx';
import Avatar from '../../ui/Avatar.jsx';
import { displayName } from '../../pages/account/accountUtils.js';
import { useToast } from '../../ui/Toast.jsx';

const TONE = { Ridicat: 'success', Mediu: 'warning' };

// Detaliul unui utilizator, cu ajustarea încrederii (motiv obligatoriu, istoric păstrat).
function UserDetail({ user, onClose, onSaved }) {
  const { show } = useToast();
  const [next, setNext] = useState(String(user.trust_level));
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setNext(String(user.trust_level));
    setReason('');
    setErrors({});
  }, [user]);

  const save = async () => {
    const found = validateTrustChange({ current: user.trust_level, next, reason });
    setErrors(found);
    if (found.reason) {
      document.getElementById('u-reason')?.focus();
      return;
    }
    if (found.next) return;
    setBusy(true);
    try {
      const updated = await admin.patchUser(user.id, { trust_level: Number(next), reason: reason.trim() });
      onSaved(updated);
      show({ tone: 'success', title: 'Nivel salvat', message: `${user.email}: ${trustLabel(Number(next)).toLowerCase()}.` });
    } catch (e) {
      setError(e.detail);
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside aria-labelledby="u-title" className="flex flex-col gap-3 overflow-y-auto border-l border-border bg-surface p-5 hc:border-l-[3px]">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={displayName(user)} url={user.avatar_url} />
          <h2 id="u-title" className="m-0 truncate text-title-3">
            {displayName(user)}
          </h2>
        </div>
        <button type="button" onClick={onClose} className="flex h-12 items-center gap-1.5 rounded-[14px] border-2 border-border-strong px-3 font-bold hover:bg-subtle">
          <X aria-hidden="true" className="h-5 w-5" /> Închide
        </button>
      </div>
      <span className="text-caption text-ink-muted">
        {user.email} · din {formatDate(user.created_at)}
      </span>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-field bg-subtle p-3">
          <div className="text-[24px] font-extrabold">{user.reports_count}</div>
          <div className="text-caption">rapoarte trimise</div>
        </div>
        <div className="rounded-field bg-subtle p-3">
          <div className="text-[24px] font-extrabold">{user.false_count}</div>
          <div className="text-caption">marcate false</div>
        </div>
      </div>
      {error && <Alert tone="error" title="nu am putut salva">{error}</Alert>}
      <h3 className="m-0 mt-2 text-[20px] font-bold">Ajustează încrederea</h3>
      <Select id="u-next" label="Nivel nou" value={next} onChange={setNext} options={TRUST_OPTIONS} />
      {errors.next && <span className="text-[17px] font-semibold text-error">{errors.next}</span>}
      <Field
        id="u-reason"
        label="Motiv"
        required
        multiline
        hint="Rămâne în istoric și e vizibil celorlalți administratori."
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        error={errors.reason}
      />
      <Button loading={busy} loadingText="Se salvează…" onClick={save}>
        Salvează nivelul
      </Button>
      <h3 className="m-0 mt-2 text-[20px] font-bold">Istoricul schimbărilor</h3>
      {user.history?.length ? (
        <ol className="m-0 flex list-none flex-col gap-2 p-0">
          {user.history.map((h, i) => (
            <li key={i} className="border-l-4 border-border pl-3">
              <div className="font-semibold">{h.change}</div>
              <div className="text-caption text-ink-muted">
                {formatDateTime(h.at)} · {h.by}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="m-0 text-ink-muted">Nicio schimbare încă.</p>
      )}
    </aside>
  );
}

function UsersTab() {
  const [q, setQ] = useState('');
  const [trust, setTrust] = useState('');
  const [state, setState] = useState({ status: 'loading', items: [] });
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      admin
        .users({ q, trust })
        .then((r) => !cancelled && setState({ status: 'ok', items: r.items, total: r.total }))
        .catch((e) => !cancelled && setState({ status: 'error', items: [], error: e.detail }));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, trust]);

  return (
    <div className={`grid min-h-0 flex-1 gap-0 ${selected ? 'grid-cols-[minmax(0,1fr)_380px]' : ''}`}>
      <div className="flex flex-col gap-4 pr-0">
        <div className="flex flex-wrap items-end gap-3">
          <Field id="u-q" label="Caută utilizator" hint="După nume sau email" value={q} onChange={(e) => setQ(e.target.value)} className="min-w-[280px]" />
          <Select id="u-trust" label="Nivel" value={trust} onChange={setTrust} options={[['', 'Toate'], ['100', 'Ridicat'], ['50', 'Mediu'], ['0', 'Scăzut']]} />
        </div>
        {state.status === 'loading' && <Skeleton text="Se încarcă utilizatorii…" />}
        {state.status === 'error' && <Alert tone="error" title="nu am putut încărca utilizatorii">{state.error}</Alert>}
        {state.status === 'ok' && (
          <div className="overflow-x-auto rounded-card bg-surface shadow-sm hc:border-2 hc:border-border">
            <table className="w-full border-collapse text-left text-[17px]">
              <caption className="sr-only">Utilizatori, {state.total}</caption>
              <thead>
                <tr className="border-b-2 border-border text-caption text-ink-muted">
                  <th scope="col" className="p-3 font-bold">Utilizator</th>
                  <th scope="col" className="p-3 font-bold">Încredere</th>
                  <th scope="col" className="p-3 font-bold">Rapoarte</th>
                  <th scope="col" className="p-3 font-bold">Rol</th>
                </tr>
              </thead>
              <tbody>
                {state.items.map((u) => {
                  const label = trustLabel(u.trust_level);
                  return (
                    <tr key={u.id} className={`border-b border-border ${selected?.id === u.id ? 'bg-info-bg' : ''}`}>
                      <td className="p-3">
                        <button type="button" onClick={() => setSelected(u)} className="flex items-center gap-3 text-left">
                          <Avatar name={displayName(u)} url={u.avatar_url} />
                          <span className="flex flex-col">
                            <span className="font-bold text-info underline underline-offset-2">{displayName(u)}</span>
                            <span className="text-caption text-ink-muted">{u.email}</span>
                          </span>
                        </button>
                      </td>
                      <td className="p-3">
                        <Tag tone={TONE[label] ?? 'neutral'}>{label}</Tag>
                      </td>
                      <td className="p-3">
                        {u.reports_count}
                        {u.false_count ? ` · ${u.false_count} false` : ''}
                      </td>
                      <td className="p-3">{u.role === 'user' ? 'Utilizator' : u.role === 'admin' ? `Admin · ${u.institution?.name}` : 'Superadmin'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {selected && (
        <UserDetail
          user={selected}
          onClose={() => setSelected(null)}
          onSaved={(u) => {
            setState((s) => ({ ...s, items: s.items.map((x) => (x.id === u.id ? { ...x, ...u } : x)) }));
            setSelected((s) => ({ ...s, ...u }));
          }}
        />
      )}
    </div>
  );
}

const SCOPES = ['Rapoarte din zona lor', 'Dotări și locații', 'Lucrări', 'Proiecte', 'Vehicule'];
const TYPES = [
  ['primarie', 'Primărie'],
  ['transport', 'Operator de transport'],
  ['universitate', 'Universitate'],
  ['alta', 'Altă instituție'],
];
const EMPTY_INST = { name: '', type: 'universitate', scopes: ['Rapoarte din zona lor', 'Dotări și locații'], accounts: [{ email: '', role: 'admin' }] };

function InstitutionsTab() {
  const { show } = useToast();
  const [list, setList] = useState(null);
  const [form, setForm] = useState(EMPTY_INST);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const load = () => admin.institutions().then(setList).catch((e) => setError(e.detail));
  useEffect(() => {
    load();
  }, []);

  const setAccount = (i, patch) => setForm((f) => ({ ...f, accounts: f.accounts.map((a, j) => (j === i ? { ...a, ...patch } : a)) }));

  const save = async () => {
    const found = validateInstitution(form);
    setErrors(found);
    const first = found.name ? 'i-name' : Object.keys(found).find((k) => k.startsWith('account-'));
    if (first) {
      document.getElementById(first === 'i-name' ? first : `i-${first}`)?.focus();
      return;
    }
    if (found.accounts) return;
    setBusy(true);
    try {
      await admin.createInstitution(form);
      show({ tone: 'success', title: 'Instituție creată', message: 'Fiecare cont primește un email de invitație.' });
      setForm(EMPTY_INST);
      load();
    } catch (e) {
      setError(e.detail);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_400px] gap-6">
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {!list && <Skeleton text="Se încarcă instituțiile…" />}
        {list?.map((i) => (
          <li key={i.id} className="flex items-start gap-4 rounded-card bg-surface p-4 shadow-sm hc:border-2 hc:border-border">
            <span aria-hidden="true" className="flex h-12 w-12 flex-none items-center justify-center rounded-icon bg-lavender font-extrabold">
              {i.name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('')}
            </span>
            <div className="flex flex-1 flex-col gap-1">
              <span className="text-[18px] font-bold">{i.name}</span>
              <span className="text-caption text-ink-muted">
                {TYPES.find(([v]) => v === i.type)?.[1] ?? i.type} · {i.accounts} conturi
              </span>
              <div className="flex flex-wrap gap-1.5">
                {i.scopes.map((s) => (
                  <Tag key={s} tone="info">
                    {s}
                  </Tag>
                ))}
              </div>
            </div>
          </li>
        ))}
      </ul>
      <section aria-labelledby="i-title" className="flex flex-col gap-3 rounded-card bg-surface p-5 shadow-sm hc:border-2 hc:border-border">
        <h2 id="i-title" className="m-0 text-title-3">
          Instituție nouă
        </h2>
        {error && <Alert tone="error" title="nu am putut crea instituția">{error}</Alert>}
        <Field id="i-name" label="Nume" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name} />
        <Select id="i-type" label="Tip" value={form.type} onChange={(v) => setForm({ ...form, type: v })} options={TYPES} />
        <fieldset className="m-0 flex flex-col gap-1 border-0 p-0">
          <legend className="mb-1 text-label">Ce poate gestiona</legend>
          {SCOPES.map((s) => (
            <label key={s} className="flex min-h-11 cursor-pointer items-center gap-3 text-[17px]">
              <input
                type="checkbox"
                className="h-6 w-6 accent-success"
                checked={form.scopes.includes(s)}
                onChange={(e) => setForm({ ...form, scopes: e.target.checked ? [...form.scopes, s] : form.scopes.filter((x) => x !== s) })}
              />
              {s}
            </label>
          ))}
        </fieldset>
        <span className="text-label">Conturi</span>
        {errors.accounts && <span className="text-[17px] font-semibold text-error">{errors.accounts}</span>}
        {form.accounts.map((a, i) => (
          <div key={i} className="flex flex-col gap-1 rounded-field border-2 border-border p-2">
            <Field id={`i-account-${i}`} label={`Email cont ${i + 1}`} type="email" value={a.email} onChange={(e) => setAccount(i, { email: e.target.value })} error={errors[`account-${i}`]} />
            <div className="flex items-end gap-2">
              <Select id={`i-role-${i}`} label="Rol" value={a.role} onChange={(v) => setAccount(i, { role: v })} options={[['admin', 'Admin'], ['operator', 'Operator']]} className="flex-1" />
              <Button variant="text" size="sm" icon={Trash2} onClick={() => setForm({ ...form, accounts: form.accounts.filter((_, j) => j !== i) })}>
                Elimină
              </Button>
            </div>
          </div>
        ))}
        <Button variant="secondary" size="sm" icon={Plus} onClick={() => setForm({ ...form, accounts: [...form.accounts, { email: '', role: 'operator' }] })}>
          Adaugă un cont
        </Button>
        <span className="text-caption text-ink-muted">Fiecare cont primește un email de invitație.</span>
        <Button loading={busy} loadingText="Se creează…" onClick={save}>
          Creează instituția
        </Button>
      </section>
    </div>
  );
}

// X10 (utilizatori) și X11 (instituții): doar pentru superadmin.
export default function UsersPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'institutii' ? 'institutii' : 'utilizatori';
  return (
    <AdminPage title="Utilizatori și instituții">
      <div role="tablist" aria-label="Secțiune" className="flex gap-1 self-start rounded-field border-2 border-border-strong p-1">
        {[
          ['utilizatori', 'Utilizatori'],
          ['institutii', 'Instituții'],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setParams(id === 'institutii' ? { tab: id } : {})}
            className={`h-11 rounded-icon px-4 text-[17px] font-bold ${tab === id ? 'bg-ink text-surface' : 'hover:bg-subtle'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'utilizatori' ? <UsersTab /> : <InstitutionsTab />}
    </AdminPage>
  );
}

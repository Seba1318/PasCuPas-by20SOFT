import { useRef, useState } from 'react';
import { Camera, Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider.jsx';
import { users } from '../../api/endpoints.js';
import { copyToMemory, UNREADABLE_PHOTO, validatePhoto } from '../../reports/validatePhoto.js';
import { displayName } from './accountUtils.js';
import Avatar from '../../ui/Avatar.jsx';
import Alert from '../../ui/Alert.jsx';
import Button from '../../ui/Button.jsx';
import Field from '../../ui/Field.jsx';
import { useToast } from '../../ui/Toast.jsx';


// Formularul pentru numele afișat: apare pe pagina publică a rapoartelor („Raportat de …”).
function NameForm({ user, onDone }) {
  const { refresh } = useAuth();
  const [value, setValue] = useState(user.display_name ?? '');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    const name = value.trim();
    if (name.length === 1) {
      setError('Numele are cel puțin 2 caractere.');
      return;
    }
    setBusy(true);
    try {
      await users.updateMe({ display_name: name || null });
      await refresh();
      onDone('Numele a fost salvat.');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3">
      <Field
        id="display-name"
        label="Numele afișat"
        hint="Apare pe pagina publică a rapoartelor tale. Lasă gol ca să folosim începutul adresei de email."
        error={error}
        value={value}
        maxLength={60}
        autoComplete="nickname"
        autoFocus
        onChange={(e) => {
          setValue(e.target.value);
          setError(null);
        }}
      />
      <div className="flex flex-wrap gap-3">
        <Button type="submit" size="sm" loading={busy} loadingText="Se salvează…">
          Salvează numele
        </Button>
        <Button variant="secondary" size="sm" onClick={() => onDone(null)}>
          Renunță
        </Button>
      </div>
    </form>
  );
}

// Antetul paginii de cont (F1/W3): poza de profil (opțională) sau inițiala, numele și emailul.
export default function AccountIdentity({ user }) {
  const { refresh } = useAuth();
  const { show } = useToast();
  const fileRef = useRef(null);
  const nameButtonRef = useRef(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(null); // 'upload' | 'remove'
  const [error, setError] = useState(null);
  const name = displayName(user);

  async function run(kind, call, message) {
    setBusy(kind);
    setError(null);
    try {
      await call();
      await refresh();
      show({ tone: 'success', title: message });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  async function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    let problem;
    let copy = null;
    try {
      // aceleași reguli ca la rapoarte; copia în memorie o face citită corect și în Safari
      problem = await validatePhoto(file);
      if (!problem) copy = await copyToMemory(file);
    } catch {
      problem = UNREADABLE_PHOTO;
    }
    e.target.value = ''; // aceeași poză poate fi aleasă din nou
    if (problem) {
      setError(problem);
      return;
    }
    const form = new FormData();
    form.append('photo', copy);
    run('upload', () => users.uploadAvatar(form), 'Poza de profil a fost schimbată.');
  }

  return (
    <div className="flex flex-col gap-3">
      <header className="flex items-center gap-4">
        <Avatar name={name} url={user.avatar_url} size="lg" />
        <div className="flex min-w-0 flex-col">
          <h1 className="m-0 truncate text-title-2-sm">{name}</h1>
          <span className="truncate text-caption text-ink-muted">{user.email}</span>
        </div>
      </header>

      {error && (
        <Alert tone="error" title="nu am putut schimba contul">
          {error}
        </Alert>
      )}

      {editing ? (
        <NameForm
          user={user}
          onDone={(message) => {
            setEditing(false);
            if (message) show({ tone: 'success', title: message });
            requestAnimationFrame(() => nameButtonRef.current?.focus());
          }}
        />
      ) : (
        <div className="flex flex-wrap gap-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={onFile}
          />
          <Button
            variant="secondary"
            size="sm"
            icon={Camera}
            loading={busy === 'upload'}
            loadingText="Se încarcă poza…"
            disabled={!!busy}
            onClick={() => fileRef.current?.click()}
          >
            {user.avatar_url ? 'Schimbă poza' : 'Adaugă o poză'} <span className="font-normal">(opțional)</span>
          </Button>
          {user.avatar_url && (
            <Button
              variant="secondary"
              size="sm"
              icon={Trash2}
              loading={busy === 'remove'}
              loadingText="Se elimină…"
              disabled={!!busy}
              onClick={() => run('remove', () => users.deleteAvatar(), 'Poza de profil a fost eliminată.')}
            >
              Elimină poza
            </Button>
          )}
          <Button ref={nameButtonRef} variant="secondary" size="sm" icon={Pencil} disabled={!!busy} onClick={() => setEditing(true)}>
            Schimbă numele
          </Button>
        </div>
      )}
    </div>
  );
}

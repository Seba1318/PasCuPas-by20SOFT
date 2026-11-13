import { useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AuthLayout, { AuthHeading } from './AuthLayout.jsx';
import Field from '../../ui/Field.jsx';
import PasswordField from '../../ui/PasswordField.jsx';
import Button, { ButtonLink } from '../../ui/Button.jsx';
import Alert from '../../ui/Alert.jsx';
import Spot from '../../ui/Spot.jsx';
import { useAuth } from '../../auth/AuthProvider.jsx';
import { auth, users } from '../../api/endpoints.js';
import { safeNext, validateLogin } from '../../auth/validation.js';
import { isAdmin } from '../../admin/adminUtils.js';
import { useFocusFirstError } from './useFormFocus.js';
import { useToast } from '../../ui/Toast.jsx';

const ORDER = ['login-email', 'login-password'];

// A1 (telefon) și W1 (desktop).
export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { show } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(null); // { kind: 'wrong' | 'unverified' | 'other', text }
  const [busy, setBusy] = useState(false);
  const alertRef = useRef(null);
  const focusFirst = useFocusFirstError(ORDER);

  const submit = async (e) => {
    e.preventDefault();
    const found = validateLogin({ email, password });
    const mapped = { 'login-email': found.email, 'login-password': found.password };
    setErrors(mapped);
    setServerError(null);
    if (Object.values(mapped).some(Boolean)) {
      focusFirst(mapped);
      return;
    }
    setBusy(true);
    try {
      const me = await login(email, password);
      // Conturile de administrare merg direct în panou (sau pe pagina cerută explicit).
      if (isAdmin(me)) {
        navigate(params.get('next') ? safeNext(params.get('next')) : '/admin', { replace: true });
        return;
      }
      const next = safeNext(params.get('next'));
      // Fără profil de nevoi încă: întâi pașii de bun venit (B1, B2), apoi pagina cerută.
      const profile = await users.getProfile().catch(() => true);
      navigate(profile ? next : `/bun-venit?next=${encodeURIComponent(next)}`, { replace: true });
    } catch (err) {
      const kind = err.status === 401 ? 'wrong' : err.status === 403 ? 'unverified' : 'other';
      setServerError({ kind, text: err.detail });
      setTimeout(() => (kind === 'wrong' ? document.getElementById('login-email') : alertRef.current)?.focus(), 0);
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    await auth.resendVerification(email.trim()).catch(() => {});
    show({ tone: 'success', title: 'Email trimis', message: `Dacă adresa are cont, îți trimitem un link nou la ${email.trim()}.` });
  };

  return (
    <AuthLayout intro>
      <div className="self-center md:hidden">
        <Spot kind="welcome" w={160} />
      </div>
      <AuthHeading title="Bine ai revenit">Intră în cont ca să-ți găsim drumurile potrivite.</AuthHeading>

      {serverError && (
        <div ref={alertRef} tabIndex={-1} className="outline-none">
          {serverError.kind === 'unverified' ? (
            <Alert
              tone="warning"
              urgent
              title="contul nu e confirmat încă"
              actions={<Button variant="secondary" size="sm" onClick={resend}>Retrimite emailul</Button>}
            >
              Apasă pe linkul din emailul de confirmare. Harta și traseele merg și până atunci.
            </Alert>
          ) : (
            <Alert tone="error" urgent title={serverError.kind === 'wrong' ? 'Email sau parolă greșite' : 'nu am putut intra în cont'}>
              {serverError.kind === 'wrong' ? 'Verifică ce ai scris și încearcă din nou.' : serverError.text}
            </Alert>
          )}
        </div>
      )}

      <form noValidate onSubmit={submit} className="flex flex-col gap-3.5">
        <Field
          id="login-email"
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors['login-email']}
        />
        <PasswordField
          id="login-password"
          label="Parolă"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors['login-password']}
          labelExtra={
            <Link to="/parola-uitata" className="inline-flex min-h-8 items-center text-[17px] font-semibold">
              Am uitat parola
            </Link>
          }
        />
        <Button type="submit" full loading={busy} loadingText="Se verifică…" className="mt-1 font-extrabold">
          Intră în cont
        </Button>
      </form>
      <div className="hidden items-center gap-3 text-caption text-ink-muted md:flex" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        sau
        <span className="h-px flex-1 bg-border" />
      </div>
      <ButtonLink to="/inregistrare" full>
        Nu ai cont? Creează unul
      </ButtonLink>
    </AuthLayout>
  );
}

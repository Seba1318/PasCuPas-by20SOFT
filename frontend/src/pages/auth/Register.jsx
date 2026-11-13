import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout, { AuthHeading } from './AuthLayout.jsx';
import Field from '../../ui/Field.jsx';
import PasswordField from '../../ui/PasswordField.jsx';
import Button from '../../ui/Button.jsx';
import Alert from '../../ui/Alert.jsx';
import BackLink from '../../ui/BackLink.jsx';
import PasswordChecklist from './PasswordChecklist.jsx';
import { auth } from '../../api/endpoints.js';
import { validateRegister } from '../../auth/validation.js';
import { useFocusFirstError } from './useFormFocus.js';

const ORDER = ['reg-email', 'reg-password', 'reg-confirm'];

// A2: înregistrare. După succes mergem la A4 („Verifică-ți emailul”).
export default function Register() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(null);
  const [busy, setBusy] = useState(false);
  const focusFirst = useFocusFirstError(ORDER);

  const submit = async (e) => {
    e.preventDefault();
    const found = validateRegister({ email, password, confirm });
    const mapped = { 'reg-email': found.email, 'reg-password': found.password, 'reg-confirm': found.confirm };
    setErrors(mapped);
    setServerError(null);
    if (Object.values(mapped).some(Boolean)) {
      focusFirst(mapped);
      return;
    }
    setBusy(true);
    try {
      await auth.register({ email: email.trim().toLowerCase(), password, password_confirm: confirm });
      navigate('/verifica-email', { state: { email: email.trim().toLowerCase() } });
    } catch (err) {
      if (err.status === 409) {
        const next = { 'reg-email': err.detail };
        setErrors(next);
        focusFirst(next);
      } else {
        setServerError(err.detail);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout intro top={<BackLink to="/autentificare" />}>
      <AuthHeading title="Creează un cont">Durează un minut. Îți trimitem un email ca să confirmi adresa.</AuthHeading>
      {serverError && (
        <Alert tone="error" urgent title="nu am putut crea contul">
          {serverError}
        </Alert>
      )}
      <form noValidate onSubmit={submit} className="flex flex-col gap-3.5">
        <Field
          id="reg-email"
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors['reg-email']}
        />
        <PasswordField
          id="reg-password"
          label="Parolă"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors['reg-password']}
          hint={<PasswordChecklist password={password} />}
        />
        <PasswordField
          id="reg-confirm"
          label="Confirmă parola"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={errors['reg-confirm']}
        />
        <Button type="submit" full loading={busy} loadingText="Se creează…" className="mt-1 font-extrabold">
          Creează contul
        </Button>
      </form>
      <p className="m-0 text-caption text-ink-muted">
        Creând contul, accepți <Link to="/confidentialitate">felul în care folosim datele</Link>.
      </p>
      <Link to="/autentificare" className="inline-flex min-h-target items-center justify-center text-[18px] font-semibold">
        Ai deja cont? Intră
      </Link>
    </AuthLayout>
  );
}

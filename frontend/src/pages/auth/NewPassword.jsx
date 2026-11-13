import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Check } from 'lucide-react';
import AuthLayout, { AuthHeading } from './AuthLayout.jsx';
import PasswordField from '../../ui/PasswordField.jsx';
import Button from '../../ui/Button.jsx';
import Alert from '../../ui/Alert.jsx';
import PasswordChecklist from './PasswordChecklist.jsx';
import { auth } from '../../api/endpoints.js';
import { validateNewPassword } from '../../auth/validation.js';
import { useFocusFirstError } from './useFormFocus.js';
import { useToast } from '../../ui/Toast.jsx';

const ORDER = ['new-password', 'new-confirm'];

// A5: deschis din linkul de resetare (?token=...). Un link expirat duce la A6.
export default function NewPassword() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const navigate = useNavigate();
  const { show } = useToast();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(null);
  const [busy, setBusy] = useState(false);
  const focusFirst = useFocusFirstError(ORDER);

  if (!token) return <Navigate to="/link-expirat?tip=resetare" replace />;

  const submit = async (e) => {
    e.preventDefault();
    const found = validateNewPassword({ password, confirm });
    const mapped = { 'new-password': found.password, 'new-confirm': found.confirm };
    setErrors(mapped);
    if (Object.values(mapped).some(Boolean)) {
      focusFirst(mapped);
      return;
    }
    setBusy(true);
    try {
      await auth.resetPassword({ token, password });
      show({ tone: 'success', title: 'Parola a fost schimbată', message: 'Intră în cont cu parola nouă.' });
      navigate('/autentificare', { replace: true });
    } catch (err) {
      if (err.status === 400) navigate('/link-expirat?tip=resetare', { replace: true });
      else setServerError(err.detail);
    } finally {
      setBusy(false);
    }
  };

  const same = confirm.length > 0 && confirm === password;
  return (
    <AuthLayout>
      <AuthHeading title="Alege o parolă nouă">După salvare, intri în cont cu parola nouă.</AuthHeading>
      {serverError && (
        <Alert tone="error" urgent title="nu am putut salva parola">
          {serverError}
        </Alert>
      )}
      <form noValidate onSubmit={submit} className="flex flex-col gap-3.5">
        <PasswordField
          id="new-password"
          label="Parola nouă"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors['new-password']}
          hint={<PasswordChecklist password={password} />}
        />
        <PasswordField
          id="new-confirm"
          label="Confirmă parola nouă"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={errors['new-confirm']}
          hint={
            same && (
              <span className="flex items-center gap-2 text-caption font-semibold text-success">
                <Check aria-hidden="true" className="h-5 w-5" strokeWidth={3} />
                Parolele sunt la fel
              </span>
            )
          }
        />
        <Button type="submit" full loading={busy} loadingText="Se salvează…" className="mt-1 font-extrabold">
          Salvează parola
        </Button>
      </form>
    </AuthLayout>
  );
}

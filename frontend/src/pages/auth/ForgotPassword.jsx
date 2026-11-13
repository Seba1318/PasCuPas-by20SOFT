import { useState } from 'react';
import { Clock } from 'lucide-react';
import AuthLayout, { AuthHeading } from './AuthLayout.jsx';
import Field from '../../ui/Field.jsx';
import Button from '../../ui/Button.jsx';
import Alert from '../../ui/Alert.jsx';
import BackLink from '../../ui/BackLink.jsx';
import { auth } from '../../api/endpoints.js';
import { validateEmail } from '../../auth/validation.js';

// A3. Răspunsul e același dacă adresa are cont sau nu, ca să nu dezvăluim cine e înregistrat.
export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const problem = validateEmail(email);
    setError(problem);
    if (problem) {
      document.getElementById('forgot-email')?.focus();
      return;
    }
    setBusy(true);
    await auth.forgotPassword(email.trim().toLowerCase()).catch(() => {});
    setBusy(false);
    setSent(true);
  };

  return (
    <AuthLayout top={<BackLink to="/autentificare" />}>
      <AuthHeading title="Ți-ai uitat parola?" spot="key">
        Se întâmplă. Scrie adresa de email a contului și îți trimitem un link ca să alegi o parolă nouă.
      </AuthHeading>
      {sent && (
        <Alert tone="success" title="Verifică-ți emailul">
          Dacă adresa {email.trim()} are cont, îți trimitem un link.
        </Alert>
      )}
      <form noValidate onSubmit={submit} className="flex flex-col gap-3.5">
        <Field
          id="forgot-email"
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={error}
        />
        <Button type="submit" full loading={busy} loadingText="Se trimite…" className="font-extrabold">
          {sent ? 'Trimite din nou' : 'Trimite linkul'}
        </Button>
      </form>
      <div className="flex items-start gap-2.5 rounded-field bg-info-bg p-3.5 text-[17px] leading-6 text-ink">
        <Clock aria-hidden="true" className="mt-0.5 h-[22px] w-[22px] flex-none text-info-strong" strokeWidth={2.5} />
        <span>Linkul e valabil 30 de minute. Dacă nu vezi emailul, uită-te și în folderul Spam.</span>
      </div>
    </AuthLayout>
  );
}

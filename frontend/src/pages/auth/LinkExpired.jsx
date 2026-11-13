import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AuthLayout, { AuthHeading } from './AuthLayout.jsx';
import Field from '../../ui/Field.jsx';
import Button, { ButtonLink } from '../../ui/Button.jsx';
import Alert from '../../ui/Alert.jsx';
import { auth } from '../../api/endpoints.js';
import { validateEmail } from '../../auth/validation.js';

// A6: link expirat sau deja folosit. ?tip=resetare (30 min) sau ?tip=confirmare (24 h).
export default function LinkExpired() {
  const [params] = useSearchParams();
  const isReset = params.get('tip') !== 'confirmare';
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);

  const resendVerification = async (e) => {
    e.preventDefault();
    const problem = validateEmail(email);
    setError(problem);
    if (problem) {
      document.getElementById('expired-email')?.focus();
      return;
    }
    await auth.resendVerification(email.trim().toLowerCase()).catch(() => {});
    setSent(true);
  };

  return (
    <AuthLayout>
      <AuthHeading title="Linkul a expirat" spot="expired" spotSize={220}>
        {isReset
          ? 'Din motive de siguranță, linkurile de resetare merg doar 30 de minute și o singură dată. Îți trimitem unul nou imediat.'
          : 'Linkurile de confirmare merg 24 de ore și o singură dată. Scrie adresa contului și îți trimitem altul.'}
      </AuthHeading>
      {isReset ? (
        <ButtonLink to="/parola-uitata" variant="primary" full className="font-extrabold">
          Trimite un link nou
        </ButtonLink>
      ) : (
        <form noValidate onSubmit={resendVerification} className="flex flex-col gap-3.5">
          {sent && (
            <Alert tone="success" title="Verifică-ți emailul">
              Dacă adresa are cont neconfirmat, îți trimitem un link nou.
            </Alert>
          )}
          <Field
            id="expired-email"
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={error}
          />
          <Button type="submit" full className="font-extrabold">
            Trimite alt link
          </Button>
        </form>
      )}
      <ButtonLink to="/autentificare" full>
        Înapoi la autentificare
      </ButtonLink>
    </AuthLayout>
  );
}

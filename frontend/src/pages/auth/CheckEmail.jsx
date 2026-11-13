import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CircleCheck } from 'lucide-react';
import AuthLayout, { AuthHeading } from './AuthLayout.jsx';
import Button from '../../ui/Button.jsx';
import BackLink from '../../ui/BackLink.jsx';
import { auth } from '../../api/endpoints.js';
import { formatTime } from '../../lib/format.js';

// A4: după înregistrare. Adresa vine din pagina anterioară.
export default function CheckEmail() {
  const email = useLocation().state?.email ?? '';
  const [resentAt, setResentAt] = useState(null);
  const [busy, setBusy] = useState(false);

  const resend = async () => {
    setBusy(true);
    await auth.resendVerification(email).catch(() => {});
    setBusy(false);
    setResentAt(new Date().toISOString());
  };

  return (
    <AuthLayout top={<BackLink to="/inregistrare" />}>
      <AuthHeading title="Verifică-ți emailul" spot="email" spotSize={220}>
        {email ? (
          <>
            Ți-am trimis un link la <strong className="break-all text-ink">{email}</strong>.
          </>
        ) : (
          'Ți-am trimis un link de confirmare.'
        )}{' '}
        Apasă pe el ca să confirmi contul. Linkul e valabil 24 de ore. Poți închide ecranul ăsta liniștit(ă).
      </AuthHeading>
      <div role="status" className="min-h-6">
        {resentAt && (
          <span className="flex items-center gap-2 text-[17px] font-semibold text-success">
            <CircleCheck aria-hidden="true" className="h-[22px] w-[22px]" strokeWidth={2.5} />
            Email retrimis la {formatTime(resentAt)}
          </span>
        )}
      </div>
      {email && (
        <Button variant="secondary" full loading={busy} loadingText="Se trimite…" onClick={resend}>
          Retrimite emailul
        </Button>
      )}
      <Link to="/inregistrare" className="inline-flex min-h-target items-center justify-center text-[18px] font-semibold">
        Am greșit adresa
      </Link>
    </AuthLayout>
  );
}

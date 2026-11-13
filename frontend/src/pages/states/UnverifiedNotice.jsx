import { useState } from 'react';
import EmptyState from '../../ui/EmptyState.jsx';
import Button, { ButtonLink } from '../../ui/Button.jsx';
import { auth } from '../../api/endpoints.js';

// G4: contul există, dar adresa nu e confirmată. Poate folosi harta, nu poate raporta.
export default function UnverifiedNotice({ email }) {
  const [sent, setSent] = useState(false);
  return (
    <div className="absolute inset-0 z-[1050] flex items-center justify-center overflow-y-auto bg-bg p-6 md:static md:flex-1 md:bg-transparent">
      <EmptyState
        role="status"
        headingLevel={1}
        spot="email"
        title="Contul nu e confirmat încă"
        actions={
          <>
            <Button
              variant="primary"
              full
              onClick={async () => {
                await auth.resendVerification(email).catch(() => {});
                setSent(true);
              }}
            >
              {sent ? 'Email retrimis · trimite din nou' : 'Retrimite emailul'}
            </Button>
            <ButtonLink to="/" full>
              Înapoi la hartă
            </ButtonLink>
          </>
        }
      >
        Ca să trimiți rapoarte, confirmă adresa <strong className="break-all text-ink">{email}</strong> din emailul pe
        care ți l-am trimis. Harta și traseele merg și până atunci.
      </EmptyState>
    </div>
  );
}

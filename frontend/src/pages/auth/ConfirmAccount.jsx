import { useEffect, useRef, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import AuthLayout, { AuthHeading } from './AuthLayout.jsx';
import { ButtonLink } from '../../ui/Button.jsx';
import { auth } from '../../api/endpoints.js';

// Deschis din emailul de confirmare (?token=...). Linkul merge o singură dată, 24 de ore.
export default function ConfirmAccount() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [state, setState] = useState(token ? 'loading' : 'error');
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true; // StrictMode rulează efectul de două ori; linkul e de unică folosință
    auth
      .verify(token)
      .then(() => setState('ok'))
      .catch(() => setState('error'));
  }, [token]);

  if (state === 'error') return <Navigate to="/link-expirat?tip=confirmare" replace />;

  return (
    <AuthLayout>
      {state === 'loading' ? (
        <div aria-busy="true" role="status">
          <AuthHeading title="Confirmăm contul…" spot="loading" spotSize={220} />
        </div>
      ) : (
        <>
          <div role="status">
            <AuthHeading title="Contul e confirmat" spot="success" spotSize={220}>
              Gata! Acum poți trimite rapoarte și îți putem potrivi traseele.
            </AuthHeading>
          </div>
          <ButtonLink to="/autentificare" variant="primary" full className="font-extrabold">
            Intră în cont
          </ButtonLink>
        </>
      )}
    </AuthLayout>
  );
}

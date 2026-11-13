import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider.jsx';
import Skeleton from '../ui/Skeleton.jsx';
import UnverifiedNotice from '../pages/states/UnverifiedNotice.jsx';
import NoAccess from '../pages/states/NoAccess.jsx';

function Waiting() {
  return (
    <div className="flex flex-1 items-start justify-center p-6">
      <Skeleton text="Verificăm contul…" className="w-full max-w-md" />
    </div>
  );
}

// Pagini doar pentru cine e autentificat; ceilalți merg la autentificare și revin aici după.
export function RequireAuth({ children }) {
  const { status } = useAuth();
  const { pathname, search } = useLocation();
  if (status === 'loading') return <Waiting />;
  if (status === 'anon') return <Navigate to={`/autentificare?next=${encodeURIComponent(pathname + search)}`} replace />;
  return children;
}

// Trimiterea rapoartelor cere cont confirmat (G4); harta și traseele merg și fără.
export function RequireVerified({ children }) {
  const { user } = useAuth();
  return (
    <RequireAuth>{user && !user.is_verified ? <UnverifiedNotice email={user.email} /> : children}</RequireAuth>
  );
}

// Panoul de administrare. Permisiunile reale se verifică pe server; aici doar nu afișăm ce nu e permis (X13).
export function RequireRole({ roles, children }) {
  const { user } = useAuth();
  return <RequireAuth>{user && !roles.includes(user.role) ? <NoAccess /> : children}</RequireAuth>;
}

import { useNavigate } from 'react-router-dom';
import { WifiOff } from 'lucide-react';
import { useOnline } from './useOnline.js';
import { lastRoute } from './lastRoute.js';
import Button from '../ui/Button.jsx';

/**
 * G8: fără conexiune. Bannerul nu dispare singur; pleacă doar când revine semnalul.
 * Harta deja încărcată și ultimul traseu rămân folosibile.
 */
export default function OfflineBanner() {
  const online = useOnline();
  const navigate = useNavigate();
  if (online) return null;
  const saved = lastRoute.load();
  return (
    <div role="alert" className="relative z-[1200] flex flex-none flex-wrap items-center gap-3 border-b-2 border-warning bg-warning-bg px-4 py-3">
      <WifiOff aria-hidden="true" className="h-6 w-6 flex-none text-warning" strokeWidth={2.5} />
      <div className="flex min-w-[220px] flex-1 flex-col">
        <span className="text-[18px] font-bold">Nu avem semnal acum</span>
        <span className="text-[17px]">
          Harta încărcată {saved ? `și traseul spre ${saved.to?.name} merg` : 'merge'} în continuare. Ce ai completat într-un raport rămâne salvat până
          revine conexiunea.
        </span>
      </div>
      <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row">
        {saved && (
          <Button
            size="sm"
            full
            onClick={() => {
              try {
                sessionStorage.setItem('pcp_active_route', JSON.stringify(saved));
              } catch {
                /* fără stocare */
              }
              navigate('/navigare');
            }}
          >
            Folosește traseul salvat
          </Button>
        )}
        <Button size="sm" variant="secondary" full onClick={() => window.location.reload()}>
          Încearcă din nou
        </Button>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { CalendarClock, Copy } from 'lucide-react';
import EmptyState from '../../ui/EmptyState.jsx';
import { ButtonLink } from '../../ui/Button.jsx';
import Button from '../../ui/Button.jsx';
import { formatDate, formatTime } from '../../lib/format.js';
import { categoryLabel } from '../../reports/categories.js';
import { confirmationText } from './timeline.js';

// E6: raport trimis, cu codul public.
export function ReportSent({ code }) {
  const [copied, setCopied] = useState(false);
  return (
    <EmptyState
      role="status"
      headingLevel={2}
      spot="success"
      title="Mulțumim!"
      actions={
        <>
          <ButtonLink to={`/raport/${code}`} variant="primary" full>
            Vezi raportul
          </ButtonLink>
          <ButtonLink to="/" full>
            Înapoi la hartă
          </ButtonLink>
        </>
      }
    >
      <p className="m-0">Raportul tău ajută pe toată lumea.</p>
      <div className="my-3 flex flex-col items-center gap-1 rounded-card bg-surface p-4 text-ink shadow-sm">
        <span className="text-caption text-ink-muted">Codul raportului</span>
        <span className="font-mono text-[26px] font-bold tracking-wide">{code}</span>
        <Button
          variant="text"
          size="sm"
          icon={Copy}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(code);
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? 'Cod copiat' : 'Copiază codul'}
        </Button>
      </div>
      <p className="m-0">Când e confirmat, traseele îl ocolesc automat. Te anunțăm pe email când se rezolvă.</p>
    </EmptyState>
  );
}

// E7: există deja un raport în același loc; al tău devine o confirmare.
export function ReportExisting({ result }) {
  return (
    <EmptyState
      role="status"
      headingLevel={2}
      spot="dup"
      title="Există deja un raport aici"
      actions={
        <>
          <ButtonLink to={`/raport/${result.merged_into}`} variant="primary" full>
            Vezi raportul
          </ButtonLink>
          <ButtonLink to="/" full>
            Înapoi la hartă
          </ButtonLink>
        </>
      }
    >
      <p className="m-0">L-am confirmat pentru tine, așa că problema va fi verificată mai repede.</p>
      <p className="m-0 mt-3 font-bold text-ink">
        {categoryLabel(result.category)} · <span className="font-mono">{result.merged_into}</span>
      </p>
      <p className="m-0">
        {confirmationText(result.confirmations)}
        {result.confirmations ? ', inclusiv tine.' : '.'}
      </p>
    </EmptyState>
  );
}

// G3: limita de 5 rapoarte pe oră. Ora de la care se poate din nou vine din mesajul serverului, dacă există.
export function RateLimited({ detail }) {
  const iso = detail?.match(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/)?.[0];
  return (
    <EmptyState
      role="status"
      headingLevel={1}
      spot="wait"
      title="Ai trimis 5 rapoarte în ultima oră"
      actions={
        <>
          <ButtonLink to="/rapoartele-mele" variant="primary" full>
            Vezi rapoartele mele
          </ButtonLink>
          <ButtonLink to="/" full>
            Înapoi la hartă
          </ButtonLink>
        </>
      }
    >
      <p className="m-0">Mulțumim că ai grijă de oraș! Poți trimite din nou în curând{iso ? `, cam de la ora ${formatTime(iso)}` : ''}.</p>
      <p className="m-0 mt-2">Limita ne ajută să verificăm fiecare raport cu atenție. Ce ai scris rămâne salvat.</p>
    </EmptyState>
  );
}

// G5: raportarea e oprită temporar pentru cont.
export function Suspended({ until }) {
  return (
    <EmptyState
      role="status"
      headingLevel={1}
      spot="paused"
      title="Raportarea e oprită temporar"
      actions={
        <ButtonLink to="/" variant="primary" full>
          Înapoi la hartă
        </ButtonLink>
      }
    >
      <p className="m-0">Câteva rapoarte recente de pe contul tău au fost marcate ca neconforme de echipa de verificare.</p>
      {until && (
        <p className="my-3 flex items-center justify-center gap-2 rounded-field bg-info-bg p-3 font-semibold text-ink">
          <CalendarClock aria-hidden="true" className="h-5 w-5 text-info-strong" strokeWidth={2.5} />
          Poți raporta din nou pe {formatDate(until)}.
        </p>
      )}
      <p className="m-0">Harta, traseele și navigarea funcționează ca de obicei.</p>
    </EmptyState>
  );
}

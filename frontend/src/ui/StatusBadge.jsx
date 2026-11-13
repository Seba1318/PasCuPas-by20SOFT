import { CircleCheck, CircleX, Clock, Sparkles } from 'lucide-react';

// Statusul unui raport: iconiță + cuvânt, nu doar culoare.
export const REPORT_STATUS = {
  nou: { label: 'Nou', cls: 'bg-lavender border-ink text-ink', Icon: Sparkles },
  in_lucru: { label: 'În lucru', cls: 'bg-info-bg border-info-strong text-info-strong', Icon: Clock },
  rezolvat: { label: 'Rezolvat', cls: 'bg-success-bg border-success text-success', Icon: CircleCheck },
  respins: { label: 'Respins', cls: 'bg-subtle border-ink-muted text-ink-muted', Icon: CircleX },
};

export default function StatusBadge({ status, className = '' }) {
  const s = REPORT_STATUS[status] ?? REPORT_STATUS.in_lucru;
  return (
    <span className={`inline-flex items-center gap-2 rounded-chip border-2 px-3.5 py-2 text-[17px] font-bold ${s.cls} ${className}`}>
      <s.Icon aria-hidden="true" className="h-5 w-5 flex-none" strokeWidth={2.5} />
      {s.label}
    </span>
  );
}

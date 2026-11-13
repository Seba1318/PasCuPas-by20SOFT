import { Check } from 'lucide-react';

// Filtru comutabil (aria-pressed). Starea apăsată are bifă + contur verde, nu doar culoare.
export default function Chip({ pressed, onToggle, icon: Icon, children, className = '', ...rest }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={() => onToggle?.(!pressed)}
      className={[
        'inline-flex h-12 min-w-target items-center gap-1.5 rounded-chip border-2 px-4 text-[17px] font-semibold text-ink transition-colors',
        pressed ? 'border-success bg-success-bg' : 'border-border-strong bg-surface hover:bg-subtle',
        className,
      ].join(' ')}
      {...rest}
    >
      {pressed ? (
        <Check aria-hidden="true" className="h-5 w-5 flex-none text-success" strokeWidth={3} />
      ) : (
        Icon && <Icon aria-hidden="true" className="h-5 w-5 flex-none" strokeWidth={2.5} />
      )}
      {children}
    </button>
  );
}

// Etichetă informativă, neapăsabilă (de ex. „Fără trepte”, „Pantă 8 %”).
const TAG_TONES = {
  success: 'bg-success-bg text-success',
  warning: 'bg-warning-bg text-warning',
  info: 'bg-info-bg text-info-strong',
  problem: 'bg-problem text-problem-ink',
  neutral: 'bg-subtle text-ink-muted',
  peach: 'bg-peach text-ink',
};

export function Tag({ tone = 'neutral', icon: Icon, children, className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-chip px-3 py-1.5 text-caption font-bold hc:border-2 hc:border-border ${TAG_TONES[tone]} ${className}`}
    >
      {Icon && <Icon aria-hidden="true" className="h-[18px] w-[18px] flex-none" strokeWidth={3} />}
      {children}
    </span>
  );
}

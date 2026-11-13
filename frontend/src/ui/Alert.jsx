import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';

// design/Componente-Feedback · Bannere: nu dispar singure; tipul e spus și în text („Atenție:”).
const TONES = {
  info: { box: 'bg-info-bg border-info', fg: 'text-info-strong', kind: 'Info:', Icon: Info },
  success: { box: 'bg-success-bg border-success', fg: 'text-success', kind: 'Gata:', Icon: CircleCheck },
  warning: { box: 'bg-warning-bg border-warning', fg: 'text-warning', kind: 'Atenție:', Icon: TriangleAlert },
  error: { box: 'bg-error-bg border-error', fg: 'text-error', kind: 'Eroare:', Icon: CircleAlert },
};

/**
 * `urgent` pune role="alert" (citit imediat); altfel role="status" (aria-live polite).
 * `actions` sunt butoane puse sub text. `id` permite legarea prin aria-describedby.
 */
export default function Alert({ tone = 'info', title, children, actions, urgent = false, showKind = true, className = '', ...rest }) {
  const t = TONES[tone];
  return (
    <div
      role={urgent ? 'alert' : 'status'}
      className={`flex items-start gap-4 rounded-card border-2 py-4 pl-5 pr-4 ${t.box} ${className}`}
      {...rest}
    >
      <span className={`flex h-11 w-11 flex-none items-center justify-center rounded-chip bg-surface ${t.fg}`}>
        <t.Icon aria-hidden="true" className="h-6 w-6" strokeWidth={2.5} />
      </span>
      <div className="flex flex-1 flex-col gap-1">
        {title && (
          <p className="m-0 text-[20px] font-bold leading-7 text-ink">
            {showKind && <span className={t.fg}>{t.kind}</span>} {title}
          </p>
        )}
        {children && <div className="text-[18px] leading-[27px] text-ink">{children}</div>}
        {actions && <div className="flex flex-wrap gap-3 pt-1.5">{actions}</div>}
      </div>
    </div>
  );
}

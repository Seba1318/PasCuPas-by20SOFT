import { forwardRef } from 'react';
import { CircleAlert } from 'lucide-react';

const CONTROL =
  'w-full rounded-field border-2 bg-surface px-4 text-[18px] text-ink placeholder:text-ink-muted ' +
  'focus-visible:border-focus disabled:cursor-not-allowed disabled:border-line-soft disabled:bg-subtle disabled:text-ink-muted';

export function controlClasses({ invalid, multiline, className = '' }) {
  return [
    CONTROL,
    multiline ? 'min-h-24 py-3.5 resize-y' : 'h-14',
    invalid ? 'border-error bg-error-bg' : 'border-border-strong',
    className,
  ].join(' ');
}

export function FieldError({ id, children }) {
  if (!children) return null;
  return (
    <div id={id} className="flex items-start gap-2 text-[17px] font-semibold leading-6 text-error">
      <CircleAlert aria-hidden="true" className="mt-px h-[22px] w-[22px] flex-none" strokeWidth={2.5} />
      <span>{children}</span>
    </div>
  );
}

/**
 * Câmp de formular: etichetă vizibilă deasupra, indicații și eroare legate prin aria-describedby,
 * aria-invalid pe câmpul greșit. `labelExtra` stă în dreapta etichetei (de ex. „Am uitat parola”).
 */
const Field = forwardRef(function Field(
  { id, label, optional, required, hint, error, labelExtra, multiline = false, className = '', inputClassName = '', children, ...inputProps },
  ref,
) {
  const hintId = hint ? `${id}-hint` : null;
  const errorId = error ? `${id}-error` : null;
  const describedBy = [hintId, errorId, inputProps['aria-describedby']].filter(Boolean).join(' ') || undefined;
  const Control = multiline ? 'textarea' : 'input';

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-label">
          {label}
          {optional && <span className="font-normal text-ink-muted"> (opțional)</span>}
          {required && <span className="font-normal text-ink-muted"> (obligatoriu)</span>}
        </label>
        {labelExtra}
      </div>
      {children ?? (
        <Control
          ref={ref}
          id={id}
          required={required}
          {...inputProps}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={controlClasses({ invalid: !!error, multiline, className: inputClassName })}
        />
      )}
      {hint && (
        <div id={hintId} className="text-caption text-ink-muted">
          {hint}
        </div>
      )}
      <FieldError id={errorId}>{error}</FieldError>
    </div>
  );
});

export default Field;

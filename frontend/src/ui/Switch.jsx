import { Check, X } from 'lucide-react';

/**
 * Comutator: <button role="switch">, 64×48, cu ✓/✗ în buton ca starea să nu depindă de culoare.
 * Eticheta e vizibilă lângă el (în `label`), iar `hint` poate spune starea („Pornit”).
 */
export default function Switch({ id, checked, onChange, label, hint, disabled = false, className = '' }) {
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className={`flex min-h-16 items-center justify-between gap-4 ${className}`}>
      <div className="flex flex-col">
        <span id={`${id}-label`} className={`text-[18px] font-semibold ${disabled ? 'text-ink-muted' : ''}`}>
          {label}
        </span>
        {hint && (
          <span id={hintId} className="text-caption text-ink-muted">
            {hint}
          </span>
        )}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        aria-describedby={hintId}
        disabled={disabled}
        onClick={() => onChange?.(!checked)}
        className="flex h-12 w-16 flex-none items-center justify-center rounded-chip disabled:cursor-not-allowed"
      >
        <span
          className={[
            'flex h-[34px] w-[60px] items-center rounded-chip border-2 px-[3px] transition-colors',
            disabled
              ? 'justify-start border-line-soft bg-subtle'
              : checked
                ? 'justify-end border-success bg-success'
                : 'justify-start border-border-strong bg-surface',
          ].join(' ')}
        >
          <span
            className={[
              'flex h-[26px] w-[26px] items-center justify-center rounded-chip',
              disabled ? 'bg-line-soft text-subtle' : checked ? 'bg-surface text-success' : 'bg-border-strong text-surface',
            ].join(' ')}
          >
            {checked ? (
              <Check aria-hidden="true" className="h-4 w-4" strokeWidth={3.5} />
            ) : (
              <X aria-hidden="true" className="h-4 w-4" strokeWidth={3.5} />
            )}
          </span>
        </span>
      </button>
    </div>
  );
}

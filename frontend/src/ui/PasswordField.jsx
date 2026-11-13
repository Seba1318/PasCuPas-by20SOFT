import { forwardRef, useState } from 'react';
import { controlClasses, FieldError } from './Field.jsx';

// Parolă cu butonul text „Arată”/„Ascunde” în câmp (design/A1-Login).
const PasswordField = forwardRef(function PasswordField(
  { id, label, labelExtra, hint, error, className = '', ...inputProps },
  ref,
) {
  const [visible, setVisible] = useState(false);
  const hintId = hint ? `${id}-hint` : null;
  const errorId = error ? `${id}-error` : null;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-label">
          {label}
        </label>
        {labelExtra}
      </div>
      <div className="relative flex">
        <input
          ref={ref}
          id={id}
          type={visible ? 'text' : 'password'}
          {...inputProps}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={controlClasses({ invalid: !!error, className: 'pr-[88px]' })}
        />
        <button
          type="button"
          aria-pressed={visible}
          aria-controls={id}
          onClick={() => setVisible((v) => !v)}
          className="absolute right-1 top-1 h-12 rounded-icon px-3 text-[17px] font-bold text-info underline underline-offset-2 hover:bg-info-bg"
        >
          {visible ? 'Ascunde' : 'Arată'}
        </button>
      </div>
      {hint && <div id={hintId}>{hint}</div>}
      <FieldError id={errorId}>{error}</FieldError>
    </div>
  );
});

export default PasswordField;

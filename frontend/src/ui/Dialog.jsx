import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

/**
 * Dialog modal pe <dialog> nativ: focusul intră în dialog și rămâne acolo,
 * Esc închide, iar la închidere focusul revine pe elementul care l-a deschis.
 */
export default function Dialog({ open, onClose, title, children, actions, className = '' }) {
  const ref = useRef(null);
  const opener = useRef(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      opener.current = document.activeElement;
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return undefined;
    const onCancel = (e) => {
      e.preventDefault();
      onClose?.();
    };
    const onCloseEvent = () => opener.current?.focus?.();
    dialog.addEventListener('cancel', onCancel);
    dialog.addEventListener('close', onCloseEvent);
    return () => {
      dialog.removeEventListener('cancel', onCancel);
      dialog.removeEventListener('close', onCloseEvent);
    };
  }, [onClose]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={`max-h-[calc(100dvh-32px)] w-[min(560px,calc(100vw-32px))] overflow-y-auto rounded-sheet bg-surface p-0 text-ink shadow-lg backdrop:bg-ink/50 hc:border-[3px] hc:border-border ${className}`}
    >
      {open && (
        <div className="flex flex-col gap-4 p-6">
          <div className="flex items-start justify-between gap-4">
            <h2 id={titleId} className="m-0 text-title-3">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="flex h-12 flex-none items-center gap-1.5 rounded-field border-2 border-border-strong px-3.5 text-[17px] font-bold hover:bg-subtle"
            >
              <X aria-hidden="true" className="h-[22px] w-[22px]" strokeWidth={2.5} />
              Închide
            </button>
          </div>
          <div className="text-body">{children}</div>
          {actions && <div className="flex flex-wrap justify-end gap-3">{actions}</div>}
        </div>
      )}
    </dialog>
  );
}

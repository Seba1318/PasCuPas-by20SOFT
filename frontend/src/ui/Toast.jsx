import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { CircleAlert, CircleCheck, Info } from 'lucide-react';
import { addToast, removeToast } from './toastQueue.js';

const ToastContext = createContext(null);

const ICONS = {
  success: { Icon: CircleCheck, cls: 'bg-success-bg text-success' },
  info: { Icon: Info, cls: 'bg-info-bg text-info-strong' },
  error: { Icon: CircleAlert, cls: 'bg-error-bg text-error' },
};

export function ToastProvider({ children }) {
  const [queue, setQueue] = useState([]);
  const show = useCallback((toast) => setQueue((q) => addToast(q, toast)), []);
  const close = useCallback((id) => setQueue((q) => removeToast(q, id)), []);
  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* telefon: deasupra barei de taburi; desktop: dreapta-jos */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-24 z-[2000] flex flex-col gap-3 md:inset-x-auto md:bottom-6 md:right-6 md:w-[420px]"
      >
        {queue.map((t) => {
          const { Icon, cls } = ICONS[t.tone] ?? ICONS.success;
          return (
            <div
              key={t.id}
              role="status"
              className="pointer-events-auto flex items-center gap-3 rounded-card border-2 border-border bg-surface py-3.5 pl-4 pr-2.5 shadow-lg"
            >
              <span className={`flex h-10 w-10 flex-none items-center justify-center rounded-chip ${cls}`}>
                <Icon aria-hidden="true" className="h-[22px] w-[22px]" strokeWidth={2.5} />
              </span>
              <div className="flex flex-1 flex-col">
                <span className="text-[18px] font-bold">{t.title}</span>
                {t.message && <span className="text-[17px] leading-6">{t.message}</span>}
              </div>
              <button
                type="button"
                onClick={() => close(t.id)}
                className="h-12 flex-none rounded-icon px-2.5 text-[17px] font-bold underline underline-offset-2 hover:bg-subtle"
              >
                Închide
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast trebuie folosit în <ToastProvider>');
  return ctx;
}

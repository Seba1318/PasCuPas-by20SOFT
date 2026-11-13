import { useEffect, useRef } from 'react';
import { useSheetOffset } from '../../components/map/useSheetOffset.js';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, X } from 'lucide-react';

/**
 * Cadrul unei fișe peste hartă. Telefon: foaie de jos, cu „Înapoi” deasupra hărții (C6, C7).
 * Tabletă și desktop: conținutul panoului lateral, cu „Închide” (Esc) (W8, W9).
 */
export default function MapSheet({ breakpoint, label, backTo = '/', backLabel = 'Înapoi', children }) {
  const navigate = useNavigate();
  const phone = breakpoint === 'phone';
  const sheet = useRef(null);
  useSheetOffset(sheet, phone);

  useEffect(() => {
    if (phone) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape' && !e.defaultPrevented && !document.querySelector('dialog[open]')) navigate(backTo);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phone, navigate, backTo]);

  if (phone) {
    return (
      <>
        <button
          type="button"
          onClick={() => navigate(backTo)}
          className="absolute left-4 top-4 z-[850] flex h-12 items-center gap-0.5 rounded-field bg-surface pl-2 pr-4 text-[17px] font-bold shadow-md hc:border-2 hc:border-border"
        >
          <ChevronLeft aria-hidden="true" className="h-6 w-6" strokeWidth={2.5} />
          {backLabel}
        </button>
        <section
          ref={sheet}
          aria-label={label}
          className="absolute inset-x-0 bottom-0 z-[900] flex max-h-[64%] flex-col gap-3 overflow-y-auto rounded-t-sheet bg-surface px-4 pb-5 pt-2 shadow-lg hc:border-t-[3px] hc:border-border"
        >
          <span aria-hidden="true" className="mx-auto mb-1 h-[5px] w-11 flex-none rounded-chip bg-route-blocked" />
          {children}
        </section>
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-6 py-5">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => navigate(backTo)}
          className="-ml-2 flex min-h-target items-center gap-0.5 rounded-[14px] pl-1 pr-3 text-[17px] font-bold hover:bg-subtle"
        >
          <ChevronLeft aria-hidden="true" className="h-6 w-6" strokeWidth={2.5} />
          {backLabel}
        </button>
        <button
          type="button"
          onClick={() => navigate(backTo)}
          aria-keyshortcuts="Escape"
          className="flex h-12 items-center gap-1.5 rounded-[14px] border-2 border-border-strong px-3.5 text-[17px] font-bold hover:bg-subtle"
        >
          <X aria-hidden="true" className="h-5 w-5" strokeWidth={2.5} />
          Închide
        </button>
      </div>
      {children}
    </div>
  );
}

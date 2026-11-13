import { useEffect, useId, useRef, useState } from 'react';
import { SunMoon } from 'lucide-react';
import { usePrefs } from './PrefsProvider.jsx';
import Switch from '../ui/Switch.jsx';

/** Tema: ca sistemul, luminoasă sau întunecată (profil F1/W3 și meniul „Afișare”). */
export function ThemeChoice() {
  const { themePref, setPref } = usePrefs();
  const name = useId();
  return (
    <fieldset className="m-0 flex flex-col gap-2 border-0 border-t border-border p-0 pt-3">
      <legend className="mb-2 text-[18px] font-semibold">Temă</legend>
      <div className="grid grid-cols-3 gap-2">
        {[
          ['system', 'Ca sistemul'],
          ['light', 'Luminoasă'],
          ['dark', 'Întunecată'],
        ].map(([id, label]) => (
          <label
            key={id}
            className={`flex min-h-target cursor-pointer items-center justify-center rounded-field border-2 px-2 text-center text-[16px] font-bold has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-focus ${
              themePref === id ? 'border-ink bg-peach' : 'border-border-strong'
            }`}
          >
            <input type="radio" name={name} className="sr-only" checked={themePref === id} onChange={() => setPref('theme', id)} />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * Meniul „Afișare” de pe ecranele fără cont: tema și contrastul ridicat. Fără el, cine pornește
 * „Contrast ridicat” din profil și se deconectează nu l-ar mai putea opri.
 */
export function DisplayMenu() {
  const prefs = usePrefs();
  const [open, setOpen] = useState(false);
  const button = useRef(null);
  const panel = useRef(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        button.current?.focus();
      }
    };
    const onClick = (e) => {
      if (!panel.current?.contains(e.target) && !button.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="flex h-12 items-center gap-2 rounded-[14px] border-2 border-border-strong px-3 text-[17px] font-bold hover:bg-subtle"
      >
        <SunMoon aria-hidden="true" className="h-5 w-5" strokeWidth={2.5} />
        Afișare
      </button>
      {open && (
        <div
          ref={panel}
          id={panelId}
          className="absolute right-0 top-14 z-[1200] flex w-[min(340px,calc(100vw-32px))] flex-col gap-1 rounded-card bg-surface p-4 shadow-lg hc:border-2 hc:border-border"
        >
          <Switch id="display-contrast" label="Contrast ridicat" checked={prefs.highContrast} onChange={(v) => prefs.setPref('highContrast', v)} />
          <ThemeChoice />
        </div>
      )}
    </div>
  );
}

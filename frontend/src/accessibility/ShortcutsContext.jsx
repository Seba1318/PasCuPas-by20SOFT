import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import Dialog from '../ui/Dialog.jsx';
import { SHORTCUTS, shortcutFor } from './shortcuts.js';
import { usePanel } from '../layout/PanelContext.jsx';

const Ctx = createContext(() => {});
export const useShortcutsDialog = () => useContext(Ctx);

function Kbd({ children }) {
  return (
    <kbd className="inline-flex h-8 min-w-8 items-center justify-center rounded-icon border-2 border-border-strong bg-subtle px-2 font-sans text-[16px] font-bold">
      {children}
    </kbd>
  );
}

/**
 * Scurtăturile de tastatură pe tabletă și desktop. Cele care țin de hartă (legendă, zoom)
 * pleacă drept evenimentul `pcp:shortcut`, ascultat de MapLayout.
 */
export function ShortcutsProvider({ enabled, children }) {
  const [open, setOpen] = useState(false);
  const { toggle } = usePanel();
  const openDialog = useCallback(() => setOpen(true), []);

  useEffect(() => {
    if (!enabled) return undefined;
    const onKey = (e) => {
      const action = shortcutFor(e);
      if (!action || document.querySelector('dialog[open]')) return;
      e.preventDefault();
      if (action === 'search') document.getElementById('desk-search')?.focus();
      else if (action === 'panel') toggle();
      else if (action === 'help') setOpen(true);
      else window.dispatchEvent(new CustomEvent('pcp:shortcut', { detail: action }));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled, toggle]);

  return (
    <Ctx.Provider value={openDialog}>
      {children}
      <Dialog open={open} onClose={() => setOpen(false)} title="Scurtături de tastatură">
        <ul className="m-0 flex list-none flex-col p-0">
          {SHORTCUTS.map((s) => (
            <li key={s.what} className="flex min-h-12 items-center gap-4 border-t border-border first:border-t-0">
              <span className="flex w-24 flex-none gap-1.5">
                {s.keys.map((k) => (
                  <Kbd key={k}>{k}</Kbd>
                ))}
              </span>
              <span className="text-[17px]">{s.what}</span>
            </li>
          ))}
        </ul>
        <p className="mb-0 mt-3 text-caption text-ink-muted">Scurtăturile cu o singură literă nu funcționează cât scrii într-un câmp.</p>
      </Dialog>
    </Ctx.Provider>
  );
}

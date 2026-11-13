import { Outlet } from 'react-router-dom';
import { useBreakpoint } from './useBreakpoint.js';
import DeskNav from './DeskNav.jsx';
import TabBar from './TabBar.jsx';
import SkipLink from './SkipLink.jsx';
import { PanelProvider } from './PanelContext.jsx';
import { ShortcutsProvider } from '../accessibility/ShortcutsContext.jsx';
import OfflineBanner from '../offline/OfflineBanner.jsx';
import DemoBadge from './DemoBadge.jsx';

/**
 * Cadrul aplicației utilizatorului.
 * Telefon: conținut + bară de taburi jos. Tabletă și desktop: bara de sus de 72 px + conținut.
 */
export default function AppShell() {
  const bp = useBreakpoint();
  return (
    <PanelProvider>
      <ShortcutsProvider enabled={bp !== 'phone'}>
      <div className="flex h-dvh flex-col overflow-hidden bg-bg">
        <SkipLink />
        <DemoBadge />
        {bp !== 'phone' && <DeskNav />}
        <OfflineBanner />
        <div id="continut" tabIndex={-1} className="relative flex min-h-0 flex-1 outline-none">
          <Outlet context={{ breakpoint: bp }} />
        </div>
        {bp === 'phone' && <TabBar />}
      </div>
      </ShortcutsProvider>
    </PanelProvider>
  );
}

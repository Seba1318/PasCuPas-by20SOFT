import { Fragment, useEffect, useState } from 'react';
import { Outlet, useOutletContext } from 'react-router-dom';
import MapView from '../../components/map/MapView.jsx';
import MapControls from '../../components/map/MapControls.jsx';
import Legend from '../../components/map/Legend.jsx';
import UserMarker from '../../components/map/UserMarker.jsx';
import { WorksPattern } from '../../components/map/WorksLayer.jsx';
import { MapProvider, useMapContext } from '../../components/map/MapContext.jsx';
import SidePanel from '../../layout/SidePanel.jsx';
import { usePrefs } from '../../accessibility/PrefsProvider.jsx';

const PIN_KEY = 'pcp_legend_pinned';
const readPinned = () => {
  try {
    return globalThis.localStorage?.getItem(PIN_KEY) === '1';
  } catch {
    return false;
  }
};

function Inner({ breakpoint }) {
  const { map, setMap, overlays, legendOpen, setLegendOpen } = useMapContext();
  const { theme } = usePrefs();
  const phone = breakpoint === 'phone';
  const [pinned, setPinned] = useState(readPinned);

  // Pe desktop, o legendă fixată rămâne deschisă și după reîncărcare.
  useEffect(() => {
    if (!phone && pinned) setLegendOpen(true);
  }, [phone, pinned, setLegendOpen]);

  // Scurtăturile hărții (W4): L = legenda, + / − = zoom.
  useEffect(() => {
    const onShortcut = (e) => {
      if (e.detail === 'legend') setLegendOpen(!legendOpen);
      else if (e.detail === 'zoom-in') map?.zoomIn();
      else if (e.detail === 'zoom-out') map?.zoomOut();
    };
    window.addEventListener('pcp:shortcut', onShortcut);
    return () => window.removeEventListener('pcp:shortcut', onShortcut);
  }, [map, legendOpen, setLegendOpen]);

  const changePinned = (value) => {
    setPinned(value);
    try {
      globalThis.localStorage?.setItem(PIN_KEY, value ? '1' : '0');
    } catch {
      /* fără stocare */
    }
  };

  return (
    <>
      <WorksPattern />
      {!phone && (
        <SidePanel breakpoint={breakpoint} label="Panou hartă">
          <Outlet context={{ breakpoint }} />
        </SidePanel>
      )}
      <main aria-label="Hartă" className="relative min-w-0 flex-1">
        <MapView dark={theme === 'dark'} onReady={setMap}>
          {Object.entries(overlays).map(([key, node]) => (
            <Fragment key={key}>{node}</Fragment>
          ))}
          <UserMarker />
        </MapView>
        <MapControls breakpoint={breakpoint} />
        <Legend breakpoint={breakpoint} pinned={pinned} onPinnedChange={changePinned} />
        {phone && <Outlet context={{ breakpoint }} />}
      </main>
    </>
  );
}

/**
 * Paginile cu hartă (Hartă, fișe, traseu). O singură hartă Leaflet rămâne montată;
 * conținutul paginii stă în panoul lateral (tabletă, desktop) sau peste hartă (telefon).
 */
export default function MapLayout() {
  const { breakpoint } = useOutletContext();
  return (
    <MapProvider>
      <Inner breakpoint={breakpoint} />
    </MapProvider>
  );
}

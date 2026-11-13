import { Polyline } from 'react-leaflet';
import { lineToLatLngs } from './geo.js';
import { ROUTE_COLORS } from '../../theme/mapColors.js';
import { usePrefs } from '../../accessibility/PrefsProvider.jsx';

/**
 * Un traseu = două linii suprapuse (Observații §4): dedesubt conturul (14 px), deasupra culoarea (8 px).
 * main: traseul ales · alt: alternativ, 50 % · transit: cu puncte · blocked: gri punctat, doar explicativ.
 */
export default function RouteLine({ coords, variant = 'main' }) {
  const { theme, contrast } = usePrefs();
  const c = ROUTE_COLORS[contrast === 'high' ? 'high' : theme];
  const positions = lineToLatLngs(coords);
  const common = { interactive: false, lineCap: 'round', lineJoin: 'round' };

  if (variant === 'blocked') {
    return <Polyline positions={positions} pathOptions={{ ...common, color: c.blocked, weight: 6, dashArray: '1 12' }} />;
  }
  if (variant === 'alt') {
    return <Polyline positions={positions} pathOptions={{ ...common, color: c.route, weight: 6, opacity: 0.5 }} />;
  }
  return (
    <>
      <Polyline positions={positions} pathOptions={{ ...common, color: c.casing, weight: 14 }} />
      <Polyline positions={positions} pathOptions={{ ...common, color: c.route, weight: 8 }} />
      {variant === 'transit' && <Polyline positions={positions} pathOptions={{ ...common, color: c.casing, weight: 3, dashArray: '1 10' }} />}
    </>
  );
}

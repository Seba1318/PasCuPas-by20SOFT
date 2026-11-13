import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import { TILE_ATTRIBUTION, TILE_URL, TILE_URL_DARK } from '../../config/env.js';
import { usePrefs } from '../../accessibility/PrefsProvider.jsx';
import MarkersLayer from './MarkersLayer.jsx';
import { toLatLng } from './geo.js';
import { useEffect, useMemo } from 'react';

function NoPrefix() {
  const map = useMap();
  useEffect(() => {
    map.attributionControl?.setPrefix(false);
  }, [map]);
  return null;
}

/**
 * Miniatură de hartă, fixă (fără tragere sau zoom), cu un singur marker și atribuirea OSM vizibilă.
 * Folosită în detaliile raportului (E4) și pe pagina publică a raportului (E8, W13).
 */
export default function MiniMap({ point, type = 'problem', label, className = 'h-40' }) {
  const { theme } = usePrefs();
  const dark = theme === 'dark';
  const items = useMemo(() => [{ id: 'mini', type, point, label }], [type, point, label]);
  return (
    <div className={`flex-none overflow-hidden rounded-field border-2 border-border ${className}`}>
      <MapContainer
        center={toLatLng(point)}
        zoom={17}
        dragging={false}
        zoomControl={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        touchZoom={false}
        boxZoom={false}
        keyboard={false}
        attributionControl
        className="h-full w-full"
        role="region"
        aria-label={label ? `Hartă: ${label}` : 'Hartă'}
      >
        <TileLayer
          url={dark && TILE_URL_DARK ? TILE_URL_DARK : TILE_URL}
          className={dark && !TILE_URL_DARK ? 'map-dark' : ''}
          attribution={TILE_ATTRIBUTION}
        />
        <NoPrefix />
        <MarkersLayer items={items} cluster={false} />
      </MapContainer>
    </div>
  );
}

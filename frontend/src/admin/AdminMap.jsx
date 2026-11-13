
import { useMapEvents } from 'react-leaflet';
import MapView from '../components/map/MapView.jsx';
import { MapProvider, useMapContext } from '../components/map/MapContext.jsx';
import { WorksPattern } from '../components/map/WorksLayer.jsx';
import { toLonLat } from '../components/map/geo.js';
import { usePrefs } from '../accessibility/PrefsProvider.jsx';

function ClickCatcher({ onClick }) {
  useMapEvents({ click: (e) => onClick(toLonLat(e.latlng)) });
  return null;
}

function Inner({ label, onMapClick, children, overlay }) {
  const { setMap } = useMapContext();
  const { theme } = usePrefs();
  return (
    <div className="relative min-h-[420px] flex-1">
      <WorksPattern />
      <MapView dark={theme === 'dark'} onReady={setMap} label={label}>
        {onMapClick && <ClickCatcher onClick={onMapClick} />}
        {overlay}
      </MapView>
      {children}
    </div>
  );
}

/**
 * Harta din paginile de administrare (X5, X7, X8). `overlay` = straturi react-leaflet,
 * `children` = controale puse peste hartă, `onMapClick(point)` = clic cu [lon, lat].
 */
export default function AdminMap(props) {
  return (
    <MapProvider>
      <Inner {...props} />
    </MapProvider>
  );
}


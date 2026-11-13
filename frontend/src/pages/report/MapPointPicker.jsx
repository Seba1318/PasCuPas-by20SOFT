import { useEffect } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';
import { toLonLat } from '../../components/map/geo.js';

/**
 * Alegerea locului pe hartă (W14): clic pe hartă sau, din tastatură,
 * mută harta cu săgețile și apasă Enter ca să alegi centrul.
 */
export default function MapPointPicker({ onPick }) {
  const map = useMap();
  useMapEvents({ click: (e) => onPick(toLonLat(e.latlng)) });
  useEffect(() => {
    const el = map.getContainer();
    const onKey = (e) => {
      if (e.key === 'Enter' && e.target === el) onPick(toLonLat(map.getCenter()));
    };
    el.addEventListener('keydown', onKey);
    el.style.cursor = 'crosshair';
    return () => {
      el.removeEventListener('keydown', onKey);
      el.style.cursor = '';
    };
  }, [map, onPick]);
  return null;
}

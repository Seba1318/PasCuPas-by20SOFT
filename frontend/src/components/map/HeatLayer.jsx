import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';
import { heatToLeaflet } from '../../admin/statsUtils.js';
import { HEAT_GRADIENT } from '../../theme/mapColors.js';

// Harta termică a problemelor (leaflet.heat). points: [lon, lat, greutate][].
export default function HeatLayer({ points }) {
  const map = useMap();
  useEffect(() => {
    const layer = L.heatLayer(heatToLeaflet(points), { radius: 28, blur: 22, maxZoom: 17, minOpacity: 0.35, gradient: HEAT_GRADIENT });
    layer.addTo(map);
    return () => {
      map.removeLayer(layer);
    };
  }, [map, points]);
  return null;
}

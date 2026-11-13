import { useEffect, useMemo } from 'react';
import { useMapContext, useMapOverlay } from './MapContext.jsx';
import MarkersLayer from './MarkersLayer.jsx';
import { toLatLng } from './geo.js';
import { prefersReducedMotion } from '../../accessibility/useReducedMotion.js';

/**
 * Centrează harta pe un punct și îl arată selectat (inel albastru).
 * item: { id, type, point: [lon, lat], label, name? } sau null cât se încarcă.
 */
export function useFocusPoint(item, zoom = 17) {
  const { map } = useMapContext();
  const items = useMemo(() => (item ? [item] : []), [item]);
  const layer = useMemo(() => <MarkersLayer items={items} selectedId={item?.id} cluster={false} />, [items, item]);
  useMapOverlay('focus-point', layer);

  const lon = item?.point?.[0];
  const lat = item?.point?.[1];
  useEffect(() => {
    if (!map || lon == null) return;
    map.setView(toLatLng([lon, lat]), Math.max(map.getZoom(), zoom), { animate: !prefersReducedMotion() });
  }, [map, lon, lat, zoom]);
}

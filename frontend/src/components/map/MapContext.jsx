import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

/**
 * Harta e una singură, montată de MapLayout; paginile din panou își pun straturile pe ea
 * cu useMapOverlay(cheie, element). Elementele sunt randate în interiorul MapContainer,
 * deci pot folosi componentele react-leaflet.
 */
const MapCtx = createContext(null);

export function MapProvider({ children }) {
  const [map, setMap] = useState(null);
  const [overlays, setOverlays] = useState({});
  const [legendOpen, setLegendOpen] = useState(false);
  const [userPosition, setUserPosition] = useState(null); // { point: [lon, lat], accuracy }

  const setOverlay = useCallback((key, node) => {
    setOverlays((o) => {
      if (node === null) {
        const { [key]: _removed, ...rest } = o;
        return rest;
      }
      return { ...o, [key]: node };
    });
  }, []);

  const value = useMemo(
    () => ({ map, setMap, overlays, setOverlay, legendOpen, setLegendOpen, userPosition, setUserPosition }),
    [map, overlays, setOverlay, legendOpen, userPosition],
  );
  return <MapCtx.Provider value={value}>{children}</MapCtx.Provider>;
}

export function useMapContext() {
  const ctx = useContext(MapCtx);
  if (!ctx) throw new Error('useMapContext trebuie folosit în <MapProvider>');
  return ctx;
}

export function useMapOverlay(key, node) {
  const { setOverlay } = useMapContext();
  useEffect(() => {
    setOverlay(key, node);
  }, [key, node, setOverlay]);
  useEffect(() => () => setOverlay(key, null), [key, setOverlay]);
}

import { useEffect } from 'react';
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { DEMO_BBOX, DEMO_CENTER, DEMO_ZOOM, TILE_ATTRIBUTION, TILE_URL, TILE_URL_DARK } from '../../config/env.js';
import { prefersReducedMotion } from '../../accessibility/useReducedMotion.js';
import { bboxFromBounds, bboxToLatLngBounds, toLatLng } from './geo.js';

// Zona în care harta are voie să se miște: zona demo plus o margine.
const [minLon, minLat, maxLon, maxLat] = DEMO_BBOX;
const MARGIN = 0.02;
const MAX_BOUNDS = bboxToLatLngBounds([minLon - MARGIN, minLat - MARGIN, maxLon + MARGIN, maxLat + MARGIN]);

function BoundsReporter({ onBoundsChange }) {
  const map = useMapEvents({
    moveend: () => onBoundsChange?.(bboxFromBounds(map.getBounds())),
  });
  useEffect(() => {
    onBoundsChange?.(bboxFromBounds(map.getBounds()));
    // doar la montare; mișcările ulterioare vin prin moveend
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);
  return null;
}

function MapReady({ onReady }) {
  const map = useMap();
  useEffect(() => {
    onReady?.(map);
    return () => onReady?.(null);
  }, [map, onReady]);
  return null;
}

function AttributionPosition({ position }) {
  const map = useMap();
  useEffect(() => {
    map.attributionControl?.setPrefix(false);
    map.attributionControl?.setPosition(position);
  }, [map, position]);
  return null;
}

/**
 * Harta Leaflet a aplicației. Primește coordonate GeoJSON [lon, lat];
 * conversia în [lat, lon] se face doar în components/map.
 * Fără butoanele de zoom din Leaflet (doar iconițe): controalele cu text vin separat.
 */
export default function MapView({
  center = DEMO_CENTER,
  zoom = DEMO_ZOOM,
  dark = false,
  onBoundsChange,
  onReady,
  attributionPosition = 'bottomright',
  label = 'Harta zonei Complexului Studențesc',
  className = '',
  children,
}) {
  const reduced = prefersReducedMotion();
  return (
    <MapContainer
      center={toLatLng(center)}
      zoom={zoom}
      minZoom={14}
      maxZoom={19}
      maxBounds={MAX_BOUNDS}
      maxBoundsViscosity={0.8}
      zoomControl={false}
      keyboard
      zoomAnimation={!reduced}
      fadeAnimation={!reduced}
      markerZoomAnimation={!reduced}
      inertia={!reduced}
      className={`h-full w-full ${className}`}
      aria-label={label}
      role="region"
    >
      <TileLayer
        key={dark ? 'dark' : 'light'}
        url={dark && TILE_URL_DARK ? TILE_URL_DARK : TILE_URL}
        className={dark && !TILE_URL_DARK ? 'map-dark' : ''}
        attribution={TILE_ATTRIBUTION}
        maxZoom={19}
      />
      <AttributionPosition position={attributionPosition} />
      {onReady && <MapReady onReady={onReady} />}
      {onBoundsChange && <BoundsReporter onBoundsChange={onBoundsChange} />}
      {children}
    </MapContainer>
  );
}

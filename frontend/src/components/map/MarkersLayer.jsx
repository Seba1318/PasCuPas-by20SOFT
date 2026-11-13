import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.markercluster';
import { markerSvg } from './markerSvg.js';
import { toLatLng } from './geo.js';
import { usePrefs } from '../../accessibility/PrefsProvider.jsx';

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

function clusterIcon(cluster) {
  const n = cluster.getChildCount();
  return L.divIcon({
    html: `<span class="pcp-cluster" aria-hidden="true">${n}</span>`,
    className: 'pcp-marker',
    iconSize: [48, 48],
  });
}

/**
 * Markerele unui strat, desenate cu L.divIcon (SVG din markerSvg).
 * items: [{ id, type, point: [lon, lat], label, name? }]. `label` e numele accesibil complet,
 * `name` e eticheta vizibilă sub marker (doar pentru locurile importante).
 * Markerele sunt focusabile; Enter le deschide, la fel ca un clic.
 */
export default function MarkersLayer({ items, onSelect, selectedId = null, cluster = true }) {
  const map = useMap();
  const { contrast } = usePrefs();
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    const group = cluster
      ? L.markerClusterGroup({
          showCoverageOnHover: false,
          maxClusterRadius: 36,
          disableClusteringAtZoom: 16,
          iconCreateFunction: clusterIcon,
        })
      : L.layerGroup();

    group.on('clusterclick', () => {}); // implicit: zoom pe grup

    for (const item of items) {
      const selected = item.id === selectedId;
      const label = item.name ? `<span class="pcp-marker-name" aria-hidden="true">${escapeHtml(item.name)}</span>` : '';
      const marker = L.marker(toLatLng(item.point), {
        icon: L.divIcon({
          html: markerSvg({ type: item.type, selected, highContrast: contrast === 'high' }) + label,
          className: 'pcp-marker',
          iconSize: [48, 48],
          iconAnchor: [24, 24],
        }),
        keyboard: true,
        zIndexOffset: selected ? 1000 : 0,
        riseOnHover: true,
      });
      marker.on('add', () => {
        const el = marker.getElement();
        el?.setAttribute('role', 'button');
        el?.setAttribute('aria-label', item.label);
        if (selected) el?.setAttribute('aria-pressed', 'true');
      });
      if (onSelectRef.current) marker.on('click', () => onSelectRef.current?.(item));
      group.addLayer(marker);
    }
    map.addLayer(group);
    return () => {
      map.removeLayer(group);
    };
  }, [map, items, selectedId, cluster, contrast]);

  return null;
}

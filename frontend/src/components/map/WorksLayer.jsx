import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { WORKS_COLORS } from '../../theme/mapColors.js';
import { formatDate } from '../../lib/format.js';

// Modelul de hașură e definit o singură dată în pagină (vezi WorksPattern) și referit prin url(#...).
const PATTERN_ID = 'pcp-works-hatch';

export function WorksPattern() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden="true" focusable="false">
      <defs>
        <pattern id={PATTERN_ID} width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="14" height="14" fill={WORKS_COLORS.stripeA} />
          <rect width="7" height="14" fill={WORKS_COLORS.stripeB} />
        </pattern>
      </defs>
    </svg>
  );
}

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

/**
 * Lucrările active: zonele hașurate cu contur punctat, segmentele de stradă cu linie plină hașurată.
 * La clic, titlul și perioada (design/Harta · Lucrări).
 */
export default function WorksLayer({ works }) {
  const map = useMap();
  useEffect(() => {
    const layer = L.geoJSON(
      { type: 'FeatureCollection', features: works },
      {
        style: (f) =>
          f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'
            ? { color: WORKS_COLORS.outline, weight: 2, dashArray: '6 4', fillColor: `url(#${PATTERN_ID})`, fillOpacity: 0.85 }
            : { color: `url(#${PATTERN_ID})`, weight: 10, opacity: 1 },
        onEachFeature: (f, l) => {
          const p = f.properties;
          l.bindPopup(
            `<strong>${escapeHtml(p.title)}</strong><br>${formatDate(p.start_date)} – ${formatDate(p.end_date)}` +
              (p.blocks_route ? '<br>Traseele ocolesc zona.' : ''),
          );
        },
      },
    );
    layer.addTo(map);
    return () => {
      map.removeLayer(layer);
    };
  }, [map, works]);
  return null;
}

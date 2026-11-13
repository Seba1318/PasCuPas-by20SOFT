import { useEffect, useState } from 'react';
import { places as placesApi, reports as reportsApi, transit } from '../../api/endpoints.js';

const EMPTY = { places: [], reports: [], works: [], stops: [] };

/**
 * Datele din zona vizibilă: locuri, probleme active, lucrări, stații.
 * Se reîncarcă la 300 ms după ce harta s-a oprit din mișcare.
 */
export function useMapData(bbox) {
  const [data, setData] = useState(EMPTY);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!bbox) return undefined;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const [p, r, w, s] = await Promise.all([
          placesApi.list({ bbox }),
          reportsApi.list({ bbox, status: 'in_lucru' }),
          placesApi.works({ bbox }),
          transit.stops({ bbox }),
        ]);
        if (cancelled) return;
        setData({ places: p.features, reports: r.features, works: w.features, stops: s.features });
        setStatus('ready');
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setStatus('error');
        setError(err.detail ?? 'Nu am putut încărca harta.');
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [bbox]);

  return { ...data, status, error };
}

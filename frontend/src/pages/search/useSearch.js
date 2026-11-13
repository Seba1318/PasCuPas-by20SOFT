import { useEffect, useState } from 'react';
import { places } from '../../api/endpoints.js';

// Căutare cu pauză de 300 ms după ultima tastă; sub 2 caractere nu întrebăm serverul.
export function useSearch(query) {
  const [state, setState] = useState({ status: 'idle', results: [], error: null });
  const q = query.trim();

  useEffect(() => {
    if (q.length < 2) {
      setState({ status: 'idle', results: [], error: null });
      return undefined;
    }
    let cancelled = false;
    setState((s) => ({ ...s, status: 'loading' }));
    const timer = setTimeout(async () => {
      try {
        const results = await places.search(q);
        if (!cancelled) setState({ status: results.length ? 'done' : 'empty', results, error: null });
      } catch (err) {
        if (!cancelled) setState({ status: 'error', results: [], error: err.detail });
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q]);

  return state;
}

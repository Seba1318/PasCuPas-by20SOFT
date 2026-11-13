import { useEffect, useState } from 'react';
import { routes } from '../../api/endpoints.js';
import { planErrorKind } from './routeUtils.js';

// Cere traseul când avem plecare și destinație. status: idle | loading | ok | no_route | out_of_area | error
export function useRoutePlan(from, to, mode, retryKey = 0) {
  const [state, setState] = useState({ status: 'idle', data: null, error: null });
  const fromKey = from?.point?.join(',');
  const toKey = to?.point?.join(',');

  useEffect(() => {
    if (!fromKey || !toKey) {
      setState({ status: 'idle', data: null, error: null });
      return undefined;
    }
    let cancelled = false;
    setState({ status: 'loading', data: null, error: null });
    routes
      .plan({ start: from.point, end: to.point, mode })
      .then((data) => !cancelled && setState({ status: 'ok', data, error: null }))
      .catch((err) => !cancelled && setState({ status: planErrorKind(err), data: null, error: err.detail }));
    return () => {
      cancelled = true;
    };
    // punctele sunt comparate prin cheile lor text
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromKey, toKey, mode, retryKey]);

  return state;
}

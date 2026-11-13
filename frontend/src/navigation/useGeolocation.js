import { useEffect, useState } from 'react';

/**
 * Poziția GPS urmărită continuu (watchPosition). status:
 * 'prompt' | 'granted' | 'denied' | 'unavailable' | 'insecure' (GPS-ul merge doar pe HTTPS).
 */
export function useGeolocation(active = true) {
  const [state, setState] = useState({ position: null, status: 'prompt' });

  useEffect(() => {
    if (!active) return undefined;
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setState({ position: null, status: 'insecure' });
      return undefined;
    }
    if (!navigator.geolocation) {
      setState({ position: null, status: 'unavailable' });
      return undefined;
    }
    const id = navigator.geolocation.watchPosition(
      (p) =>
        setState({
          status: 'granted',
          position: { lon: p.coords.longitude, lat: p.coords.latitude, accuracy: p.coords.accuracy, heading: p.coords.heading, at: p.timestamp },
        }),
      (err) => setState((s) => ({ ...s, status: err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable' })),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [active]);

  return state;
}

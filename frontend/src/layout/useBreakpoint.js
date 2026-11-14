import { useEffect, useState } from 'react';
import { breakpointFor, isPhoneScreen } from './breakpoints.js';

function readPhoneScreen() {
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  return isPhoneScreen({ width: window.innerWidth, height: window.innerHeight, coarse });
}

// true pe telefon, și când e rotit (landscape): aici rămâne disponibilă navigarea cu GPS.
export function usePhoneScreen() {
  const [phone, setPhone] = useState(readPhoneScreen);
  useEffect(() => {
    const onResize = () => setPhone(readPhoneScreen());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return phone;
}

export function useBreakpoint() {
  const [bp, setBp] = useState(() => breakpointFor(window.innerWidth));
  useEffect(() => {
    const onResize = () => setBp(breakpointFor(window.innerWidth));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return bp;
}

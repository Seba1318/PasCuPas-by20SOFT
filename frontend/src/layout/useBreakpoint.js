import { useEffect, useState } from 'react';
import { breakpointFor } from './breakpoints.js';

export function useBreakpoint() {
  const [bp, setBp] = useState(() => breakpointFor(window.innerWidth));
  useEffect(() => {
    const onResize = () => setBp(breakpointFor(window.innerWidth));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return bp;
}

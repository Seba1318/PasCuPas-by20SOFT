import { useEffect } from 'react';

/**
 * O foaie de jos de pe telefon acoperă colțul hărții unde stă atribuirea OSM.
 * Hook-ul publică înălțimea foii, iar CSS-ul (.leaflet-bottom) urcă atribuirea deasupra ei.
 */
export function useSheetOffset(ref, active = true) {
  useEffect(() => {
    const el = ref.current;
    const root = document.documentElement;
    if (!el || !active) return undefined;
    const update = () => root.style.setProperty('--pcp-sheet', `${el.offsetHeight}px`);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty('--pcp-sheet');
    };
  }, [ref, active]);
}

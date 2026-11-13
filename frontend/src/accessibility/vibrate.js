// Vibrații la viraje. Pe iPhone nu există API-ul: alertele vizuale rămân canalul principal.
export function vibrate(pattern, nav = globalThis.navigator) {
  if (typeof nav?.vibrate !== 'function') return false;
  return nav.vibrate(pattern) !== false;
}

export const PATTERNS = { turn: [200, 100, 200], alert: [400, 150, 400, 150, 400], arrived: [300] };

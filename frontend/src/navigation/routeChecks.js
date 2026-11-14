// Verificarea periodică a traseului în timpul mersului (planul 20SOFT · Navigarea în timp real):
// la fiecare `everyMs`, întrebăm API-ul dacă a apărut un blocaj pe traseu.
// Poziția se citește abia la verificare (getPosition), așa că pozițiile GPS noi nu repornesc ceasul.
export function startRouteChecks({ everyMs = 30000, check, getPosition, onBlocked, timers = globalThis }) {
  const id = timers.setInterval(async () => {
    try {
      const res = await check();
      const position = getPosition();
      if (res?.blocked && position) await onBlocked(res, position);
    } catch {
      /* verificăm din nou la următorul interval */
    }
  }, everyMs);
  return () => timers.clearInterval(id);
}

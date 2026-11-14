import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startRouteChecks } from './routeChecks.js';

// Ceas fals: păstrează funcția programată, ca testul să o poată rula când vrea.
function fakeTimers() {
  const t = {
    tick: null,
    ms: null,
    cleared: false,
    setInterval(fn, ms) {
      t.tick = fn;
      t.ms = ms;
      return 7;
    },
    clearInterval(id) {
      if (id === 7) t.cleared = true;
    },
  };
  return t;
}

test('a blocked route is reported with the position at check time, not the one at start', async () => {
  const timers = fakeTimers();
  let position = { lon: 21.2372, lat: 45.7482 };
  const calls = [];
  startRouteChecks({
    everyMs: 30000,
    timers,
    check: async () => ({ blocked: true, reason: 'Rampă blocată' }),
    getPosition: () => position,
    onBlocked: (res, pos) => calls.push([res.reason, pos]),
  });
  position = { lon: 21.2300, lat: 45.7480 }; // utilizatorul a mers mai departe
  await timers.tick();
  assert.equal(timers.ms, 30000);
  assert.deepEqual(calls, [['Rampă blocată', { lon: 21.2300, lat: 45.7480 }]]);
});

test('nothing happens when the route is clear, the position is unknown or the check fails', async () => {
  const cases = [
    { check: async () => ({ blocked: false }), position: { lon: 21.23, lat: 45.748 } },
    { check: async () => ({ blocked: true }), position: null },
    { check: async () => { throw new Error('offline'); }, position: { lon: 21.23, lat: 45.748 } },
  ];
  for (const c of cases) {
    const timers = fakeTimers();
    let called = false;
    startRouteChecks({ timers, check: c.check, getPosition: () => c.position, onBlocked: () => { called = true; } });
    await timers.tick();
    assert.equal(called, false);
  }
});

test('stopping the checks clears the timer', () => {
  const timers = fakeTimers();
  const stop = startRouteChecks({ timers, check: async () => ({ blocked: false }), getPosition: () => null, onBlocked: () => {} });
  stop();
  assert.equal(timers.cleared, true);
});

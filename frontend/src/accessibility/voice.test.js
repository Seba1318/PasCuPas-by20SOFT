import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSpeaker } from './voice.js';
import { vibrate } from './vibrate.js';

function fakeSynth() {
  const spoken = [];
  return { spoken, cancelled: 0, speak(u) { spoken.push(u); }, cancel() { this.cancelled++; } };
}
class FakeUtterance {
  constructor(text) { this.text = text; }
}

test('speaks Romanian and cancels the previous sentence', () => {
  const synth = fakeSynth();
  const speaker = createSpeaker(synth, FakeUtterance);
  speaker.speak('Virează la stânga');
  assert.equal(synth.spoken[0].text, 'Virează la stânga');
  assert.equal(synth.spoken[0].lang, 'ro-RO');
  assert.equal(synth.cancelled, 1);
  assert.equal(speaker.available, true);
});

test('without speech synthesis nothing breaks', () => {
  const speaker = createSpeaker(undefined, undefined);
  assert.equal(speaker.available, false);
  assert.doesNotThrow(() => speaker.speak('test'));
});

test('vibrate is a no-op without the API (iPhone)', () => {
  assert.equal(vibrate([200], {}), false);
  let called = null;
  assert.equal(vibrate([200, 100], { vibrate: (p) => { called = p; return true; } }), true);
  assert.deepEqual(called, [200, 100]);
});

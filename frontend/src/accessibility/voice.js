// Indicații vocale în română (Web Speech API). Fără suport în browser, vocea pur și simplu tace;
// textul de pe ecran rămâne sursa principală.
export function createSpeaker(synth = globalThis.speechSynthesis, Utterance = globalThis.SpeechSynthesisUtterance) {
  const available = !!synth && typeof Utterance === 'function';
  return {
    available,
    speak(text) {
      if (!available) return;
      synth.cancel();
      const u = new Utterance(text);
      u.lang = 'ro-RO';
      u.rate = 0.95;
      synth.speak(u);
    },
    stop() {
      if (available) synth.cancel();
    },
  };
}

export const speaker = createSpeaker();

// Sound effects synthesized with the Web Audio API, so there are no audio files to load.
// Browsers only allow audio after a user gesture, so the context starts on the first click or key press.
const Sound = (() => {
  let ctx = null;
  let master = null;
  let noise = null;
  let enabled = true;

  function unlock() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      const comp = ctx.createDynamicsCompressor();
      master = ctx.createGain();
      master.gain.value = 0.6;
      master.connect(comp).connect(ctx.destination);

      noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === "suspended") ctx.resume();
  }

  const ready = () => enabled && ctx && ctx.state !== "closed";
  const jitter = (v, amt = 0.06) => v * (1 + (Math.random() - 0.5) * amt);

  // Short envelope: quick attack, exponential decay
  function envelope(gainNode, t, peak, decay, attack = 0.005) {
    gainNode.gain.setValueAtTime(0.0001, t);
    gainNode.gain.exponentialRampToValueAtTime(peak, t + attack);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  function tone(freq, { type = "sine", at = 0, gain = 0.2, decay = 0.25, attack, detune = 0 } = {}) {
    if (!ready()) return;
    const t = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.detune.value = detune;
    envelope(g, t, gain, decay, attack);
    osc.connect(g).connect(master);
    osc.start(t);
    osc.stop(t + decay + 0.05);
  }

  function noiseBurst({ at = 0, gain = 0.2, decay = 0.08, type = "bandpass", freq = 2000, q = 1, sweepTo, attack } = {}) {
    if (!ready()) return;
    const t = ctx.currentTime + at;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, t);
    if (sweepTo) filter.frequency.exponentialRampToValueAtTime(sweepTo, t + decay);
    filter.Q.value = q;
    const g = ctx.createGain();
    envelope(g, t, gain, decay, attack);
    src.connect(filter).connect(g).connect(master);
    src.start(t, Math.random() * 0.5);
    src.stop(t + decay + 0.05);
  }

  const C5 = 523.25, E5 = 659.25, G5 = 783.99, C6 = 1046.5;

  return {
    unlock,
    set enabled(v) { enabled = v; },
    get enabled() { return enabled; },

    // card sliding across the felt
    swish({ at = 0, gain = 0.16 } = {}) {
      noiseBurst({ at, gain, decay: 0.16, attack: 0.04, freq: jitter(700, 0.3), sweepTo: jitter(2600, 0.2), q: 0.8 });
    },
    // card landing on the table
    thud({ at = 0 } = {}) {
      noiseBurst({ at, gain: 0.22, decay: 0.05, type: "lowpass", freq: 1400 });
      tone(jitter(150), { at, gain: 0.25, decay: 0.08 });
    },
    // card flipping over
    snap({ at = 0 } = {}) {
      noiseBurst({ at, gain: 0.18, decay: 0.03, freq: 3200, q: 2 });
      noiseBurst({ at: at + 0.07, gain: 0.22, decay: 0.04, freq: 2200, q: 1.5 });
    },
    // hover / computer considering a card
    tick({ gain = 0.05, freq = 1700 } = {}) {
      tone(jitter(freq, 0.1), { gain, decay: 0.03, type: "triangle" });
    },
    // poker chip dropping onto the stack
    chip({ at = 0 } = {}) {
      for (const [f, d] of [[2093, 0.12], [3136, 0.09], [4699, 0.06]]) tone(jitter(f, 0.03), { at, gain: 0.07, decay: d });
      for (const [f, d] of [[2349, 0.1], [3520, 0.07]]) tone(jitter(f, 0.03), { at: at + 0.06, gain: 0.05, decay: d });
    },
    click() {
      tone(jitter(900), { gain: 0.08, decay: 0.04, type: "triangle" });
    },
    win() {
      [C5, E5, G5].forEach((f, i) => tone(f, { at: i * 0.08, type: "triangle", gain: 0.16, decay: 0.3 }));
      tone(C6, { at: 0.24, type: "sine", gain: 0.1, decay: 0.5 });
    },
    lose() {
      tone(392, { type: "triangle", gain: 0.14, decay: 0.22 });
      tone(311.13, { at: 0.12, type: "triangle", gain: 0.14, decay: 0.4 });
    },
    draw() {
      tone(440, { type: "triangle", gain: 0.1, decay: 0.12 });
      tone(440, { at: 0.12, type: "triangle", gain: 0.08, decay: 0.16 });
    },
    gameWin() {
      [C5, E5, G5, C6].forEach((f, i) => tone(f, { at: i * 0.11, type: "triangle", gain: 0.18, decay: 0.35 }));
      for (const f of [C5, E5, G5, C6]) tone(f, { at: 0.48, type: "sine", gain: 0.08, decay: 1.1, attack: 0.02, detune: 4 });
    },
    gameLose() {
      [392, 349.23, 311.13, 261.63].forEach((f, i) => tone(f, { at: i * 0.16, type: "triangle", gain: 0.13, decay: 0.45 }));
    },
  };
})();

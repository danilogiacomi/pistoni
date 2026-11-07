// Audio condiviso: contesto, sintetizzatore "tipo ottone", click del metronomo, bordone.

let ctx = null;
let master = null;

export function getCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC({ latencyHint: 'interactive' });
    master = ctx.createGain();
    master.gain.value = 0.8;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.ratio.value = 4;
    master.connect(comp).connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function getMaster() {
  getCtx();
  return master;
}

// Sblocca l'audio su iOS al primo tocco
export function unlockAudioOnGesture() {
  const unlock = () => {
    const c = getCtx();
    const b = c.createBuffer(1, 1, 22050);
    const s = c.createBufferSource();
    s.buffer = b;
    s.connect(c.destination);
    s.start(0);
    window.removeEventListener('touchend', unlock);
    window.removeEventListener('click', unlock);
  };
  window.addEventListener('touchend', unlock, { once: true });
  window.addEventListener('click', unlock, { once: true });
}

/**
 * Suona una nota con timbro brillante tipo ottone.
 * @returns {{stop: (t?:number)=>void}}
 */
export function brassNote(freq, start, duration, { volume = 0.35, attack = 0.04, release = 0.08 } = {}) {
  const c = getCtx();
  const t0 = start ?? c.currentTime;
  const osc1 = c.createOscillator();
  const osc2 = c.createOscillator();
  osc1.type = 'sawtooth';
  osc2.type = 'square';
  osc1.frequency.value = freq;
  osc2.frequency.value = freq;
  osc2.detune.value = 4;

  // vibrato leggero che entra dopo l'attacco
  const lfo = c.createOscillator();
  const lfoGain = c.createGain();
  lfo.frequency.value = 5.2;
  lfoGain.gain.setValueAtTime(0, t0);
  lfoGain.gain.linearRampToValueAtTime(0, t0 + 0.35);
  lfoGain.gain.linearRampToValueAtTime(freq * 0.004, t0 + 0.8);
  lfo.connect(lfoGain);
  lfoGain.connect(osc1.frequency);
  lfoGain.connect(osc2.frequency);

  const mix2 = c.createGain();
  mix2.gain.value = 0.25;

  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.value = 1.2;
  // "blare" d'attacco: il filtro si apre e poi si assesta
  const base = Math.min(freq * 4, 5000);
  filter.frequency.setValueAtTime(freq * 1.5, t0);
  filter.frequency.linearRampToValueAtTime(Math.min(freq * 8, 9000), t0 + attack + 0.02);
  filter.frequency.exponentialRampToValueAtTime(base, t0 + attack + 0.2);

  const amp = c.createGain();
  amp.gain.setValueAtTime(0.0001, t0);
  amp.gain.exponentialRampToValueAtTime(volume, t0 + attack);
  amp.gain.setValueAtTime(volume, t0 + Math.max(attack, duration - release));
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

  osc1.connect(filter);
  osc2.connect(mix2).connect(filter);
  filter.connect(amp).connect(getMaster());

  const end = t0 + duration + 0.05;
  [osc1, osc2, lfo].forEach((o) => { o.start(t0); o.stop(end); });

  return {
    stop(t) {
      const now = t ?? c.currentTime;
      try {
        amp.gain.cancelScheduledValues(now);
        amp.gain.setValueAtTime(amp.gain.value || 0.0001, now);
        amp.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
        [osc1, osc2, lfo].forEach((o) => o.stop(now + 0.06));
      } catch (e) { /* già fermato */ }
    },
  };
}

/** Click del metronomo. level: 2 = accento, 1 = battito, 0 = suddivisione */
export function click(time, level = 1, volume = 0.9, sound = 'beep') {
  const c = getCtx();
  const osc = c.createOscillator();
  const g = c.createGain();
  if (sound === 'wood') {
    osc.type = 'triangle';
    osc.frequency.value = level === 2 ? 1800 : level === 1 ? 1300 : 900;
  } else {
    osc.type = 'square';
    osc.frequency.value = level === 2 ? 1760 : level === 1 ? 1100 : 750;
  }
  const v = volume * (level === 2 ? 0.55 : level === 1 ? 0.4 : 0.2);
  g.gain.setValueAtTime(0.0001, time);
  g.gain.exponentialRampToValueAtTime(v, time + 0.001);
  g.gain.exponentialRampToValueAtTime(0.0001, time + (sound === 'wood' ? 0.05 : 0.035));
  osc.connect(g).connect(getMaster());
  osc.start(time);
  osc.stop(time + 0.07);
}

/** Bordone (nota tenuta) per lavorare su intonazione e scale. */
export function startDrone(freq, { volume = 0.25, withFifth = false } = {}) {
  const c = getCtx();
  const out = c.createGain();
  out.gain.setValueAtTime(0.0001, c.currentTime);
  out.gain.exponentialRampToValueAtTime(volume, c.currentTime + 0.6);
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = Math.min(freq * 5, 4000);
  filter.connect(out).connect(getMaster());

  const voices = [];
  const add = (f, type, gain, detune = 0) => {
    const o = c.createOscillator();
    o.type = type;
    o.frequency.value = f;
    o.detune.value = detune;
    const g = c.createGain();
    g.gain.value = gain;
    o.connect(g).connect(filter);
    o.start();
    voices.push(o);
  };
  add(freq, 'sawtooth', 0.35, -3);
  add(freq, 'sawtooth', 0.35, 3);
  add(freq / 2, 'sine', 0.5);
  if (withFifth) add(freq * 1.5, 'sawtooth', 0.2);

  return {
    setFreq(f) {
      voices[0].frequency.setTargetAtTime(f, c.currentTime, 0.05);
      voices[1].frequency.setTargetAtTime(f, c.currentTime, 0.05);
      voices[2].frequency.setTargetAtTime(f / 2, c.currentTime, 0.05);
      if (voices[3]) voices[3].frequency.setTargetAtTime(f * 1.5, c.currentTime, 0.05);
      filter.frequency.setTargetAtTime(Math.min(f * 5, 4000), c.currentTime, 0.05);
    },
    stop() {
      const now = c.currentTime;
      out.gain.cancelScheduledValues(now);
      out.gain.setValueAtTime(out.gain.value, now);
      out.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
      voices.forEach((o) => o.stop(now + 0.45));
    },
  };
}

/** Campanella morbida (fine timer). */
export function bell() {
  const c = getCtx();
  const t = c.currentTime;
  [880, 1320].forEach((f, i) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t + i * 0.15);
    g.gain.exponentialRampToValueAtTime(0.3, t + i * 0.15 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.15 + 1.2);
    o.connect(g).connect(getMaster());
    o.start(t + i * 0.15);
    o.stop(t + i * 0.15 + 1.3);
  });
}

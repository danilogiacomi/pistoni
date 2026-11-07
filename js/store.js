// Persistenza locale (impostazioni + diario di studio).
const KEY = 'pistoni:v1';

const defaults = {
  settings: {
    a4: 440,
    instrument: 'Bb', // 'Bb' | 'C'
    names: 'it', // 'it' (Do Re Mi) | 'en' (C D E)
    level: 'base', // 'base' | 'medio' | 'avanzato'
    metronomeSound: 'beep',
  },
  log: {}, // { 'YYYY-MM-DD': secondi }
  done: {}, // { 'YYYY-MM-DD': [stepId,...] }
  metronome: { bpm: 80, beats: 4, sub: 1, accent: true },
  quizBest: 0,
};

let state;
try {
  const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
  state = raw ? { ...defaults, ...raw, settings: { ...defaults.settings, ...(raw.settings || {}) } } : structuredClone(defaults);
} catch (e) {
  state = structuredClone(defaults);
}

const listeners = new Set();

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage pieno o bloccato */ }
  listeners.forEach((fn) => fn(state));
}

export const store = {
  get: () => state,
  settings: () => state.settings,
  setSetting(k, v) { state.settings[k] = v; save(); },
  set(k, v) { state[k] = v; save(); },
  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },

  addPractice(seconds) {
    const d = today();
    state.log[d] = (state.log[d] || 0) + Math.round(seconds);
    save();
  },
  markDone(stepId) {
    const d = today();
    const arr = state.done[d] || (state.done[d] = []);
    if (!arr.includes(stepId)) arr.push(stepId);
    save();
  },
  unmarkDone(stepId) {
    const d = today();
    state.done[d] = (state.done[d] || []).filter((x) => x !== stepId);
    save();
  },
  doneToday() { return state.done[today()] || []; },
  secondsOn(d) { return state.log[d] || 0; },
  streak() {
    let n = 0;
    const dt = new Date();
    // se oggi non hai ancora studiato, la serie conta fino a ieri
    if (!state.log[fmt(dt)]) dt.setDate(dt.getDate() - 1);
    while (state.log[fmt(dt)] >= 60) { n++; dt.setDate(dt.getDate() - 1); }
    return n;
  },
  reset() { state = structuredClone(defaults); save(); },
};

export function fmt(d) {
  const z = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}
export function today() { return fmt(new Date()); }

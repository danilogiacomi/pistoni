// Cronometro della sessione di studio (salva il tempo nel diario).
import { store } from './store.js';

let running = false;
let startedAt = 0;
let unsaved = 0; // secondi accumulati non ancora salvati
let sessionTotal = 0;
let tick = null;
const listeners = new Set();

function emit() { listeners.forEach((fn) => fn(state())); }

function flush() {
  if (!running) return;
  const now = Date.now();
  const delta = (now - startedAt) / 1000;
  startedAt = now;
  unsaved += delta;
  sessionTotal += delta;
  if (unsaved >= 10) {
    store.addPractice(unsaved);
    unsaved = 0;
  }
}

export function state() {
  const live = running ? (Date.now() - startedAt) / 1000 : 0;
  return { running, elapsed: sessionTotal + live };
}

export const session = {
  start() {
    if (running) return;
    running = true;
    startedAt = Date.now();
    tick = setInterval(() => { flush(); emit(); }, 1000);
    emit();
  },
  pause() {
    if (!running) return;
    flush();
    running = false;
    clearInterval(tick);
    if (unsaved > 0) { store.addPractice(unsaved); unsaved = 0; }
    emit();
  },
  reset() {
    this.pause();
    sessionTotal = 0;
    emit();
  },
  toggle() { running ? this.pause() : this.start(); },
  state,
  on(fn) { listeners.add(fn); fn(state()); return () => listeners.delete(fn); },
};

// salva prima di chiudere/andare in background
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && running) {
    flush();
    if (unsaved > 0) { store.addPractice(unsaved); unsaved = 0; }
  }
});

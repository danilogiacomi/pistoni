// Riproduzione di un esercizio: count-in, note sintetizzate, click e evidenziazione.
import { getCtx, brassNote, click } from './audio.js';
import { writtenToFreq } from './music.js';
import { store } from './store.js';

const BEATS = { w: 4, h: 2, q: 1, 8: 0.5, '16': 0.25, '8t': 1 / 3 };

export function createPlayer({ onNote, onEnd, onBeat }) {
  let timer = null;
  let playing = false;
  let voices = [];
  let timeouts = [];

  function stop() {
    playing = false;
    clearTimeout(timer);
    timeouts.forEach(clearTimeout);
    timeouts = [];
    voices.forEach((v) => v.stop());
    voices = [];
    onNote?.(-1);
  }

  /**
   * notes: array di note scritte; opts: { bpm, sound, clickOn, loop, concert, countIn }
   */
  function play(notes, opts) {
    stop();
    playing = true;
    const c = getCtx();
    const { a4, instrument } = store.settings();
    const inst = opts.concert ? 'C' : instrument;
    const spb = 60 / opts.bpm;
    const countBeats = opts.countIn ?? 4;
    let t = c.currentTime + 0.15;

    const schedule = (time, fn) => {
      const ms = Math.max(0, (time - c.currentTime) * 1000);
      timeouts.push(setTimeout(fn, ms));
    };

    // count-in
    for (let b = 0; b < countBeats; b++) {
      const bt = t + b * spb;
      click(bt, b === 0 ? 2 : 1, 0.9, store.settings().metronomeSound);
      schedule(bt, () => onBeat?.(countBeats - b));
    }
    t += countBeats * spb;
    schedule(t, () => onBeat?.(0));

    // battiti di click durante l'esercizio
    const total = notes.reduce((s, n) => s + (BEATS[n.dur] ?? 1), 0);
    if (opts.clickOn) {
      for (let b = 0; b < Math.ceil(total - 1e-6); b++) {
        click(t + b * spb, b % 4 === 0 ? 2 : 1, 0.7, store.settings().metronomeSound);
      }
    }

    let pos = t;
    notes.forEach((n, i) => {
      const dur = (BEATS[n.dur] ?? 1) * spb;
      if (!n.rest && opts.sound) {
        const legato = dur > 0.5 ? dur - 0.06 : dur * 0.88;
        voices.push(brassNote(writtenToFreq(n.midi, a4, inst), pos, legato, { volume: 0.3 }));
      }
      const at = pos;
      schedule(at, () => playing && onNote?.(i));
      pos += dur;
    });

    timer = setTimeout(() => {
      if (!playing) return;
      if (opts.loop) play(notes, { ...opts, countIn: 0 });
      else { stop(); onEnd?.(); }
    }, (pos - c.currentTime) * 1000);
    // libera la memoria delle voci concluse
    timeouts.push(setTimeout(() => { voices = voices.slice(-8); }, (pos - c.currentTime) * 1000 + 200));
  }

  return { play, stop, isPlaying: () => playing };
}

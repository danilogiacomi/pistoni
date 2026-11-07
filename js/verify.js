// "Suona e verifica": confronta ciò che senti dal microfono con le note dello spartito.
import { getCtx } from './audio.js';
import { freqToMidiFloat, TRANSPOSE } from './music.js';

const LATENCY = 0.05; // ritardo stimato tra suono e lettura dell'analizzatore (s)
export const OK_CENTS = 12;

/**
 * timeline: [{i, start, end, midi, rest}] in tempo AudioContext
 * tracker: { read() } (vedi mic.createPitchTracker)
 */
export function createVerifier({ timeline, instrument, a4, tracker, onMark, onLive }) {
  const c = getCtx();
  const notes = timeline.filter((n) => !n.rest).map((n) => {
    const dur = n.end - n.start;
    return { ...n, from: n.start + Math.max(0.07, dur * 0.3), to: n.end + 0.02, samples: [], done: false };
  });
  const results = new Map();
  let idx = 0;

  function evaluate(n) {
    n.done = true;
    let r;
    const expected = (n.to - n.from) / 0.025; // letture attese nella finestra
    if (n.samples.length < Math.max(2, expected * 0.3)) {
      r = { cls: 'miss' };
    } else {
      const counts = new Map();
      n.samples.forEach((s) => { const k = Math.round(s); counts.set(k, (counts.get(k) || 0) + 1); });
      const [mode] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
      // tollera un attacco leggermente in anticipo/ritardo: basta che la nota giusta sia ben presente
      const targetShare = (counts.get(n.midi) || 0) / n.samples.length;
      if (mode !== n.midi && targetShare < 0.4) {
        r = { cls: 'bad', played: mode };
      } else {
        const cents = median(n.samples.filter((s) => Math.round(s) === n.midi).map((s) => (s - n.midi) * 100));
        r = { cls: Math.abs(cents) <= OK_CENTS ? 'ok' : 'near', cents };
      }
    }
    results.set(n.i, r);
    onMark?.(n.i, r);
  }

  const iv = setInterval(() => {
    const te = c.currentTime - LATENCY;
    // chiudi le note la cui finestra è passata
    while (idx < notes.length && te > notes[idx].to) { evaluate(notes[idx]); idx++; }
    const { freq, clarity } = tracker.read();
    let shown = null;
    if (freq > 0 && clarity > 0.8) {
      shown = freqToMidiFloat(freq, a4) - TRANSPOSE[instrument];
      for (let k = idx; k < notes.length && notes[k].from <= te; k++) {
        if (te >= notes[k].from && te <= notes[k].to) notes[k].samples.push(shown);
      }
    }
    onLive?.(shown);
  }, 25);

  return {
    /** Chiude la verifica e ritorna il riepilogo. complete=false se interrotta a metà. */
    finish(complete = true) {
      clearInterval(iv);
      if (complete) for (; idx < notes.length; idx++) if (!notes[idx].done) evaluate(notes[idx]);
      const evaluated = [...results.values()];
      const total = complete ? notes.length : evaluated.length;
      const count = (cls) => evaluated.filter((r) => r.cls === cls).length;
      const ok = count('ok');
      const near = count('near');
      const bad = count('bad');
      const miss = count('miss');
      const centsList = evaluated.filter((r) => r.cents != null).map((r) => Math.abs(r.cents));
      const score = total ? Math.round(((ok + near * 0.6) / total) * 100) : 0;
      return {
        total, ok, near, bad, miss, score,
        avgCents: centsList.length ? Math.round(centsList.reduce((a, b) => a + b, 0) / centsList.length) : null,
      };
    },
  };
}

function median(a) {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
}

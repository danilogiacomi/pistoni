// Microfono condiviso (accordatore, verifica, registratore) con conteggio dei riferimenti.
import { getCtx } from './audio.js';
import { detectPitch } from './pitch.js';

let stream = null;
let pending = null;
let refs = 0;

export async function acquireMic() {
  if (!stream) {
    pending = pending || navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    try {
      stream = await pending;
    } finally {
      pending = null;
    }
  }
  refs++;
  return stream;
}

export function releaseMic() {
  refs = Math.max(0, refs - 1);
  if (refs === 0 && stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
}

/** Analizzatore di altezza collegato al microfono. Chiama release() quando hai finito. */
export async function createPitchTracker() {
  const s = await acquireMic();
  const c = getCtx();
  const source = c.createMediaStreamSource(s);
  const analyser = c.createAnalyser();
  analyser.fftSize = 2048;
  source.connect(analyser);
  const buf = new Float32Array(analyser.fftSize);
  let released = false;
  return {
    read() {
      analyser.getFloatTimeDomainData(buf);
      return detectPitch(buf, c.sampleRate);
    },
    release() {
      if (released) return;
      released = true;
      try { source.disconnect(); } catch (e) { /* */ }
      releaseMic();
    },
  };
}

export function micErrorMessage(e) {
  if (!navigator.mediaDevices?.getUserMedia) return 'Questo browser non permette di usare il microfono.';
  if (e?.name === 'NotAllowedError') return 'Permesso del microfono negato: abilitalo nelle impostazioni del browser per questo sito.';
  if (e?.name === 'NotFoundError') return 'Nessun microfono trovato.';
  return 'Impossibile accedere al microfono.';
}

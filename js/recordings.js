// Registrazioni: MediaRecorder + archivio in IndexedDB (solo su questo dispositivo).
import { acquireMic, releaseMic } from './mic.js';

const DB = 'pistoni';
const STORE = 'recordings';
const MAX_KEEP = 30;

function openDb() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

function tx(mode, fn) {
  return openDb().then((db) => new Promise((res, rej) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    const out = fn(store);
    t.oncomplete = () => res(out?.result ?? out);
    t.onerror = () => rej(t.error);
  }));
}

export const recordings = {
  async add(rec) {
    const id = await tx('readwrite', (s) => s.add(rec));
    // tieni solo le più recenti
    const all = await this.list();
    for (const r of all.slice(MAX_KEEP)) await this.remove(r.id);
    return id;
  },
  async list() {
    const all = await tx('readonly', (s) => s.getAll());
    return (all || []).sort((a, b) => b.date - a.date);
  },
  remove(id) { return tx('readwrite', (s) => s.delete(id)); },
  rename(rec, title) { return tx('readwrite', (s) => s.put({ ...rec, title })); },
};

function pickMime() {
  if (!window.MediaRecorder) return null;
  for (const m of ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg;codecs=opus']) {
    if (MediaRecorder.isTypeSupported?.(m)) return m;
  }
  return '';
}

export function recorderSupported() {
  return !!(window.MediaRecorder && navigator.mediaDevices?.getUserMedia);
}

export function extFor(mime) {
  if (/mp4|aac|m4a/.test(mime)) return 'm4a';
  if (/ogg/.test(mime)) return 'ogg';
  return 'webm';
}

/** Avvia una registrazione. Ritorna { stop(): Promise<{blob, mime, duration}> , cancel() } */
export async function startRecording() {
  const stream = await acquireMic();
  const mime = pickMime();
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 128000 } : undefined);
  const chunks = [];
  const t0 = Date.now();
  rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  rec.start(250);
  let done = false;
  const finish = () => new Promise((res) => {
    if (done) { res(null); return; }
    done = true;
    rec.onstop = () => {
      releaseMic();
      const type = rec.mimeType || mime || 'audio/webm';
      res({ blob: new Blob(chunks, { type }), mime: type, duration: (Date.now() - t0) / 1000 });
    };
    try { rec.stop(); } catch (e) { releaseMic(); res(null); }
  });
  return {
    stop: finish,
    async cancel() { await finish(); },
    startedAt: t0,
  };
}

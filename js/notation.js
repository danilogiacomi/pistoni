// Rendering della notazione con VexFlow (vendor/vexflow-bravura.js, globale Vex).
import { vfKey } from './music.js';

const BEATS = { w: 4, h: 2, q: 1, 8: 0.5, '16': 0.25, '8t': 1 / 3 };
const BASE_W = { w: 46, h: 38, q: 32, 8: 26, '16': 22, '8t': 24 };

/**
 * notes: [{letter, acc, octave, dur, rest?, text?}]
 * opts: { beatsPerBar=4, timeSig=null, clef=true, scale=1 }
 * Ritorna { highlight(i), count }
 */
export function renderStaff(container, notes, opts = {}) {
  const VF = window.Vex?.Flow;
  container.innerHTML = '';
  if (!VF) {
    container.textContent = 'Notazione non disponibile';
    return { highlight() {}, count: 0 };
  }
  const { Renderer, Stave, StaveNote, Voice, Formatter, Accidental, Annotation, Beam, Barline, Tuplet } = VF;
  const beatsPerBar = opts.beatsPerBar || 4;
  const width = Math.max(280, container.clientWidth || 320);
  const scale = width < 420 ? 0.82 : 1;
  const logicalW = width / scale;

  // 1) suddividi in battute
  const measures = [];
  let cur = [];
  let beats = 0;
  for (const n of notes) {
    const b = BEATS[n.dur] ?? 1;
    if (beats + b > beatsPerBar + 1e-6 && cur.length) {
      measures.push(cur);
      cur = [];
      beats = 0;
    }
    cur.push(n);
    beats += b;
  }
  if (cur.length) measures.push(cur);

  // 2) larghezze stimate
  const mw = measures.map((m) => 20 + m.reduce((s, n) => s + BASE_W[n.dur] + (n.acc ? 12 : 0) + (n.text && n.text.length > 3 ? 8 : 0), 0));
  const CLEF_W = 42 + (opts.timeSig ? 26 : 0);

  // 3) righe
  const lines = [];
  let line = [];
  let lw = 0;
  measures.forEach((m, i) => {
    if (line.length && lw + mw[i] > logicalW - 12) {
      lines.push(line);
      line = [];
      lw = 0;
    }
    const extra = line.length === 0 ? CLEF_W : 0;
    line.push(i);
    lw += mw[i] + extra;
  });
  if (line.length) lines.push(line);

  const hasText = notes.some((n) => n.text);
  const LINE_H = hasText ? 150 : 120;
  const renderer = new Renderer(container, Renderer.Backends.SVG);
  renderer.resize(width, lines.length * LINE_H * scale + 10);
  const ctx = renderer.getContext();
  ctx.scale(scale, scale);
  ctx.setFont('Arial', 11);

  const allNotes = [];
  lines.forEach((idxs, li) => {
    const y = li * LINE_H + (hasText ? 0 : 0);
    const natural = idxs.reduce((s, i) => s + mw[i], 0) + CLEF_W;
    const isLastLine = li === lines.length - 1;
    // giustifica tutte le righe tranne un'ultima riga corta
    const stretch = isLastLine && natural < logicalW * 0.6 ? 1 : (logicalW - 12) / natural;
    let x = 4;
    idxs.forEach((mi, k) => {
      const w = (mw[mi] + (k === 0 ? CLEF_W : 0)) * stretch;
      const stave = new Stave(x, y, w);
      if (k === 0 && opts.clef !== false) stave.addClef('treble');
      if (k === 0 && li === 0 && opts.timeSig) stave.addTimeSignature(opts.timeSig);
      if (mi === measures.length - 1) stave.setEndBarType(Barline.type.END);
      stave.setContext(ctx).draw();

      // alterazioni valide nella battuta
      const accState = {};
      const vfNotes = measures[mi].map((n) => {
        let sn;
        if (n.rest) {
          sn = new StaveNote({ keys: ['b/4'], duration: n.dur + 'r' });
        } else {
          sn = new StaveNote({ keys: [vfKey(n)], duration: n.dur === '8t' ? '8' : n.dur, auto_stem: true });
          const k2 = n.letter + n.octave;
          const prev = accState[k2] ?? 0;
          if (n.acc !== prev || n.forceAcc) {
            const sym = n.acc === 0 ? 'n' : n.acc === 1 ? '#' : n.acc === -1 ? 'b' : n.acc === 2 ? '##' : 'bb';
            sn.addModifier(new Accidental(sym), 0);
          }
          accState[k2] = n.acc;
        }
        if (n.text) {
          const a = new Annotation(n.text);
          a.setFont('Arial', 11, 'bold');
          a.setVerticalJustification(Annotation.VerticalJustify.BOTTOM);
          sn.addModifier(a, 0);
        }
        return sn;
      });
      // terzine: gruppi di 3 crome '8t'
      const tuplets = [];
      const tupBeams = [];
      const src = measures[mi];
      for (let j = 0; j < src.length; j++) {
        if (src[j].dur === '8t' && src[j + 1]?.dur === '8t' && src[j + 2]?.dur === '8t') {
          const g = vfNotes.slice(j, j + 3);
          tuplets.push(new Tuplet(g, { num_notes: 3, notes_occupied: 2 }));
          tupBeams.push(new Beam(g));
          j += 2;
        }
      }
      const plain = vfNotes.filter((n, j) => src[j].dur !== '8t');
      const voice = new Voice({ num_beats: beatsPerBar, beat_value: 4 }).setMode(Voice.Mode.SOFT);
      voice.addTickables(vfNotes);
      const beams = [...tupBeams, ...(plain.some((n) => ['8', '16'].includes(n.getDuration())) ? Beam.generateBeams(plain) : [])];
      new Formatter().joinVoices([voice]).format([voice], Math.max(10, w - (k === 0 ? CLEF_W : 0) - 24));
      voice.draw(ctx, stave);
      beams.forEach((b) => b.setContext(ctx).draw());
      tuplets.forEach((t) => t.setContext(ctx).draw());
      allNotes.push(...vfNotes);
      x += w;
    });
  });

  const svg = container.querySelector('svg');
  const els = allNotes.map((n) => {
    try { return n.getSVGElement ? n.getSVGElement() : null; } catch (e) { return null; }
  });
  const groups = els.every(Boolean) ? els : Array.from(svg.querySelectorAll('.vf-stavenote'));
  let last = -1;
  return {
    count: allNotes.length,
    highlight(i) {
      if (groups[last]) groups[last].classList.remove('on');
      if (groups[i]) {
        groups[i].classList.add('on');
        const r = groups[i].getBoundingClientRect();
        const bottom = window.innerHeight - 90; // spazio della barra in basso
        if (r.top < 70 || r.bottom > bottom) {
          window.scrollBy({ top: r.top - window.innerHeight / 3, behavior: 'smooth' });
        }
      }
      last = i;
    },
  };
}

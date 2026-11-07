import { h, icon, segmented } from '../ui.js';
import { getCtx, click } from '../audio.js';
import { store } from '../store.js';

const TEMPO_NAMES = [
  [40, 'Grave'], [60, 'Largo'], [66, 'Larghetto'], [76, 'Adagio'], [108, 'Andante'],
  [120, 'Moderato'], [156, 'Allegro'], [176, 'Vivace'], [200, 'Presto'], [999, 'Prestissimo'],
];
const tempoName = (b) => TEMPO_NAMES.find(([max]) => b < max)[1];

export function mount(root) {
  const saved = store.get().metronome;
  const st = {
    bpm: saved.bpm, beats: saved.beats, sub: saved.sub, accent: saved.accent,
    trainer: false, trStep: 4, trEvery: 4, trMax: 140,
    gap: false, gapOn: 2, gapOff: 2,
  };
  let playing = false;
  let nextTime = 0;
  let beat = 0;
  let subIdx = 0;
  let bar = 0;
  let timer = null;
  let visualQ = [];
  let raf = 0;

  const persist = () => store.set('metronome', { bpm: st.bpm, beats: st.beats, sub: st.sub, accent: st.accent });

  const bpmEl = h('div', { class: 'm-bpm' }, st.bpm);
  const nameEl = h('div', { class: 'm-name' }, tempoName(st.bpm));
  const dots = h('div', { class: 'm-dots' });
  const barInfo = h('div', { class: 'muted small center m-barinfo' }, ' ');
  const range = h('input', { type: 'range', min: 30, max: 250, value: st.bpm, class: 'range', 'aria-label': 'Battiti al minuto', oninput: (e) => setBpm(Number(e.target.value)) });

  function renderDots() {
    dots.replaceChildren(...Array.from({ length: st.beats }, (_, i) => h('div', { class: 'm-dot' + (i === 0 && st.accent ? ' acc' : '') })));
  }
  renderDots();

  function setBpm(b) {
    st.bpm = Math.max(30, Math.min(250, Math.round(b)));
    bpmEl.textContent = st.bpm;
    nameEl.textContent = tempoName(st.bpm);
    range.value = st.bpm;
    persist();
  }

  // tap tempo
  let taps = [];
  function tap() {
    const t = performance.now();
    taps = taps.filter((x) => t - x < 2500);
    taps.push(t);
    if (taps.length >= 2) {
      const iv = [];
      for (let i = 1; i < taps.length; i++) iv.push(taps[i] - taps[i - 1]);
      setBpm(60000 / (iv.reduce((a, b) => a + b, 0) / iv.length));
    }
  }

  function scheduler() {
    const c = getCtx();
    while (nextTime < c.currentTime + 0.12) {
      const silent = st.gap && (bar % (st.gapOn + st.gapOff)) >= st.gapOn;
      if (!silent) {
        const level = subIdx === 0 ? (beat === 0 && st.accent ? 2 : 1) : 0;
        click(nextTime, level, 1, store.settings().metronomeSound);
      }
      if (subIdx === 0) visualQ.push({ t: nextTime, beat, silent, bar });
      // avanza
      const spb = 60 / st.bpm;
      nextTime += spb / st.sub;
      subIdx++;
      if (subIdx >= st.sub) {
        subIdx = 0;
        beat++;
        if (beat >= st.beats) {
          beat = 0;
          bar++;
          if (st.trainer && bar % st.trEvery === 0 && st.bpm < st.trMax) setBpm(Math.min(st.trMax, st.bpm + st.trStep));
        }
      }
    }
  }

  function draw() {
    const c = getCtx();
    while (visualQ.length && visualQ[0].t <= c.currentTime) {
      const v = visualQ.shift();
      [...dots.children].forEach((d, i) => d.classList.toggle('on', i === v.beat));
      dots.classList.toggle('silent', v.silent);
      barInfo.textContent = `Battuta ${v.bar + 1}${v.silent ? ' · silenzio: tieni il tempo!' : ''}`;
    }
    raf = requestAnimationFrame(draw);
  }

  function start() {
    const c = getCtx();
    playing = true;
    beat = 0; subIdx = 0; bar = 0; visualQ = [];
    nextTime = c.currentTime + 0.08;
    scheduler();
    timer = setInterval(scheduler, 25);
    raf = requestAnimationFrame(draw);
    setBtn();
  }
  function stop() {
    playing = false;
    clearInterval(timer);
    cancelAnimationFrame(raf);
    [...dots.children].forEach((d) => d.classList.remove('on'));
    dots.classList.remove('silent');
    barInfo.textContent = ' ';
    setBtn();
  }
  const playBtn = h('button', { class: 'btn btn-primary btn-xl', onclick: () => (playing ? stop() : start()) });
  function setBtn() { playBtn.innerHTML = ''; playBtn.append(icon(playing ? 'stop' : 'play'), playing ? ' Stop' : ' Avvia'); }
  setBtn();

  const num = (label, get, set, min, max, step = 1) => {
    const suffix = '';
    const out = h('span', { class: 'num-v' }, get() + suffix);
    const ch = (d) => () => { set(Math.max(min, Math.min(max, get() + d * step))); out.textContent = get() + suffix; };
    return h('div', { class: 'num' }, h('span', { class: 'field-l' }, label),
      h('div', { class: 'stepper' }, h('button', { class: 'btn btn-round sm', onclick: ch(-1) }, '−'), out, h('button', { class: 'btn btn-round sm', onclick: ch(1) }, '+')));
  };

  const trainerBox = h('div', { class: 'sub-opts', hidden: true },
    num('Aumenta di (bpm)', () => st.trStep, (v) => { st.trStep = v; }, 1, 20),
    num('Ogni (battute)', () => st.trEvery, (v) => { st.trEvery = v; }, 1, 32),
    num('Fino a (bpm)', () => st.trMax, (v) => { st.trMax = v; }, 40, 250, 5));
  const gapBox = h('div', { class: 'sub-opts', hidden: true },
    num('Battute con click', () => st.gapOn, (v) => { st.gapOn = v; }, 1, 8),
    num('Battute in silenzio', () => st.gapOff, (v) => { st.gapOff = v; }, 1, 8));

  const sw = (label, desc, get, set, box) => {
    const input = h('input', { type: 'checkbox', checked: get(), onchange: (e) => { set(e.target.checked); if (box) box.hidden = !e.target.checked; } });
    return h('label', { class: 'switch-row' }, h('div', {}, h('div', { class: 'field-l' }, label), h('div', { class: 'muted small' }, desc)), h('span', { class: 'switch' }, input, h('span', { class: 'slider' })));
  };

  root.append(
    h('header', { class: 'page-head' }, h('h1', {}, 'Metronomo')),
    h('section', { class: 'card metro-card' },
      nameEl,
      h('div', { class: 'm-bpm-row' },
        h('button', { class: 'btn btn-round', onclick: () => setBpm(st.bpm - 1), 'aria-label': '-1' }, '−'),
        h('div', {}, bpmEl, h('div', { class: 'muted small center' }, 'bpm')),
        h('button', { class: 'btn btn-round', onclick: () => setBpm(st.bpm + 1), 'aria-label': '+1' }, '+')),
      range,
      h('div', { class: 'quick-bpm' }, [60, 72, 80, 96, 120].map((b) => h('button', { class: 'chip-btn', onclick: () => setBpm(b) }, b))),
      dots,
      barInfo,
      h('div', { class: 'm-actions' }, playBtn, h('button', { class: 'btn btn-ghost btn-xl', onclick: tap }, 'Tap')),
    ),
    h('section', { class: 'card' },
      h('div', { class: 'field-block' }, h('div', { class: 'field-l' }, 'Tempi per battuta'),
        segmented([[2, '2'], [3, '3'], [4, '4'], [5, '5'], [6, '6'], [7, '7']], st.beats, (v) => { st.beats = Number(v); renderDots(); persist(); })),
      h('div', { class: 'field-block' }, h('div', { class: 'field-l' }, 'Suddivisione'),
        segmented([[1, '♩'], [2, '♪♪'], [3, '♪♪♪'], [4, '♬♬']], st.sub, (v) => { st.sub = Number(v); persist(); })),
      sw('Accento sul primo tempo', 'Il primo battito di ogni battuta è più forte.', () => st.accent, (v) => { st.accent = v; renderDots(); persist(); }),
      h('div', { class: 'field-block' }, h('div', { class: 'field-l' }, 'Suono'),
        segmented([['beep', 'Elettronico'], ['wood', 'Legnetto']], store.settings().metronomeSound, (v) => store.setSetting('metronomeSound', v))),
    ),
    h('section', { class: 'card' },
      h('h2', {}, 'Allenamento'),
      sw('Accelera da solo', 'Aumenta il tempo ogni tot battute: per portare un passaggio difficile a velocità.', () => st.trainer, (v) => { st.trainer = v; }, trainerBox),
      trainerBox,
      sw('Battute mute', 'Il click sparisce per alcune battute: impari a tenere il tempo da solo.', () => st.gap, (v) => { st.gap = v; }, gapBox),
      gapBox,
    ),
  );

  return () => stop();
}

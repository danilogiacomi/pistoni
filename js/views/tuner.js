import { h, icon, valvesGraphic, segmented } from '../ui.js';
import { getCtx } from '../audio.js';
import { detectPitch } from '../pitch.js';
import { store } from '../store.js';
import { freqToMidiFloat, fromMidi, nameIt, nameEn, TRANSPOSE, fingeringsFor, RANGE_LOW, RANGE_HIGH } from '../music.js';

export function mount(root) {
  let stream = null;
  let source = null;
  let analyser = null;
  let raf = 0;
  let running = false;
  const hist = []; // {t, cents, midi}
  const recent = [];

  const s = store.settings();
  const noteEl = h('div', { class: 'tn-note' }, '–');
  const octEl = h('sub', {});
  const centsEl = h('div', { class: 'tn-cents' }, ' ');
  const hzEl = h('div', { class: 'tn-hz muted' }, ' ');
  const concertEl = h('div', { class: 'tn-concert muted small' }, ' ');
  const valvesBox = h('div', { class: 'tn-valves' });
  const stabEl = h('div', { class: 'stat-v' }, '–');
  const avgEl = h('div', { class: 'stat-v' }, '–');
  const statusEl = h('div', { class: 'muted small center' }, 'Tocca "Avvia" e consenti l\'uso del microfono.');

  // indicatore ad arco
  const needle = svgEl('line', { x1: 150, y1: 160, x2: 150, y2: 30, class: 'needle' });
  const gauge = svgEl('svg', { viewBox: '0 0 300 175', class: 'gauge' });
  gauge.append(svgEl('path', { d: arc(150, 160, 130, -50, 50), class: 'g-arc' }));
  gauge.append(svgEl('path', { d: arc(150, 160, 130, -5, 5), class: 'g-ok' }));
  for (let c = -50; c <= 50; c += 10) {
    const a = (c * Math.PI) / 180 - Math.PI / 2;
    const r1 = c % 50 === 0 || c === 0 ? 112 : 120;
    gauge.append(svgEl('line', { x1: 150 + Math.cos(a) * r1, y1: 160 + Math.sin(a) * r1, x2: 150 + Math.cos(a) * 130, y2: 160 + Math.sin(a) * 130, class: 'g-tick' }));
  }
  const lbl = (txt, x, y) => { const t = svgEl('text', { x, y, class: 'g-lbl', 'text-anchor': 'middle' }); t.textContent = txt; return t; };
  gauge.append(lbl('calante', 52, 172), lbl('crescente', 248, 172), lbl('0', 150, 18));
  gauge.append(needle, svgEl('circle', { cx: 150, cy: 160, r: 7, class: 'g-hub' }));

  const canvas = h('canvas', { class: 'tn-graph', height: 140 });

  const startBtn = h('button', { class: 'btn btn-primary btn-lg', onclick: () => (running ? stop() : start()) });
  const setBtn = () => { startBtn.innerHTML = ''; startBtn.append(icon(running ? 'stop' : 'mic'), running ? ' Ferma' : ' Avvia accordatore'); };
  setBtn();

  const a4El = h('output', {}, s.a4);
  const changeA4 = (d) => () => { const v = Math.min(446, Math.max(436, store.settings().a4 + d)); store.setSetting('a4', v); a4El.textContent = v; };

  root.append(
    h('header', { class: 'page-head' }, h('h1', {}, 'Accordatore'),
      h('p', { class: 'muted' }, 'Mostra la nota come la leggi sullo spartito (tromba in Si♭) e quanto sei intonato. Il grafico in basso mostra la stabilità: ideale per le note lunghe.')),
    h('section', { class: 'card tuner-card' },
      gauge,
      h('div', { class: 'tn-readout' }, h('div', { class: 'tn-name' }, noteEl, octEl), centsEl, hzEl, concertEl),
      valvesBox,
      startBtn,
      statusEl,
    ),
    h('section', { class: 'card' },
      h('h2', {}, 'Stabilità del suono'),
      canvas,
      h('div', { class: 'stats' },
        h('div', { class: 'stat' }, stabEl, h('div', { class: 'stat-l' }, 'stabilità (ultimi 3 s)')),
        h('div', { class: 'stat' }, avgEl, h('div', { class: 'stat-l' }, 'scarto medio')),
      ),
      h('p', { class: 'muted small' }, 'La fascia verde è ±5 cent. Una nota lunga ben controllata disegna una linea piatta dentro la fascia.'),
    ),
    h('section', { class: 'card' },
      h('div', { class: 'row-between' },
        h('div', {}, h('div', { class: 'field-l' }, 'La di riferimento'), h('div', { class: 'muted small' }, 'Di solito 440 Hz (442 in molte orchestre).')),
        h('div', { class: 'stepper' }, h('button', { class: 'btn btn-round sm', onclick: changeA4(-1) }, '−'), h('span', {}, a4El, ' Hz'), h('button', { class: 'btn btn-round sm', onclick: changeA4(1) }, '+'))),
      h('div', { class: 'row-between mt' },
        h('div', { class: 'field-l' }, 'Mostra le note'),
        segmented([['Bb', 'Tromba Si♭'], ['C', 'Suono reale']], s.instrument, (v) => store.setSetting('instrument', v))),
    ),
  );

  async function start() {
    try {
      const c = getCtx();
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      source = c.createMediaStreamSource(stream);
      analyser = c.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      running = true;
      setBtn();
      statusEl.textContent = 'In ascolto… suona una nota.';
      loop();
    } catch (e) {
      statusEl.textContent = 'Impossibile accedere al microfono. Controlla i permessi del browser.';
    }
  }

  function stop() {
    running = false;
    cancelAnimationFrame(raf);
    try { source?.disconnect(); } catch (e) { /* */ }
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    setBtn();
    statusEl.textContent = 'Accordatore fermo.';
  }

  const buf = new Float32Array(2048);
  let frame = 0;
  function loop() {
    if (!running) return;
    raf = requestAnimationFrame(loop);
    if (frame++ % 2) { draw(); return; }
    analyser.getFloatTimeDomainData(buf);
    const { freq, clarity } = detectPitch(buf, getCtx().sampleRate);
    const now = performance.now();
    const st = store.settings();
    if (freq > 0 && clarity > 0.8) {
      recent.push(freq);
      if (recent.length > 5) recent.shift();
      const f = median(recent);
      const concertMidiF = freqToMidiFloat(f, st.a4);
      const shownF = concertMidiF - TRANSPOSE[st.instrument];
      const midi = Math.round(shownF);
      const cents = (shownF - midi) * 100;
      const n = fromMidi(midi);
      const nc = fromMidi(Math.round(concertMidiF));
      const useIt = st.names === 'it';
      noteEl.textContent = useIt ? nameIt(n) : nameEn(n, false);
      octEl.textContent = n.octave;
      centsEl.textContent = `${cents > 0 ? '+' : ''}${cents.toFixed(0)} cent`;
      centsEl.className = 'tn-cents ' + (Math.abs(cents) <= 5 ? 'ok' : Math.abs(cents) <= 15 ? 'near' : 'off');
      hzEl.textContent = `${f.toFixed(1)} Hz`;
      concertEl.textContent = st.instrument === 'Bb' ? `suono reale: ${useIt ? nameIt(nc, true) : nameEn(nc)}` : '';
      const angle = Math.max(-50, Math.min(50, cents));
      needle.style.transform = `rotate(${angle}deg)`;
      gauge.classList.toggle('in-tune', Math.abs(cents) <= 5);
      // diteggiatura della nota scritta
      const writtenMidi = Math.round(concertMidiF) + 2;
      if (writtenMidi >= RANGE_LOW && writtenMidi <= RANGE_HIGH) {
        const fing = fingeringsFor(writtenMidi).primary.valves;
        valvesBox.replaceChildren(valvesGraphic(fing, 'sm'));
      } else valvesBox.replaceChildren();
      hist.push({ t: now, cents, midi });
    } else {
      recent.length = 0;
      hist.push({ t: now, cents: null });
      gauge.classList.remove('in-tune');
    }
    while (hist.length && now - hist[0].t > 8000) hist.shift();
    updateStats(now);
  }

  function updateStats(now) {
    const win = hist.filter((p) => p.cents != null && now - p.t < 3000);
    if (win.length < 10) { stabEl.textContent = '–'; avgEl.textContent = '–'; return; }
    const mean = win.reduce((a, p) => a + p.cents, 0) / win.length;
    const within = win.filter((p) => Math.abs(p.cents - mean) <= 8).length / win.length;
    stabEl.textContent = `${Math.round(within * 100)}%`;
    const absMean = win.reduce((a, p) => a + Math.abs(p.cents), 0) / win.length;
    avgEl.textContent = `${absMean.toFixed(0)} cent`;
  }

  function draw() {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const hh = canvas.clientHeight;
    if (canvas.width !== w * dpr) { canvas.width = w * dpr; canvas.height = hh * dpr; }
    const g = canvas.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, hh);
    const css = getComputedStyle(document.documentElement);
    const y = (c) => hh / 2 - (c / 50) * (hh / 2);
    g.fillStyle = css.getPropertyValue('--ok-bg').trim() || 'rgba(60,180,120,.18)';
    g.fillRect(0, y(5), w, y(-5) - y(5));
    g.strokeStyle = css.getPropertyValue('--line').trim();
    g.lineWidth = 1;
    g.beginPath(); g.moveTo(0, hh / 2); g.lineTo(w, hh / 2); g.stroke();
    const now = performance.now();
    g.strokeStyle = css.getPropertyValue('--accent').trim();
    g.lineWidth = 2.5;
    g.lineJoin = 'round';
    g.beginPath();
    let pen = false;
    for (const p of hist) {
      const x = w - ((now - p.t) / 8000) * w;
      if (p.cents == null) { pen = false; continue; }
      const yy = y(Math.max(-50, Math.min(50, p.cents)));
      if (!pen) { g.moveTo(x, yy); pen = true; } else g.lineTo(x, yy);
    }
    g.stroke();
  }

  return () => stop();
}

function median(a) {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
}
function svgEl(tag, attrs) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}
function arc(cx, cy, r, a1, a2) {
  const p = (a) => { const rad = (a * Math.PI) / 180 - Math.PI / 2; return [cx + Math.cos(rad) * r, cy + Math.sin(rad) * r]; };
  const [x1, y1] = p(a1);
  const [x2, y2] = p(a2);
  return `M${x1} ${y1} A${r} ${r} 0 0 1 ${x2} ${y2}`;
}

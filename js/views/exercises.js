import { h, icon, select } from '../ui.js';
import { CATALOG, getExercise, TONICS, keyOfTheDay, keyToStr } from '../exercises.js';
import { nameIt } from '../music.js';
import { renderStaff } from '../notation.js';
import { createPlayer } from '../player.js';
import { store } from '../store.js';
import { session } from '../session.js';
import { createPitchTracker, micErrorMessage } from '../mic.js';
import { createVerifier, OK_CENTS } from '../verify.js';
import { startRecording, recordings, recorderSupported } from '../recordings.js';
import { recordingItem } from './recorder.js';
import { toast } from '../ui.js';
import { fromMidi, nameEn } from '../music.js';

export function mountList(root) {
  const cats = [...new Set(CATALOG.map((e) => e.cat))];
  root.append(
    h('header', { class: 'page-head' }, h('h1', {}, 'Esercizi'),
      h('p', { class: 'muted' }, 'Ogni esercizio ha lo spartito, l\'audio di riferimento e il click. Le note sono scritte per tromba in Si♭, sotto trovi i pistoni da premere.')),
    ...cats.map((c) => h('section', { class: 'card' },
      h('h2', { class: 'cat-title' }, c),
      h('div', { class: 'ex-list' }, CATALOG.filter((e) => e.cat === c).map((e) => h('a', { class: 'ex-item', href: `#/esercizi/${e.id}` },
        h('span', { class: 'ex-ic' }, e.icon),
        h('span', { class: 'ex-body' }, h('span', { class: 'ex-t' }, e.title), h('span', { class: 'ex-d' }, e.desc.split('. ')[0] + '.')),
        h('span', { class: 'chev' }, '›')))))),
  );
}

export function mountDetail(root, id, params) {
  const ex = getExercise(id);
  if (!ex) { root.append(h('p', {}, 'Esercizio non trovato.')); return; }
  const level = store.settings().level;
  const opts = { level };
  ex.options.forEach((o) => {
    if (o.type === 'key') opts[o.id] = params.get(o.id) || null;
    else opts[o.id] = params.get(o.id) || o.values[0][0];
  });
  let bpm = Number(params.get('bpm')) || ex.tempo;
  let sound = true;
  let clickOn = true;
  let loop = false;
  let verify = params.get('verifica') === '1';
  let record = false;
  if (verify) { sound = false; }

  const staffBox = h('div', { class: 'staff' });
  const countEl = h('div', { class: 'countin', 'aria-live': 'polite' });
  const liveEl = h('div', { class: 'live', hidden: true });
  const resultBox = h('section', { class: 'card result-card', hidden: true, 'aria-live': 'polite' });
  const recBox = h('div', { class: 'rec-inline' });
  const verifyHint = h('p', { class: 'muted small verify-hint', hidden: !verify },
    'L\'app ascolta dal microfono e colora ogni nota: ',
    h('b', { class: 'c-ok' }, 'verde'), ' giusta e intonata, ',
    h('b', { class: 'c-near' }, 'gialla'), ' giusta ma stonata, ',
    h('b', { class: 'c-bad' }, 'rossa'), ' nota sbagliata, ',
    h('b', { class: 'c-miss' }, 'grigia'), ' non sentita. Il suono guida resta spento per non confondere il microfono.');
  let staff = null;
  let notes = [];

  // stato della sessione di esecuzione
  let starting = false;
  let tracker = null;
  let verifier = null;
  let recHandle = null;
  let endTimer = null;

  const player = createPlayer({
    onNote: (i) => staff?.highlight(i),
    onBeat: (n) => {
      countEl.textContent = n > 0 ? n : '';
      countEl.classList.toggle('show', n > 0);
      if (n > 0) { playBtn.innerHTML = ''; playBtn.append(icon('stop'), ` Pronti… ${n}`); } else if (player.isPlaying()) setPlaying(true);
    },
    onEnd: () => { endTimer = setTimeout(() => finishRun(true), 180); },
  });

  const playBtn = h('button', { class: 'btn btn-primary btn-lg play-btn', onclick: () => toggle() });
  function setPlaying(p) {
    playBtn.innerHTML = '';
    playBtn.append(icon(p ? 'stop' : 'play'), p ? ' Stop' : (verify ? ' Suona e verifica' : ' Suona'));
    playBtn.classList.toggle('playing', p);
  }
  setPlaying(false);

  async function toggle() {
    if (starting) return;
    if (player.isPlaying() || recHandle || verifier) { finishRun(false); return; }
    starting = true;
    try {
      if (verify) tracker = await createPitchTracker();
      if (record) recHandle = await startRecording();
    } catch (e) {
      toast(micErrorMessage(e));
      tracker?.release(); tracker = null;
      starting = false;
      return;
    }
    starting = false;
    if (!session.state().running) session.start();
    staff?.clearMarks();
    resultBox.hidden = true;
    const run = player.play(notes, { bpm, sound: sound && !verify, clickOn, loop: loop && !verify, concert: ex.concert, countIn: 4 });
    if (verify) {
      liveEl.hidden = false;
      liveEl.textContent = '🎯 In ascolto…';
      verifier = createVerifier({
        timeline: run.timeline,
        instrument: run.instrument,
        a4: store.settings().a4,
        tracker,
        onMark: (i, r) => staff?.mark(i, r.cls),
        onLive: (m) => {
          if (m == null) { liveEl.textContent = '🎯 In ascolto…'; liveEl.className = 'live'; return; }
          const r = Math.round(m);
          const c = Math.round((m - r) * 100);
          const n = fromMidi(r);
          const it = store.settings().names === 'it';
          liveEl.textContent = `🎯 Senti: ${it ? nameIt(n, true) : nameEn(n)}  ${c > 0 ? '+' : ''}${c} cent`;
          liveEl.className = 'live ' + (Math.abs(c) <= OK_CENTS ? 'ok' : 'near');
        },
      });
    }
    setPlaying(true);
  }

  async function finishRun(complete) {
    clearTimeout(endTimer);
    player.stop();
    setPlaying(false);
    liveEl.hidden = true;
    if (verifier) {
      const summary = verifier.finish(complete);
      verifier = null;
      tracker?.release();
      tracker = null;
      if (summary.total > 0) showResult(summary, complete);
    }
    if (recHandle) {
      const h0 = recHandle;
      recHandle = null;
      const res = await h0.stop();
      if (res && res.duration > 0.5) {
        const item = { date: Date.now(), title: `${ex.title} · ${bpm} bpm`, mime: res.mime, duration: res.duration, blob: res.blob };
        try { item.id = await recordings.add(item); } catch (e) { /* archivio non disponibile: resta solo qui */ }
        recBox.replaceChildren(h('div', { class: 'field-l' }, 'Riascoltati'), recordingItem(item, { onDelete: () => recBox.replaceChildren() }),
          h('a', { class: 'muted small', href: '#/registrazioni' }, 'Tutte le registrazioni ›'));
        recBox.querySelector('audio')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }

  function bestKey() {
    const q = ex.options.map((o) => `${o.id}=${opts[o.id] ?? ''}`).join('&');
    return `${ex.id}?${q}`;
  }

  function showResult(r, complete) {
    const best = store.get().best || {};
    const key = bestKey();
    const prev = best[key];
    const isRecord = complete && (!prev || r.score > prev.score);
    if (isRecord) store.set('best', { ...best, [key]: { score: r.score, bpm, date: Date.now() } });
    const stars = r.score >= 90 ? '⭐⭐⭐' : r.score >= 70 ? '⭐⭐' : r.score >= 50 ? '⭐' : '';
    const advice = [];
    if (r.miss > r.total * 0.3) advice.push('Molte note non sono state sentite: suona più forte, avvicina il telefono o tieni il volume del click più basso.');
    if (r.bad > r.total * 0.15) advice.push('Diverse note sbagliate: rallenta il tempo e ripassa le diteggiature (scheda Pistoni).');
    if (r.near > r.total * 0.3) advice.push('Le note sono giuste ma l\'intonazione va curata: lavora con il bordone e le note lunghe, ascoltandoti.');
    if (r.score >= 90) advice.push(`Ottimo! Prova ad aumentare il tempo di 4 bpm (ora ${bpm}).`);
    resultBox.replaceChildren(
      h('div', { class: 'result-top' },
        h('div', { class: 'result-score' }, `${r.score}%`),
        h('div', {},
          h('div', { class: 'result-stars' }, stars || '💪'),
          h('div', { class: 'muted small' }, complete ? (isRecord ? '🏆 Nuovo record!' : prev ? `Record: ${prev.score}% a ${prev.bpm} bpm` : '') : 'Esercizio interrotto: risultato parziale'))),
      h('div', { class: 'result-grid' },
        rCell('c-ok', r.ok, 'giuste e intonate'),
        rCell('c-near', r.near, 'giuste ma stonate'),
        rCell('c-bad', r.bad, 'sbagliate'),
        rCell('c-miss', r.miss, 'non sentite')),
      r.avgCents != null ? h('p', { class: 'muted small center' }, `Scarto medio di intonazione: ${r.avgCents} cent (sotto ${OK_CENTS} è ottimo)`) : null,
      ...advice.map((a) => h('p', { class: 'tip' }, '💡 ', a)),
      h('button', { class: 'btn btn-ghost btn-lg', onclick: () => toggle() }, icon('play'), ' Riprova'),
    );
    resultBox.hidden = false;
    resultBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  const rCell = (cls, n, label) => h('div', { class: 'r-cell' }, h('div', { class: `r-n ${cls}` }, n), h('div', { class: 'r-l' }, label));

  function rebuild() {
    notes = ex.build(opts);
    staff = renderStaff(staffBox, notes, { beatsPerBar: 4 });
    // aggiorna l'URL senza ricaricare (per condividere/ritornare)
    const q = new URLSearchParams();
    ex.options.forEach((o) => { if (opts[o.id]) q.set(o.id, opts[o.id]); });
    history.replaceState(null, '', `#/esercizi/${ex.id}${q.toString() ? '?' + q : ''}`);
  }

  // opzioni
  const optEls = ex.options.map((o) => {
    let ctrl;
    if (o.type === 'key') {
      const kd = keyToStr(keyOfTheDay(new Date(), opts.type && opts.type !== 'major'));
      const vals = [['', `Del giorno (${nameIt({ letter: kd[0], acc: Number(kd.slice(1)) })})`], ...TONICS.map((k) => [keyToStr(k), nameIt({ letter: k[0], acc: k[1] })])];
      ctrl = select(vals, opts[o.id] || '', (v) => { opts[o.id] = v || null; restart(); });
    } else {
      ctrl = select(o.values, opts[o.id], (v) => { opts[o.id] = v; restart(); });
    }
    return h('label', { class: 'field' }, h('span', { class: 'field-l' }, o.label), ctrl);
  });

  function restart() {
    const was = player.isPlaying();
    if (was || verifier || recHandle) finishRun(false);
    resultBox.hidden = true;
    rebuild();
  }

  const restartIfPlaying = () => { if (player.isPlaying()) { finishRun(false); } };
  const bpmVal = h('output', { class: 'bpm-out' }, bpm);
  const bpmRange = h('input', {
    type: 'range', min: 30, max: 200, value: bpm, class: 'range', 'aria-label': 'Tempo',
    oninput: (e) => { bpm = Number(e.target.value); bpmVal.textContent = bpm; },
    onchange: restartIfPlaying,
  });
  const step = (d) => () => { bpm = Math.min(200, Math.max(30, bpm + d)); bpmRange.value = bpm; bpmVal.textContent = bpm; restartIfPlaying(); };

  const toggleChip = (label, get, set) => {
    const b = h('button', { class: 'chip-toggle' + (get() ? ' on' : ''), 'aria-pressed': String(get()) }, label);
    const sync = () => { b.classList.toggle('on', get()); b.setAttribute('aria-pressed', String(get())); };
    b.addEventListener('click', () => { if (player.isPlaying()) finishRun(false); set(!get()); sync(); });
    b.sync = sync;
    return b;
  };
  const soundChip = toggleChip('🔊 Suono guida', () => sound, (v) => { sound = v; if (v && verify) { verify = false; verifyChip.sync(); onVerifyChange(); } });
  const loopChip = toggleChip('🔁 Ripeti', () => loop, (v) => { loop = v; if (v && verify) { verify = false; verifyChip.sync(); onVerifyChange(); } });
  const verifyChip = toggleChip('🎯 Verifica', () => verify, (v) => {
    verify = v;
    if (v) { sound = false; loop = false; soundChip.sync(); loopChip.sync(); }
    onVerifyChange();
  });
  function onVerifyChange() { verifyHint.hidden = !verify; setPlaying(false); }
  const recChip = toggleChip('🎙 Registra', () => record, (v) => { record = v; });

  root.append(
    h('header', { class: 'page-head' },
      h('a', { class: 'back', href: '#/esercizi' }, icon('back'), 'Esercizi'),
      h('h1', {}, h('span', { class: 'title-ic' }, ex.icon), ex.title),
      h('p', { class: 'lead' }, ex.desc)),
    h('section', { class: 'card' },
      h('div', { class: 'fields' }, optEls),
      h('div', { class: 'tempo-row' },
        h('button', { class: 'btn btn-round', onclick: step(-4), 'aria-label': 'Più lento' }, '−'),
        h('div', { class: 'tempo-mid' }, h('div', {}, bpmVal, h('span', { class: 'muted' }, ' bpm')), bpmRange),
        h('button', { class: 'btn btn-round', onclick: step(4), 'aria-label': 'Più veloce' }, '+')),
      h('div', { class: 'chips' },
        soundChip,
        toggleChip('🥁 Click', () => clickOn, (v) => { clickOn = v; }),
        loopChip,
        navigator.mediaDevices?.getUserMedia ? verifyChip : null,
        recorderSupported() ? recChip : null),
      verifyHint,
      playBtn,
      recBox,
    ),
    resultBox,
    h('section', { class: 'card paper-card' }, countEl, liveEl, staffBox),
    h('section', { class: 'card' }, h('h2', {}, 'Consigli'), h('ul', { class: 'tips' }, ex.tips.map((t) => h('li', {}, t)))),
  );

  requestAnimationFrame(rebuild);
  let rw = staffBox.clientWidth;
  const ro = new ResizeObserver(() => {
    if (Math.abs(staffBox.clientWidth - rw) > 30) { rw = staffBox.clientWidth; staff = renderStaff(staffBox, notes, { beatsPerBar: 4 }); }
  });
  ro.observe(staffBox);

  return () => { finishRun(false); ro.disconnect(); };
}

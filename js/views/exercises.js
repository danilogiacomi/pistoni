import { h, icon, select } from '../ui.js';
import { CATALOG, getExercise, TONICS, keyOfTheDay, keyToStr } from '../exercises.js';
import { nameIt } from '../music.js';
import { renderStaff } from '../notation.js';
import { createPlayer } from '../player.js';
import { store } from '../store.js';
import { session } from '../session.js';

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

  const staffBox = h('div', { class: 'staff' });
  const countEl = h('div', { class: 'countin', 'aria-live': 'polite' });
  let staff = null;
  let notes = [];

  const player = createPlayer({
    onNote: (i) => staff?.highlight(i),
    onBeat: (n) => {
      countEl.textContent = n > 0 ? n : '';
      countEl.classList.toggle('show', n > 0);
      if (n > 0) { playBtn.innerHTML = ''; playBtn.append(icon('stop'), ` Pronti… ${n}`); } else if (player.isPlaying()) setPlaying(true);
    },
    onEnd: () => setPlaying(false),
  });

  const playBtn = h('button', { class: 'btn btn-primary btn-lg play-btn', onclick: () => toggle() });
  function setPlaying(p) {
    playBtn.innerHTML = '';
    playBtn.append(icon(p ? 'stop' : 'play'), p ? ' Stop' : ' Suona');
    playBtn.classList.toggle('playing', p);
  }
  setPlaying(false);
  function toggle() {
    if (player.isPlaying()) { player.stop(); setPlaying(false); return; }
    if (!session.state().running) session.start();
    player.play(notes, { bpm, sound, clickOn, loop, concert: ex.concert, countIn: 4 });
    setPlaying(true);
  }

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
    player.stop();
    setPlaying(false);
    rebuild();
    if (was) toggle();
  }

  const bpmVal = h('output', { class: 'bpm-out' }, bpm);
  const bpmRange = h('input', {
    type: 'range', min: 30, max: 200, value: bpm, class: 'range', 'aria-label': 'Tempo',
    oninput: (e) => { bpm = Number(e.target.value); bpmVal.textContent = bpm; },
    onchange: () => { if (player.isPlaying()) { player.stop(); toggle(); } },
  });
  const step = (d) => () => { bpm = Math.min(200, Math.max(30, bpm + d)); bpmRange.value = bpm; bpmVal.textContent = bpm; if (player.isPlaying()) { player.stop(); toggle(); } };

  const toggleChip = (label, get, set) => {
    const b = h('button', { class: 'chip-toggle' + (get() ? ' on' : ''), 'aria-pressed': String(get()), onclick: () => { set(!get()); b.classList.toggle('on', get()); b.setAttribute('aria-pressed', String(get())); } }, label);
    return b;
  };

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
        toggleChip('🔊 Suono guida', () => sound, (v) => { sound = v; }),
        toggleChip('🥁 Click', () => clickOn, (v) => { clickOn = v; }),
        toggleChip('🔁 Ripeti', () => loop, (v) => { loop = v; })),
      playBtn,
    ),
    h('section', { class: 'card paper-card' }, countEl, staffBox),
    h('section', { class: 'card' }, h('h2', {}, 'Consigli'), h('ul', { class: 'tips' }, ex.tips.map((t) => h('li', {}, t)))),
  );

  requestAnimationFrame(rebuild);
  let rw = staffBox.clientWidth;
  const ro = new ResizeObserver(() => {
    if (Math.abs(staffBox.clientWidth - rw) > 30) { rw = staffBox.clientWidth; staff = renderStaff(staffBox, notes, { beatsPerBar: 4 }); }
  });
  ro.observe(staffBox);

  return () => { player.stop(); ro.disconnect(); };
}

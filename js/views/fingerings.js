import { h, icon, valvesGraphic, segmented } from '../ui.js';
import { fromMidi, nameIt, nameEn, fingeringsFor, intonationTip, RANGE_LOW, RANGE_HIGH, writtenToFreq } from '../music.js';
import { renderStaff } from '../notation.js';
import { brassNote } from '../audio.js';
import { store } from '../store.js';
import { LEVEL_RANGE } from '../exercises.js';

const isBlack = (m) => [1, 3, 6, 8, 10].includes(((m % 12) + 12) % 12);

function noteNames(midi) {
  const it = store.settings().names === 'it';
  const nm = (n) => (it ? nameIt(n, true) : nameEn(n));
  if (!isBlack(midi)) return nm(fromMidi(midi));
  return `${nm(fromMidi(midi, 'sharp'))} / ${nm(fromMidi(midi, 'flat'))}`;
}

function playWritten(midi) {
  const { a4, instrument } = store.settings();
  brassNote(writtenToFreq(midi, a4, instrument), undefined, 1.2, { volume: 0.32 });
}

export function mount(root, params) {
  const mode = params.get('mode') || 'tabella';
  const body = h('div');
  root.append(
    h('header', { class: 'page-head' }, h('h1', {}, 'Diteggiature'),
      h('p', { class: 'muted' }, 'Quali pistoni premere per ogni nota (scritta, tromba in Si♭). 1 = pistone vicino alla bocca, 3 = il più lontano.')),
    segmented([['tabella', 'Tabella'], ['quiz', 'Quiz'], ['armonici', 'Armonici']], mode, (v) => {
      history.replaceState(null, '', `#/diteggiature?mode=${v}`);
      body.replaceChildren();
      cleanup?.();
      cleanup = renderMode(v);
    }, 'seg-wide'),
    body,
  );
  let cleanup = renderMode(mode);
  function renderMode(m) {
    if (m === 'quiz') return quiz(body);
    if (m === 'armonici') return harmonics(body);
    return table(body);
  }
  return () => cleanup?.();
}

function table(root) {
  let sel = 60;
  const detail = h('section', { class: 'card fing-detail' });
  const staffBox = h('div', { class: 'staff staff-single' });
  const grid = h('div', { class: 'fing-grid' });

  function showDetail() {
    const f = fingeringsFor(sel);
    const concert = fromMidi(sel - 2);
    const it = store.settings().names === 'it';
    detail.replaceChildren(...[
      h('div', { class: 'fing-top' },
        h('div', { class: 'paper-card mini' }, staffBox),
        h('div', { class: 'fing-main' },
          h('div', { class: 'fing-name' }, noteNames(sel)),
          valvesGraphic(f.primary.valves, 'lg'),
          h('div', { class: 'muted small' }, f.primary.valves.length ? `Pistoni ${f.primary.valves.join(' + ')}` : 'Nessun pistone (aperto)'),
        )),
      h('div', { class: 'fing-info' },
        h('button', { class: 'btn btn-ghost', onclick: () => playWritten(sel) }, icon('speaker'), ' Ascolta'),
        h('span', { class: 'muted small' }, `Suono reale: ${it ? nameIt(concert, true) : nameEn(concert)}`),
        f.primary.partial ? h('span', { class: 'muted small' }, `${f.primary.partial}° armonico`) : null),
      f.alternates.length ? h('div', { class: 'alts' }, h('div', { class: 'field-l' }, 'Diteggiature alternative'),
        h('div', { class: 'alts-row' }, f.alternates.map((a) => h('div', { class: 'alt' }, valvesGraphic(a.valves, 'sm'), h('span', { class: 'muted small' }, `${a.valves.join('-') || '0'} · ${a.partial}° arm.`))))) : null,
      ...intonationTip(sel).map((t) => h('p', { class: 'tip' }, '💡 ', t)),
    ].filter(Boolean));
    requestAnimationFrame(() => renderStaff(staffBox, [{ ...fromMidi(sel), dur: 'w' }]));
    [...grid.children].forEach((b) => b.classList.toggle('active', Number(b.dataset.m) === sel));
  }

  for (let m = RANGE_LOW; m <= RANGE_HIGH; m++) {
    const n = fromMidi(m);
    const v = fingeringsFor(m).primary.valves;
    grid.append(h('button', {
      class: 'fing-cell' + (isBlack(m) ? ' black' : ''), 'data-m': m,
      onclick: () => { sel = m; showDetail(); playWritten(m); detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); },
    }, h('span', { class: 'fc-name' }, store.settings().names === 'it' ? nameIt(n, true) : nameEn(n)), h('span', { class: 'fc-v' }, v.length ? v.join('') : '0')));
  }

  root.append(detail, h('section', { class: 'card' }, h('h2', {}, 'Tutte le note'), h('p', { class: 'muted small' }, 'Tocca una nota per vederla sul pentagramma e ascoltarla. Il numero indica i pistoni (0 = nessuno).'), grid));
  showDetail();
}

function quiz(root) {
  const level = store.settings().level;
  const { low, high } = LEVEL_RANGE[level];
  let target = 60;
  let pressed = new Set();
  let score = 0;
  let total = 0;
  let streak = 0;
  let answered = false;

  const staffBox = h('div', { class: 'staff staff-single' });
  const feedback = h('div', { class: 'quiz-fb', 'aria-live': 'polite' });
  const scoreEl = h('div', { class: 'quiz-score' });
  const valveBtns = [1, 2, 3].map((n) => h('button', {
    class: 'valve-btn', 'aria-pressed': 'false',
    onclick: () => {
      if (answered) return;
      pressed.has(n) ? pressed.delete(n) : pressed.add(n);
      valveBtns[n - 1].classList.toggle('down', pressed.has(n));
      valveBtns[n - 1].setAttribute('aria-pressed', String(pressed.has(n)));
    },
  }, h('span', {}, n)));
  const checkBtn = h('button', { class: 'btn btn-primary btn-lg', onclick: () => (answered ? next() : check()) }, 'Verifica');

  function updateScore() {
    scoreEl.textContent = `Punteggio ${score}/${total} · Serie ${streak} · Record ${store.get().quizBest}`;
  }
  function next() {
    let m;
    do { m = low + Math.floor(Math.random() * (high - low + 1)); } while (m === target);
    target = m;
    pressed = new Set();
    answered = false;
    valveBtns.forEach((b) => { b.classList.remove('down', 'right', 'wrong'); b.setAttribute('aria-pressed', 'false'); });
    feedback.textContent = 'Premi i pistoni giusti (nessuno = aperto) e poi Verifica.';
    feedback.className = 'quiz-fb';
    checkBtn.textContent = 'Verifica';
    const pref = Math.random() < 0.5 ? 'sharp' : 'flat';
    renderStaff(staffBox, [{ ...fromMidi(target, pref), dur: 'w' }]);
  }
  function check() {
    const f = fingeringsFor(target);
    const ans = [...pressed].sort().join('');
    const ok = [f.primary, ...f.alternates].some((x) => x.valves.join('') === ans);
    total++;
    if (ok) { score++; streak++; if (streak > store.get().quizBest) store.set('quizBest', streak); } else streak = 0;
    answered = true;
    playWritten(target);
    const right = f.primary.valves;
    feedback.className = 'quiz-fb ' + (ok ? 'good' : 'bad');
    feedback.textContent = (ok ? '✅ Giusto! ' : '❌ No: ') + `${noteNames(target)} si suona con ${right.length ? right.join('-') : '0 (aperto)'}.`;
    valveBtns.forEach((b, i) => b.classList.add(right.includes(i + 1) ? 'right' : 'x'));
    checkBtn.textContent = 'Prossima nota →';
    updateScore();
  }

  root.append(h('section', { class: 'card quiz' },
    h('p', { class: 'muted small' }, `Che pistoni premi per questa nota? Note dal livello "${level}" (cambialo in Impostazioni).`),
    h('div', { class: 'paper-card' }, staffBox),
    h('div', { class: 'valve-btns' }, valveBtns),
    feedback, checkBtn, scoreEl));
  requestAnimationFrame(() => { next(); updateScore(); });
}

function harmonics(root) {
  let valves = [];
  const staffBox = h('div', { class: 'staff' });
  const combos = [[], [2], [1], [1, 2], [2, 3], [1, 3], [1, 2, 3]];
  const OPEN = [60, 67, 72, 76, 79, 82, 84];
  const draw = () => {
    const semis = { '': 0, 2: 1, 1: 2, 12: 3, 23: 4, 13: 5, 123: 6 }[valves.join('')];
    const notes = OPEN.map((m, i) => ({ ...fromMidi(m - semis, 'flat'), dur: 'q', text: i === 5 ? '7°↓' : `${i === 6 ? 8 : i + 2}°` }));
    renderStaff(staffBox, notes);
  };
  root.append(h('section', { class: 'card' },
    h('h2', {}, 'La serie degli armonici'),
    h('p', { class: 'muted small' }, 'Con la stessa diteggiatura la tromba produce più note: gli "armonici". Si passa dall\'uno all\'altro cambiando la velocità dell\'aria e la tensione delle labbra. Ogni combinazione di pistoni abbassa tutta la serie. Il 7° armonico è molto calante e di solito non si usa.'),
    segmented(combos.map((c) => [c.join(''), c.length ? c.join('-') : '0']), '', (v) => { valves = v ? String(v).split('').map(Number) : []; draw(); }, 'seg-wide'),
    h('div', { class: 'paper-card mt' }, staffBox),
    h('button', { class: 'btn btn-ghost mt', onclick: () => playSeq() }, icon('speaker'), ' Ascolta la serie')));
  function playSeq() {
    const semis = { '': 0, 2: 1, 1: 2, 12: 3, 23: 4, 13: 5, 123: 6 }[valves.join('')];
    const { a4, instrument } = store.settings();
    OPEN.forEach((m, i) => {
      setTimeout(() => brassNote(writtenToFreq(m - semis, a4, instrument), undefined, 0.45, { volume: 0.3 }), i * 500);
    });
  }
  requestAnimationFrame(draw);
}

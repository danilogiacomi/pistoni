import { h, icon, fmtTime, fmtMinutes } from '../ui.js';
import { store, fmt, today } from '../store.js';
import { session } from '../session.js';
import { keyOfTheDay, keyLabel } from '../exercises.js';
import { installCard } from './installCard.js';

export function routineSteps(level) {
  const k = keyOfTheDay();
  const kStr = `${k[0]}${k[1]}`;
  const lip = level === 'base' ? '23' : level === 'medio' ? '234' : '2345';
  const lt = level === 'avanzato' ? 'ventaglio' : 'discendente';
  return [
    { id: 'respiro', title: 'Respirazione', min: 2, route: '#/respiro', desc: 'Respiri profondi e rilassati: l\'aria è il "carburante" della tromba.' },
    { id: 'bocchino', title: 'Buzzing al bocchino', min: 3, route: '#/esercizi/bocchino', desc: 'Risveglia le labbra con il solo bocchino.' },
    { id: 'note-lunghe', title: 'Note lunghe', min: 5, route: `#/esercizi/note-lunghe?variant=${lt}`, desc: 'Suono fermo, rotondo e intonato.' },
    { id: 'legati', title: 'Legati labiali', min: 5, route: `#/esercizi/legati?pattern=${lip}`, desc: 'Flessibilità tra gli armonici, senza lingua.' },
    { id: 'scale', title: `Scala di ${keyLabel(k)}`, min: 5, route: `#/esercizi/scale?key=${kStr}&octaves=${level === 'base' ? 1 : 2}`, desc: 'Tonalità del giorno: ogni giorno una diversa.' },
    { id: 'articolazione', title: 'Articolazione', min: 4, route: `#/esercizi/articolazione?type=${level === 'base' ? 'single' : 'double'}`, desc: 'Colpo di lingua pulito e regolare.' },
    { id: 'agilita', title: 'Agilità', min: 4, route: `#/esercizi/agilita${level === 'base' ? '?pattern=12321' : ''}`, desc: 'Dita veloci e coordinate con la lingua.' },
    { id: 'repertorio', title: 'Brani e studio libero', min: 10, route: '#/metronomo', desc: 'Applica tutto su un brano, con il metronomo.' },
  ];
}

export function mount(root) {
  const s = store.settings();
  const steps = routineSteps(s.level);
  const done = new Set(store.doneToday());

  const timerVal = h('div', { class: 'session-time' }, '0:00');
  const timerBtn = h('button', { class: 'btn btn-primary btn-lg', onclick: () => session.toggle() });
  const timerSub = h('div', { class: 'muted small' });
  const off = session.on((st) => {
    timerVal.textContent = fmtTime(st.elapsed);
    timerBtn.innerHTML = '';
    timerBtn.append(icon(st.running ? 'stop' : 'play'), st.running ? ' Pausa' : (st.elapsed > 0 ? ' Riprendi' : ' Inizia a studiare'));
    timerSub.textContent = st.running ? 'Il tempo viene salvato nel tuo diario.' : 'Avvia il cronometro quando prendi in mano la tromba.';
  });

  // statistiche
  const todaySec = store.secondsOn(today());
  const streak = store.streak();
  const week = [];
  const d = new Date();
  d.setDate(d.getDate() - 6);
  for (let i = 0; i < 7; i++) {
    week.push({ label: d.toLocaleDateString('it-IT', { weekday: 'narrow' }), sec: store.secondsOn(fmt(d)), isToday: i === 6 });
    d.setDate(d.getDate() + 1);
  }
  const maxSec = Math.max(1800, ...week.map((w) => w.sec));
  const weekTotal = week.reduce((a, w) => a + w.sec, 0);

  const progress = h('div', { class: 'progress-txt' });
  const bar = h('div', { class: 'progress-bar' }, h('div', { class: 'progress-fill' }));
  const updateProgress = () => {
    const n = steps.filter((x) => done.has(x.id)).length;
    progress.textContent = `${n}/${steps.length} completati`;
    bar.firstChild.style.width = `${(n / steps.length) * 100}%`;
  };

  const stepList = h('ol', { class: 'steps' }, steps.map((st, i) => {
    const li = h('li', { class: 'step' + (done.has(st.id) ? ' done' : '') });
    const chk = h('button', {
      class: 'step-check', 'aria-label': 'Segna come fatto',
      onclick: () => {
        if (done.has(st.id)) { done.delete(st.id); store.unmarkDone(st.id); li.classList.remove('done'); }
        else { done.add(st.id); store.markDone(st.id); li.classList.add('done'); }
        updateProgress();
      },
    }, icon('check'));
    li.append(
      chk,
      h('a', { class: 'step-body', href: st.route },
        h('div', { class: 'step-title' }, h('span', { class: 'step-n' }, i + 1), st.title),
        h('div', { class: 'step-desc' }, st.desc)),
      h('div', { class: 'step-min' }, `${st.min}′`),
    );
    return li;
  }));
  updateProgress();
  const totalMin = steps.reduce((a, x) => a + x.min, 0);
  const inst = installCard({ compact: true });

  root.append(
    h('section', { class: 'hero card' },
      h('div', { class: 'hero-top' },
        h('div', {},
          h('div', { class: 'eyebrow' }, new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })),
          h('h1', { class: 'hero-title' }, greeting()),
        ),
        h('div', { class: 'streak', title: 'Giorni consecutivi di studio' },
          h('div', { class: 'streak-n' }, streak), h('div', { class: 'streak-l' }, streak === 1 ? 'giorno di fila' : 'giorni di fila')),
      ),
      timerVal,
      timerBtn,
      timerSub,
    ),

    inst,

    h('section', { class: 'card' },
      h('div', { class: 'card-head' },
        h('h2', {}, 'Routine di oggi'),
        h('span', { class: 'chip' }, `~${totalMin} min · livello ${s.level}`)),
      h('p', { class: 'muted small' }, 'Una sequenza classica di riscaldamento e studio. Tocca un esercizio per aprirlo, poi spuntalo quando hai finito. Regola d\'oro: riposa quanto suoni.'),
      bar, progress,
      stepList,
    ),

    h('section', { class: 'card' },
      h('div', { class: 'card-head' }, h('h2', {}, 'Il tuo diario'), h('span', { class: 'chip' }, `Oggi ${fmtMinutes(todaySec)}`)),
      h('div', { class: 'week' }, week.map((w) => h('div', { class: 'week-col' + (w.isToday ? ' today' : '') },
        h('div', { class: 'week-bar-wrap' }, h('div', { class: 'week-bar', style: { height: `${Math.max(2, (w.sec / maxSec) * 100)}%` }, title: fmtMinutes(w.sec) })),
        h('div', { class: 'week-l' }, w.label)))),
      h('p', { class: 'muted small center' }, `Ultimi 7 giorni: ${fmtMinutes(weekTotal)}. Meglio 20 minuti ogni giorno che 2 ore una volta a settimana.`),
    ),

    h('section', { class: 'grid-2' },
      quick('#/accordatore', 'tuner', 'Accordatore', 'Intonazione e stabilità'),
      quick('#/metronomo', 'metro', 'Metronomo', 'Tempo e allenatore'),
      quick('#/diteggiature', 'valves', 'Diteggiature', 'Tabella e quiz'),
      quick('#/altro', 'more', 'Altri strumenti', 'Bordone, respiro, consigli'),
    ),
  );

  return () => { off(); inst.cleanup?.(); };
}

function quick(href, ic, title, sub) {
  return h('a', { class: 'card quick', href }, icon(ic, 'quick-ic'), h('div', {}, h('div', { class: 'quick-t' }, title), h('div', { class: 'muted small' }, sub)));
}

function greeting() {
  const hr = new Date().getHours();
  if (hr < 12) return 'Buongiorno! Pronto a suonare?';
  if (hr < 18) return 'Buon pomeriggio! Si studia?';
  return 'Buonasera! Un po\' di tromba?';
}

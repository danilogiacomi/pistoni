import { h, icon, fmtTime, fmtMinutes, segmented } from '../ui.js';
import { store, fmt, today } from '../store.js';
import { session } from '../session.js';
import { keyOfTheDay, keyLabel } from '../exercises.js';
import { installCard } from './installCard.js';

export const LEVELS = {
  base: { label: 'Base', who: 'Suoni da poco (primi 1-2 anni): registro fino al Do5, colpo di lingua semplice.' },
  medio: { label: 'Medio', who: 'Leggi bene e suoni in banda o in orchestra giovanile: fino al Sol5, scale su 2 ottave, doppio colpo.' },
  avanzato: { label: 'Avanzato', who: 'Conservatorio, professionisti o amatori esperti: fino al Do6 e oltre, flessibilità acuta, triplo colpo, tempi veloci.' },
};

export function routineSteps(level) {
  const k = keyOfTheDay();
  const km = keyOfTheDay(new Date(), true);
  const kStr = `${k[0]}${k[1]}`;
  const kmStr = `${km[0]}${km[1]}`;
  const ex = (id, q) => `#/esercizi/${id}?${new URLSearchParams(q)}`;

  if (level === 'avanzato') {
    return [
      { id: 'a-respiro', title: 'Respirazione', min: 2, route: '#/respiro?preset=rapido', desc: 'Respiro rapido e profondo, come in un brano.' },
      { id: 'a-bocchino', title: 'Buzzing al bocchino', min: 2, route: ex('bocchino', { variant: 'sirena' }), desc: 'Sirene su tutto il registro.' },
      { id: 'a-lunghe', title: 'Note lunghe con verifica', min: 5, route: ex('note-lunghe', { variant: 'ventaglio', verifica: 1 }), desc: 'A ventaglio, ppp, controlla stabilità e intonazione.' },
      { id: 'a-legati', title: 'Legati 2°–5° armonico', min: 4, route: ex('legati', { pattern: '2345', dur: '8', bpm: 72 }), desc: 'In crome, ♩ = 72. Passaggi senza "scalini".' },
      { id: 'a-flex', title: 'Flessibilità acuta (4°–8°)', min: 4, route: ex('legati', { pattern: '4568', dur: 'q', bpm: 72 }), desc: 'Fino al Do6 su tutte le posizioni, ♩ = 72.' },
      { id: 'a-trilli', title: 'Trilli labiali', min: 3, route: ex('legati', { pattern: 't56', bpm: 66 }), desc: 'Mi–Sol veloci senza pistoni. Poi prova 6°–8°.' },
      { id: 'a-terze', title: `${keyLabel(k)} per terze`, min: 5, route: ex('scale', { key: kStr, octaves: 2, pattern: 'terze', dur: '8', bpm: 100 }), desc: 'Due ottave in crome, ♩ = 100. Tonalità del giorno.' },
      { id: 'a-minore', title: `${keyLabel(km, true)} melodica`, min: 4, route: ex('scale', { key: kmStr, type: 'minorMel', octaves: 2, dur: '8', bpm: 108 }), desc: 'Due ottave, ♩ = 108.' },
      { id: 'a-cromatica', title: 'Cromatica Fa#3 – Do6', min: 3, route: ex('cromatica', { from: '54-84', dur: '8', bpm: 100 }), desc: 'Tutta l\'estensione in crome, ♩ = 100.' },
      { id: 'a-triplo', title: 'Triplo colpo nel registro acuto', min: 4, route: ex('articolazione', { type: 'triple', notes: 'alto', bpm: 100 }), desc: 'Ta-ta-ka su Sol4–Sol5, ♩ = 100.' },
      { id: 'a-agilita', title: 'Studio tecnico (stile Clarke)', min: 5, route: ex('agilita', { pattern: '13535431', from: '72', bpm: 104 }), desc: 'Da Do5 in giù, ♩ = 104, un respiro per gruppo.' },
      { id: 'a-acuto', title: 'Registro acuto fino al Mi6', min: 4, route: ex('acuto', { top: '88', bpm: 88 }), desc: 'Fermati alla prima nota forzata.' },
      { id: 'a-repertorio', title: 'Studi e repertorio', min: 15, route: '#/registrazioni', desc: 'Arban, Charlier, passi d\'orchestra: registrati e riascoltati.' },
    ];
  }
  if (level === 'medio') {
    return [
      { id: 'm-respiro', title: 'Respirazione', min: 2, route: '#/respiro', desc: 'Capacità polmonare ed espirazione costante.' },
      { id: 'm-bocchino', title: 'Buzzing al bocchino', min: 3, route: ex('bocchino', { variant: 'sirena' }), desc: 'Sirene: dal grave all\'acuto senza interruzioni.' },
      { id: 'm-lunghe', title: 'Note lunghe con verifica', min: 5, route: ex('note-lunghe', { variant: 'ventaglio', verifica: 1 }), desc: 'A ventaglio: l\'app controlla l\'intonazione.' },
      { id: 'm-legati', title: 'Legati 2°–4° armonico', min: 4, route: ex('legati', { pattern: '234', dur: 'q', bpm: 72 }), desc: 'Su tutte le 7 posizioni, ♩ = 72.' },
      { id: 'm-legati2', title: 'Legati 3°–5° armonico', min: 4, route: ex('legati', { pattern: '345', dur: 'q', bpm: 66 }), desc: 'Sale fino al Mi5. Aria veloce, labbra morbide.' },
      { id: 'm-scala', title: `Scala di ${keyLabel(k)}`, min: 5, route: ex('scale', { key: kStr, octaves: 2, dur: '8', bpm: 80 }), desc: 'Due ottave in crome, ♩ = 80. Tonalità del giorno.' },
      { id: 'm-arpeggi', title: 'Arpeggi', min: 3, route: ex('arpeggi', { key: kStr, bpm: 84 }), desc: 'Nella tonalità del giorno.' },
      { id: 'm-cromatica', title: 'Cromatica Sol3 – Sol5', min: 3, route: ex('cromatica', { from: '55-79', dur: '8', bpm: 72 }), desc: 'Coordinazione lingua-dita.' },
      { id: 'm-doppio', title: 'Doppio colpo di lingua', min: 4, route: ex('articolazione', { type: 'double', bpm: 72 }), desc: 'Ta-ka regolari, ♩ = 72.' },
      { id: 'm-agilita', title: 'Studio tecnico (stile Clarke)', min: 5, route: ex('agilita', { pattern: '12345432', bpm: 80 }), desc: 'Legato, ♩ = 80.' },
      { id: 'm-acuto', title: 'Registro acuto fino al La5', min: 3, route: ex('acuto', { top: '81', bpm: 80 }), desc: 'Senza forzare: aria, non pressione.' },
      { id: 'm-repertorio', title: 'Studi e brani', min: 10, route: '#/metronomo', desc: 'Applica tutto su uno studio o un brano.' },
    ];
  }
  return [
    { id: 'respiro', title: 'Respirazione', min: 2, route: '#/respiro?preset=calma', desc: 'Respiri profondi e rilassati: l\'aria è il "carburante" della tromba.' },
    { id: 'bocchino', title: 'Buzzing al bocchino', min: 3, route: '#/esercizi/bocchino', desc: 'Risveglia le labbra con il solo bocchino.' },
    { id: 'note-lunghe', title: 'Note lunghe', min: 5, route: ex('note-lunghe', { variant: 'discendente' }), desc: 'Suono fermo, rotondo e intonato.' },
    { id: 'legati', title: 'Legati labiali', min: 5, route: ex('legati', { pattern: '23', dur: 'h' }), desc: 'Flessibilità tra gli armonici, senza lingua.' },
    { id: 'scale', title: `Scala di ${keyLabel(k)}`, min: 5, route: ex('scale', { key: kStr, octaves: 1, bpm: 72 }), desc: 'Tonalità del giorno: ogni giorno una diversa.' },
    { id: 'articolazione', title: 'Articolazione', min: 4, route: ex('articolazione', { type: 'single', bpm: 72 }), desc: 'Colpo di lingua pulito e regolare.' },
    { id: 'agilita', title: 'Agilità', min: 4, route: ex('agilita', { pattern: '12321', bpm: 72 }), desc: 'Dita veloci e coordinate con la lingua.' },
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

  const rerender = () => window.dispatchEvent(new HashChangeEvent('hashchange'));
  const levelPicker = segmented(Object.entries(LEVELS).map(([k2, v]) => [k2, v.label]), s.level, (v) => {
    store.setSetting('level', v);
    store.setSetting('levelChosen', true);
    rerender();
  }, 'seg-wide');

  const welcome = s.levelChosen ? null : h('section', { class: 'card welcome' },
    h('h2', {}, 'Che livello sei?'),
    h('p', { class: 'muted small' }, 'La routine, l\'estensione e la velocità degli esercizi si adattano al tuo livello. Puoi cambiarlo quando vuoi.'),
    h('div', { class: 'level-cards' }, Object.entries(LEVELS).map(([k2, v]) => h('button', {
      class: 'level-card' + (k2 === s.level ? ' active' : ''),
      onclick: () => { store.setSetting('level', k2); store.setSetting('levelChosen', true); rerender(); },
    }, h('span', { class: 'level-t' }, v.label), h('span', { class: 'level-d' }, v.who)))));

  root.append(
    welcome,
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
        h('span', { class: 'chip' }, `~${totalMin} min · ${steps.length} esercizi`)),
      levelPicker,
      h('p', { class: 'muted small level-who' }, LEVELS[s.level].who),
      h('p', { class: 'muted small' }, 'Tocca un esercizio per aprirlo con tempo e impostazioni già pronti, poi spuntalo. Regola d\'oro: riposa quanto suoni.'),
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
      quick('#/esercizi/note-lunghe?verifica=1', 'tuner', 'Suona e verifica', 'L\'app ti ascolta e ti dà un voto'),
      quick('#/registrazioni', 'mic', 'Registratore', 'Registrati e riascoltati'),
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

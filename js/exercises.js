// Generatori di esercizi. Tutte le note sono "scritte" (come le legge il trombettista).
import {
  fromMidi, spell, buildScale, bestStartOctave, KEYS, MINOR_KEYS, SCALE_TYPES,
  harmonicSeries, VALVE_COMBOS, fingeringsFor, LETTER_PC, nameIt,
} from './music.js';

const R = (dur) => ({ rest: true, dur });
const N = (midi, dur, text, pref) => ({ ...fromMidi(midi, pref), dur, text });
const S = (n, dur, text) => ({ ...n, dur, text });
const valvesTxt = (midi) => {
  const v = fingeringsFor(midi).primary.valves;
  return v.length ? v.join('') : '0';
};

export const LEVEL_RANGE = {
  base: { low: 55, high: 72 }, // Sol3 - Do5
  medio: { low: 54, high: 79 }, // Fa#3 - Sol5
  avanzato: { low: 54, high: 84 }, // Fa#3 - Do6
};

// Tonalità del giorno: ruota ogni giorno sul circolo delle quinte
export function keyOfTheDay(date = new Date(), minor = false) {
  const day = Math.floor((date.getTime() - date.getTimezoneOffset() * 60000) / 86400000);
  return (minor ? MINOR_KEYS : KEYS)[day % 12];
}

// Toniche selezionabili (ortografia più comune)
export const TONICS = [['C', 0], ['C', 1], ['D', -1], ['D', 0], ['E', -1], ['E', 0], ['F', 0], ['F', 1], ['G', 0], ['G', 1], ['A', -1], ['A', 0], ['B', -1], ['B', 0]];

export function keyLabel([letter, acc], minor = false) {
  return nameIt({ letter, acc }) + (minor ? ' minore' : ' maggiore');
}

// ---------------------------------------------------------------
export const CATALOG = [
  {
    id: 'note-lunghe',
    title: 'Note lunghe',
    icon: '〰️',
    cat: 'Suono',
    desc: 'La base del bel suono. Suona ogni nota piano (p), con aria costante, senza vibrato. Ascoltati: il suono deve essere fermo, rotondo e intonato. Respira bene nelle pause.',
    tips: ['Imposta un tempo lento (60 o meno).', 'Usa l\'accordatore in un\'altra scheda per controllare la stabilità.', 'Riposa quanto suoni.'],
    options: [
      { id: 'variant', label: 'Schema', type: 'select', values: [['discendente', 'Discendente (Sol4 → giù)'], ['ventaglio', 'A ventaglio (Sol4 ↔)'], ['ascendente', 'Ascendente (Sol4 → su)']] },
    ],
    tempo: 60,
    build({ variant = 'discendente', level = 'base' }) {
      const { low, high } = LEVEL_RANGE[level];
      const notes = [];
      if (variant === 'discendente') {
        for (let m = 67; m >= Math.max(low, 54); m--) notes.push(N(m, 'w', valvesTxt(m)), R('w'));
      } else if (variant === 'ventaglio') {
        for (let d = 1; 67 - d >= Math.max(low, 54); d++) {
          notes.push(N(67, 'h', valvesTxt(67)), N(67 - d, 'h', valvesTxt(67 - d)), R('w'));
        }
      } else {
        for (let m = 67; m <= high; m++) notes.push(N(m, 'w', valvesTxt(m)), R('w'));
      }
      return notes;
    },
  },
  {
    id: 'legati',
    title: 'Legati labiali',
    icon: '🌊',
    cat: 'Flessibilità',
    desc: 'Passa da un armonico all\'altro SENZA cambiare diteggiatura e senza colpo di lingua. Cambia la velocità dell\'aria (non la pressione!) e la forma della bocca ("ah-ii"). Lo stesso schema si ripete su tutte le 7 posizioni.',
    tips: ['Inizia lento: il passaggio tra le note deve essere pulito, senza "scalini".', 'Se senti fatica, fermati e riposa.', 'Sotto le note trovi i pistoni da premere.'],
    options: [
      { id: 'pattern', label: 'Schema', type: 'select', values: [
        ['23', 'Do–Sol (2°–3° armonico)'], ['234', 'Do–Sol–Do (2°–4°)'], ['345', 'Sol–Do–Mi (3°–5°)'],
        ['2345', 'Do–Sol–Do–Mi (2°–5°)'], ['24', 'Salto d\'ottava Do–Do (2°–4°)'], ['456', 'Do–Mi–Sol (4°–6°)'],
        ['3456', 'Sol–Do–Mi–Sol (3°–6°)'], ['4568', 'Do–Mi–Sol–Do (4°–8°, avanzato)'],
        ['t45', 'Trillo labiale Do–Mi (4°–5°)'], ['t56', 'Trillo labiale Mi–Sol (5°–6°)'], ['t68', 'Trillo labiale Sol–Do (6°–8°, avanzato)']] },
      { id: 'dur', label: 'Valori', type: 'select', values: [['h', 'Minime (lento)'], ['q', 'Semiminime'], ['8', 'Crome (veloce)']] },
    ],
    tempo: 66,
    build({ pattern = '23', dur = 'h' }) {
      const trill = pattern.startsWith('t');
      let seqP;
      if (trill) {
        const [a, b] = pattern.slice(1).split('').map(Number);
        seqP = [a, b, a, b, a, b, a, b, a];
      } else {
        const parts = pattern.split('').map(Number);
        seqP = [...parts, ...parts.slice(0, -1).reverse()];
      }
      const notes = [];
      // ogni posizione produce un accordo maggiore: ortografia come scala maggiore della fondamentale
      const ROOTS = { '': ['C', 0], 2: ['B', 0], 1: ['B', -1], 12: ['A', 0], 23: ['A', -1], 13: ['G', 0], 123: ['F', 1] };
      const DEG = { 2: 0, 3: 4, 4: 7, 5: 9, 6: 11, 8: 14 }; // indice nella scala maggiore di 2 ottave
      for (const c of VALVE_COMBOS.filter((x) => !(x.v.length === 1 && x.v[0] === 3))) {
        const [rl, ra] = ROOTS[c.v.join('')];
        const series = harmonicSeries(c.v, [2]);
        const sc = buildScale(rl, ra, 'major', Math.floor((series[0] - (LETTER_PC[rl] + ra)) / 12) - 1, 2);
        const label = c.v.join('') || '0';
        if (trill) {
          seqP.forEach((p, k) => notes.push(S(sc[DEG[p]], k === seqP.length - 1 ? 'q' : '16', k === 0 ? label : undefined)));
          notes.push(R('q'));
        } else {
          seqP.forEach((p, k) => notes.push(S(sc[DEG[p]], dur, k === 0 ? label : undefined)));
          // pausa per respirare
          notes.push(R(dur === 'h' ? 'h' : dur === 'q' ? 'q' : '8'));
        }
      }
      return notes;
    },
  },
  {
    id: 'scale',
    title: 'Scale',
    icon: '🎼',
    cat: 'Tecnica',
    desc: 'Le scale sono il "vocabolario" del musicista. Suonale legate e poi staccate, prima lente e intonate, poi più veloci. Ogni giorno l\'app propone una tonalità diversa.',
    tips: ['Prima lenta e perfetta, poi più veloce di 4 bpm alla volta.', 'Prova anche staccato ("ta") e legato.'],
    options: [
      { id: 'key', label: 'Tonalità', type: 'key' },
      { id: 'type', label: 'Tipo', type: 'select', values: Object.entries(SCALE_TYPES).map(([k, v]) => [k, v.label]) },
      { id: 'octaves', label: 'Ottave', type: 'select', values: [['1', '1 ottava'], ['2', '2 ottave']] },
      { id: 'pattern', label: 'Disegno', type: 'select', values: [['lineare', 'Scala semplice'], ['terze', 'Per terze']] },
      { id: 'dur', label: 'Valori', type: 'select', values: [['q', 'Semiminime'], ['8', 'Crome']] },
      { id: 'fing', label: 'Pistoni sotto le note', type: 'select', values: [['1', 'Mostra'], ['0', 'Nascondi']] },
    ],
    tempo: 80,
    build({ key, type = 'major', octaves = '1', pattern = 'lineare', dur = 'q', fing = '1' }) {
      const minor = type !== 'major';
      const [l, a] = key ? parseKey(key) : keyOfTheDay(new Date(), minor);
      let oct = Number(octaves);
      let start = bestStartOctave(l, a, oct);
      if (start == null) { oct = 1; start = bestStartOctave(l, a, 1); } // 2 ottave fuori estensione
      const sc = buildScale(l, a, type, start ?? 4, oct);
      const upNotes = sc;
      let downNotes = sc.slice(0, -1).reverse();
      if (type === 'minorMel') {
        // melodica: discendente = naturale
        const nat = buildScale(sc[0].letter, sc[0].acc, 'minorNat', sc[0].octave, oct);
        downNotes = nat.slice(0, -1).reverse();
      }
      let seq = [...upNotes, ...downNotes];
      if (pattern === 'terze') {
        const thirds = (arr) => { const out = []; for (let i = 0; i + 2 < arr.length; i++) out.push(arr[i], arr[i + 2]); return out; };
        seq = [...thirds(upNotes), ...thirds([upNotes[upNotes.length - 1], ...downNotes]).slice(1)];
      }
      const notes = seq.slice(0, -1).map((n) => S(n, dur, fing === '1' ? valvesTxt(n.midi) : undefined));
      const lastN = seq[seq.length - 1];
      notes.push(S(lastN, 'h', fing === '1' ? valvesTxt(lastN.midi) : undefined));
      return notes;
    },
  },
  {
    id: 'arpeggi',
    title: 'Arpeggi',
    icon: '🪜',
    cat: 'Tecnica',
    desc: 'Arpeggi maggiori e minori: allenano l\'orecchio, gli intervalli e la flessibilità. Pensa la nota prima di suonarla.',
    tips: ['Canta mentalmente ogni nota prima di suonarla.', 'Mantieni l\'aria costante nei salti.'],
    options: [
      { id: 'key', label: 'Tonalità', type: 'key' },
      { id: 'type', label: 'Tipo', type: 'select', values: [['major', 'Maggiore'], ['minorNat', 'Minore']] },
    ],
    tempo: 76,
    build({ key, type = 'major' }) {
      const [letter, acc] = key ? parseKey(key) : keyOfTheDay(new Date(), type !== 'major');
      const sc = buildScale(letter, acc, type, bestStartOctave(letter, acc, 1) ?? 4, 1);
      const deg = [0, 2, 4, 7, 4, 2];
      const notes = [];
      for (let r = 0; r < 2; r++) deg.forEach((d) => notes.push(S(sc[d], 'q', valvesTxt(sc[d].midi))));
      notes.push(S(sc[0], 'h', valvesTxt(sc[0].midi)), R('h'));
      return notes;
    },
  },
  {
    id: 'agilita',
    title: 'Agilità delle dita',
    icon: '⚡',
    cat: 'Tecnica',
    desc: 'Studio tecnico sul modello dei classici esercizi di Clarke: lo stesso disegno di 5 note, ripetuto scendendo di mezzo tono. Suonalo legato, in un solo respiro per ogni gruppo, con dita leggere e veloci.',
    tips: ['Le dita premono i pistoni con decisione, fino in fondo, con la punta delle dita.', 'Aumenta il tempo solo quando è pulito.'],
    options: [
      { id: 'pattern', label: 'Disegno', type: 'select', values: [['12345432', '1-2-3-4-5-4-3-2'], ['13535431', '1-3-5-3-5-4-3-1'], ['12321', '1-2-3-2-1 (facile)']] },
      { id: 'from', label: 'Da', type: 'select', values: [['67', 'Sol4'], ['72', 'Do5'], ['62', 'Re4']] },
    ],
    tempo: 72,
    build({ pattern = '12345432', from = '67', level = 'base' }) {
      const deg = pattern.split('').map((d) => Number(d) - 1);
      const start = Number(from);
      const { low } = LEVEL_RANGE[level];
      const notes = [];
      for (let root = start; root >= Math.max(low, 54); root--) {
        const [l, a] = keyForPc(root % 12);
        const oct = Math.floor((root - (LETTER_PC[l] + a)) / 12) - 1;
        const sc = buildScale(l, a, 'major', oct, 1);
        if (sc[0].midi !== root) continue;
        if (deg.length === 5) {
          deg.forEach((d) => notes.push(S(sc[d], 'q')));
          notes.push(R('q'), R('h'));
        } else {
          for (let rep = 0; rep < 2; rep++) deg.forEach((d) => notes.push(S(sc[d], '8')));
          notes.push(S(sc[0], 'h'), R('h'));
        }
        if (root < start - 7 && level === 'base') break;
      }
      return notes;
    },
  },
  {
    id: 'cromatica',
    title: 'Scala cromatica',
    icon: '🎹',
    cat: 'Tecnica',
    desc: 'Tutte le note, a distanza di mezzo tono. Ottimo per imparare le diteggiature e la coordinazione lingua-dita. In salita si scrivono i diesis, in discesa i bemolle.',
    tips: ['Guarda i pistoni sotto le note finché non li conosci a memoria.'],
    options: [
      { id: 'from', label: 'Estensione', type: 'select', values: [['60-72', 'Do4 – Do5'], ['55-79', 'Sol3 – Sol5'], ['54-84', 'Fa#3 – Do6']] },
      { id: 'dur', label: 'Valori', type: 'select', values: [['q', 'Semiminime'], ['8', 'Crome']] },
    ],
    tempo: 72,
    build({ from = '60-72', dur = 'q' }) {
      const [a, b] = from.split('-').map(Number);
      const notes = [];
      for (let m = a; m <= b; m++) notes.push(N(m, dur, valvesTxt(m), 'sharp'));
      for (let m = b - 1; m >= a; m--) notes.push(N(m, m === a ? 'h' : dur, valvesTxt(m), 'flat'));
      return notes;
    },
  },
  {
    id: 'articolazione',
    title: 'Articolazione',
    icon: '👅',
    cat: 'Lingua',
    desc: 'Colpo di lingua: la lingua "apre" la nota come se dicessi "ta" (o "da" per un attacco morbido). Il doppio colpo alterna "ta-ka", il triplo "ta-ta-ka". L\'aria non si ferma mai: la lingua interrompe solo per un attimo.',
    tips: ['Esercita il "ka" anche da solo: è la sillaba più debole.', 'Le note devono sembrare tutte uguali.'],
    options: [
      { id: 'type', label: 'Tipo', type: 'select', values: [['single', 'Colpo semplice (ta)'], ['double', 'Doppio colpo (ta-ka)'], ['triple', 'Triplo colpo (ta-ta-ka)']] },
      { id: 'notes', label: 'Note', type: 'select', values: [['arp', 'Do4 – Mi4 – Sol4 – Do5'], ['alto', 'Sol4 – Do5 – Mi5 – Sol5'], ['g', 'Solo Sol4'], ['c', 'Solo Do4']] },
    ],
    tempo: 80,
    build({ type = 'single', notes: which = 'arp' }) {
      const roots = which === 'g' ? [67, 67, 67, 67] : which === 'c' ? [60, 60, 60, 60] : which === 'alto' ? [67, 72, 76, 79] : [60, 64, 67, 72];
      const seq = [...roots, ...roots.slice(0, -1).reverse()];
      const out = [];
      seq.forEach((m) => {
        if (type === 'single') {
          out.push(N(m, 'q', 'ta'), N(m, 'q', 'ta'));
          for (let i = 0; i < 4; i++) out.push(N(m, '8', 'ta'));
          out.push(N(m, 'h', 'ta'), R('h'));
        } else if (type === 'double') {
          for (let i = 0; i < 8; i++) out.push(N(m, '16', i % 2 ? 'ka' : 'ta'));
          out.push(N(m, 'q', 'ta'), R('q'));
        } else {
          for (let i = 0; i < 9; i++) out.push(N(m, '8t', i % 3 === 2 ? 'ka' : 'ta'));
          out.push(N(m, 'q', 'ta'));
        }
      });
      return out;
    },
  },
  {
    id: 'acuto',
    title: 'Registro acuto',
    icon: '🚀',
    cat: 'Flessibilità',
    desc: 'Arpeggi che salgono di mezzo tono alla volta, per estendere il registro acuto poco per volta. Il segreto è la velocità dell\'aria e il sostegno degli addominali, non la pressione del bocchino sulle labbra.',
    tips: ['Fermati alla prima nota che esce "strozzata" o forzata: il registro cresce in settimane di lavoro costante.', 'Pensa la sillaba "iii" salendo: la lingua alta accelera l\'aria.', 'Riposa almeno quanto hai suonato, e chiudi con qualche nota grave e morbida.'],
    options: [
      { id: 'top', label: 'Fino a', type: 'select', values: [['79', 'Sol5'], ['81', 'La5'], ['84', 'Do6'], ['86', 'Re6'], ['88', 'Mi6']] },
    ],
    tempo: 80,
    build({ top = '79' }) {
      const T = Number(top);
      const notes = [];
      for (let root = 60; root + 12 <= T; root++) {
        const [l, a] = keyForPc(root % 12);
        const oct = Math.floor((root - (LETTER_PC[l] + a)) / 12) - 1;
        const sc = buildScale(l, a, 'major', oct, 1);
        const [d1, d3, d5, d8] = [0, 2, 4, 7].map((d) => sc[d]);
        notes.push(S(d1, 'q', valvesTxt(d1.midi)), S(d3, 'q'), S(d5, 'q'), S(d8, 'q', valvesTxt(d8.midi)), S(d5, 'q'), S(d3, 'q'), S(d1, 'h'), R('w'));
      }
      return notes;
    },
  },
  {
    id: 'bocchino',
    title: 'Buzzing al bocchino',
    icon: '💋',
    cat: 'Suono',
    desc: 'Solo bocchino, senza tromba. Ascolta la nota e poi riproducila "ronzando" con le labbra (buzz). Allena l\'orecchio e la precisione delle labbra. Qui le note sono in suono reale (non trasportate).',
    tips: ['Tieni il bocchino tra pollice e indice, senza premere.', 'Il suono deve essere un ronzio pieno, non un fischio.', 'Prova anche delle "sirene": scivola lentamente dal grave all\'acuto.'],
    options: [
      { id: 'variant', label: 'Schema', type: 'select', values: [['scala', 'Pentacordo discendente'], ['sirena', 'Sirena (glissando)']] },
    ],
    tempo: 60,
    concert: true,
    build({ variant = 'scala' }) {
      if (variant === 'sirena') {
        return [62, 65, 69, 72, 69, 65, 62].map((m) => N(m, 'h')).concat([R('h')]);
      }
      const notes = [];
      [67, 65, 64, 62, 60].forEach((m) => notes.push(N(m, 'h'), R('h')));
      notes.push(N(60, 'q'), N(62, 'q'), N(64, 'q'), N(65, 'q'), N(67, 'h'), R('h'));
      return notes;
    },
  },
];

export function parseKey(s) {
  // formato "C0", "B-1", "F1"
  const letter = s[0];
  const acc = Number(s.slice(1) || 0);
  return [letter, acc];
}
export function keyToStr([l, a]) { return `${l}${a}`; }

function keyForPc(pc) {
  for (const k of KEYS) if (((LETTER_PC[k[0]] + k[1]) % 12 + 12) % 12 === pc) return k;
  return ['C', 0];
}

export function getExercise(id) {
  return CATALOG.find((e) => e.id === id);
}

export { KEYS, MINOR_KEYS, spell };

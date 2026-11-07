// Teoria musicale di base per tromba in Sib.
// Tutte le note "scritte" sono in MIDI (C4 = 60). Suono reale = scritto - 2 (tromba in Sib).

export const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
export const LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export const IT_NAMES = { C: 'Do', D: 'Re', E: 'Mi', F: 'Fa', G: 'Sol', A: 'La', B: 'Si' };
const ACC_SYMBOL = { '-2': '𝄫', '-1': '♭', '0': '', '1': '♯', '2': '𝄪' };
const ACC_VF = { '-2': 'bb', '-1': 'b', '0': '', '1': '#', '2': '##' };

// Estensione scritta della tromba gestita dall'app
export const RANGE_LOW = 54; // F#3
export const RANGE_HIGH = 88; // E6

export const TRANSPOSE = { Bb: -2, C: 0 };

/** Nota "scritta" con ortografia: { letter, acc, octave, midi } */
export function spell(letter, acc, octave) {
  return { letter, acc, octave, midi: 12 * (octave + 1) + LETTER_PC[letter] + acc };
}

// Ortografia preferita per una nota cromatica (contesto neutro)
const SHARP_SPELL = [['C', 0], ['C', 1], ['D', 0], ['D', 1], ['E', 0], ['F', 0], ['F', 1], ['G', 0], ['G', 1], ['A', 0], ['A', 1], ['B', 0]];
const FLAT_SPELL = [['C', 0], ['D', -1], ['D', 0], ['E', -1], ['E', 0], ['F', 0], ['G', -1], ['G', 0], ['A', -1], ['A', 0], ['B', -1], ['B', 0]];
// Ortografia "di uso comune" per trombettisti: Fa#, Do#, Mib, Sib, Lab
const COMMON_SPELL = [['C', 0], ['C', 1], ['D', 0], ['E', -1], ['E', 0], ['F', 0], ['F', 1], ['G', 0], ['A', -1], ['A', 0], ['B', -1], ['B', 0]];

export function fromMidi(midi, pref = 'common') {
  const table = pref === 'sharp' ? SHARP_SPELL : pref === 'flat' ? FLAT_SPELL : COMMON_SPELL;
  const pc = ((midi % 12) + 12) % 12;
  const [letter, acc] = table[pc];
  let octave = Math.floor(midi / 12) - 1;
  // B#/Cb non usati in queste tabelle: ottava coerente
  return { letter, acc, octave, midi };
}

export function nameIt(n, withOctave = false) {
  return IT_NAMES[n.letter] + ACC_SYMBOL[n.acc] + (withOctave ? n.octave : '');
}
export function nameEn(n, withOctave = true) {
  return n.letter + ACC_SYMBOL[n.acc] + (withOctave ? n.octave : '');
}
export function vfKey(n) {
  return `${n.letter.toLowerCase()}${ACC_VF[n.acc]}/${n.octave}`;
}
export function vfAcc(n) {
  return ACC_VF[n.acc];
}

export function midiToFreq(midi, a4 = 440) {
  return a4 * Math.pow(2, (midi - 69) / 12);
}
export function freqToMidiFloat(f, a4 = 440) {
  return 69 + 12 * Math.log2(f / a4);
}

/** Frequenza reale di una nota scritta per tromba in Sib. */
export function writtenToFreq(writtenMidi, a4 = 440, instrument = 'Bb') {
  return midiToFreq(writtenMidi + TRANSPOSE[instrument], a4);
}

// ---------------- Scale ----------------
export const SCALE_TYPES = {
  major: { label: 'Maggiore', steps: [2, 2, 1, 2, 2, 2, 1] },
  minorNat: { label: 'Minore naturale', steps: [2, 1, 2, 2, 1, 2, 2] },
  minorHarm: { label: 'Minore armonica', steps: [2, 1, 2, 2, 1, 3, 1] },
  minorMel: { label: 'Minore melodica', steps: [2, 1, 2, 2, 2, 2, 1] },
};

// Tonalità (scritte) in ordine di circolo delle quinte
export const KEYS = [
  ['C', 0], ['G', 0], ['D', 0], ['A', 0], ['E', 0], ['B', 0], ['F', 1],
  ['D', -1], ['A', -1], ['E', -1], ['B', -1], ['F', 0],
];
export const MINOR_KEYS = [
  ['A', 0], ['E', 0], ['B', 0], ['F', 1], ['C', 1], ['G', 1], ['E', -1],
  ['B', -1], ['F', 0], ['C', 0], ['G', 0], ['D', 0],
];

/** Scala con ortografia corretta (lettere consecutive). octaves = 1 o 2. */
export function buildScale(rootLetter, rootAcc, type, startOctave, octaves = 1) {
  const steps = SCALE_TYPES[type].steps;
  const root = spell(rootLetter, rootAcc, startOctave);
  const notes = [root];
  let midi = root.midi;
  let li = LETTERS.indexOf(rootLetter);
  let oct = startOctave;
  for (let o = 0; o < octaves; o++) {
    for (const s of steps) {
      midi += s;
      li++;
      if (li === 7) { li = 0; oct++; }
      const letter = LETTERS[li];
      const natural = 12 * (oct + 1) + LETTER_PC[letter];
      notes.push({ letter, acc: midi - natural, octave: oct, midi });
    }
  }
  return notes;
}

/** Sceglie l'ottava di partenza così che la scala stia nell'estensione comoda. */
export function bestStartOctave(rootLetter, rootAcc, octaves, low = 55, high = 81) {
  const span = 12 * octaves;
  let best = null;
  let bestScore = Infinity;
  for (const oct of [3, 4, 5]) {
    const m = spell(rootLetter, rootAcc, oct).midi;
    if (m < RANGE_LOW || m + span > RANGE_HIGH) continue;
    // preferenza: stare nel registro centrale (Do4-Sol5)
    const lowPen = Math.max(0, low - m);
    const highPen = Math.max(0, m + span - high) * 1.5;
    const score = lowPen + highPen + Math.abs(m + span / 2 - 69) * 0.05;
    if (score < bestScore) { bestScore = score; best = oct; }
  }
  return best;
}

// ---------------- Diteggiature ----------------
// Combinazioni di pistoni e quanti semitoni abbassano
export const VALVE_COMBOS = [
  { v: [], semis: 0 },
  { v: [2], semis: 1 },
  { v: [1], semis: 2 },
  { v: [1, 2], semis: 3 },
  { v: [3], semis: 3 },
  { v: [2, 3], semis: 4 },
  { v: [1, 3], semis: 5 },
  { v: [1, 2, 3], semis: 6 },
];
// Armonici a pistoni aperti (scritti). Il 7° armonico (Sib5) è molto calante: escluso.
export const OPEN_PARTIALS = { 2: 60, 3: 67, 4: 72, 5: 76, 6: 79, 8: 84, 9: 86, 10: 88 };

// Diteggiatura standard per ogni nota scritta
const PRIMARY = {
  54: [1, 2, 3], 55: [1, 3], 56: [2, 3], 57: [1, 2], 58: [1], 59: [2],
  60: [], 61: [1, 2, 3], 62: [1, 3], 63: [2, 3], 64: [1, 2], 65: [1], 66: [2],
  67: [], 68: [2, 3], 69: [1, 2], 70: [1], 71: [2],
  72: [], 73: [1, 2], 74: [1], 75: [2], 76: [],
  77: [1], 78: [2], 79: [], 80: [2, 3], 81: [1, 2], 82: [1], 83: [2],
  84: [], 85: [1, 2], 86: [1], 87: [2], 88: [],
};

const key = (v) => v.join('');

export function fingeringsFor(midi) {
  const primary = PRIMARY[midi] || [];
  const all = [];
  for (const [p, open] of Object.entries(OPEN_PARTIALS)) {
    for (const c of VALVE_COMBOS) {
      if (open - c.semis === midi) all.push({ valves: c.v, partial: Number(p) });
    }
  }
  const prim = all.find((f) => key(f.valves) === key(primary)) || { valves: primary, partial: null };
  const alts = all.filter((f) => key(f.valves) !== key(primary));
  // evita alternative assurde (123 / 13 molto in alto sono comunque valide ma poco usate)
  return { primary: prim, alternates: alts };
}

/** Consigli di intonazione per la diteggiatura standard di una nota. */
export function intonationTip(midi) {
  const { primary } = fingeringsFor(midi);
  const v = key(primary.valves);
  const tips = [];
  if (v === '123') tips.push('Tende a essere crescente: allunga la pompa del 3° pistone (e/o del 1°).');
  else if (v === '13') tips.push('Tende a essere crescente: allunga la pompa del 3° pistone.');
  if (primary.partial === 5) tips.push('5° armonico: tende a essere leggermente calante.');
  if (midi === 62 || midi === 61) tips.push('Nota tipicamente da correggere con la pompa del 3° pistone.');
  if (midi === 74 || midi === 73) tips.push('Se calante, prova la diteggiatura alternativa (1-3 per il Re, 1-2-3 per il Do#).');
  if (midi >= 81) tips.push('Registro acuto: più velocità d\'aria, non più pressione sulle labbra.');
  return [...new Set(tips)];
}

/** Serie armonica per una combinazione di pistoni (note scritte). */
export function harmonicSeries(valves, partials = [2, 3, 4, 5, 6, 8]) {
  const c = VALVE_COMBOS.find((x) => key(x.v) === key(valves));
  return partials.map((p) => OPEN_PARTIALS[p] - c.semis);
}

export function valvesLabel(v) {
  return v.length ? v.join('-') : '0 (aperto)';
}

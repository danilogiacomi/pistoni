import { h, icon, segmented, fmtTime, toast } from '../ui.js';
import { startDrone, bell, getCtx } from '../audio.js';
import { store } from '../store.js';
import { fromMidi, nameIt, nameEn, midiToFreq, fingeringsFor } from '../music.js';
import { session } from '../session.js';
import { installCard } from './installCard.js';

// ------------------------------------------------------------ Menu "Altro"
export function mountMore(root) {
  const item = (href, emoji, t, d) => h('a', { class: 'ex-item', href }, h('span', { class: 'ex-ic' }, emoji), h('span', { class: 'ex-body' }, h('span', { class: 'ex-t' }, t), h('span', { class: 'ex-d' }, d)), h('span', { class: 'chev' }, '›'));
  root.append(
    h('header', { class: 'page-head' }, h('h1', {}, 'Altri strumenti')),
    h('section', { class: 'card' }, h('div', { class: 'ex-list' },
      item('#/registrazioni', '🎙', 'Registratore', 'Registrati, riascoltati e manda le registrazioni al tuo insegnante.'),
      item('#/bordone', '🎵', 'Bordone', 'Una nota tenuta di sottofondo per allenare l\'intonazione.'),
      item('#/respiro', '🫁', 'Respirazione', 'Esercizi guidati per capacità e controllo dell\'aria.'),
      item('#/trasposizione', '🔁', 'Trasposizione', 'Da suono reale (pianoforte, chitarra) a tromba in Si♭ e viceversa.'),
      item('#/consigli', '🧰', 'Consigli e cura dello strumento', 'Postura, imboccatura, riposo, pulizia e olio dei pistoni.'),
      item('#/impostazioni', '⚙️', 'Impostazioni', 'Livello, nomi delle note, La di riferimento, installa l\'app.'),
    )),
  );
}

// ------------------------------------------------------------ Bordone
export function mountDrone(root) {
  let drone = null;
  let pc = 0; // classe di altezza del suono reale (0 = Do)
  let octave = 4;
  let fifth = false;
  const { a4, names, instrument } = store.settings();
  const it = names === 'it';
  const off = instrument === 'Bb' ? 2 : 0; // pc = suono reale; l'etichetta è la nota scritta

  const info = h('div', { class: 'muted small center' });
  const btn = h('button', { class: 'btn btn-primary btn-lg', onclick: () => (drone ? stop() : start()) });
  const setBtn = () => { btn.innerHTML = ''; btn.append(icon(drone ? 'stop' : 'play'), drone ? ' Ferma' : ' Suona bordone'); };
  setBtn();

  const midi = () => 12 * (octave + 1) + pc;
  const update = () => {
    const concert = fromMidi(midi());
    const written = fromMidi(midi() + off);
    const nm = (n) => (it ? nameIt(n) : nameEn(n, false));
    info.textContent = `${off ? `Suono reale ${nm(concert)} = sulla tromba Si♭ leggi ${nm(written)}` : `Nota ${nm(concert)}`} (${midiToFreq(midi(), store.settings().a4).toFixed(1)} Hz)`;
    drone?.setFreq(midiToFreq(midi(), store.settings().a4));
  };
  function start() { drone = startDrone(midiToFreq(midi(), a4), { withFifth: fifth }); setBtn(); }
  function stop() { drone?.stop(); drone = null; setBtn(); }

  pc = (12 - off) % 12; // di default: Do scritto
  const notes = Array.from({ length: 12 }, (_, w) => {
    const writtenN = fromMidi(60 + w);
    return [(w - off + 12) % 12, it ? nameIt(writtenN) : nameEn(writtenN, false)];
  });

  root.append(
    h('header', { class: 'page-head' }, h('a', { class: 'back', href: '#/altro' }, icon('back'), 'Altro'), h('h1', {}, 'Bordone'),
      h('p', { class: 'lead' }, 'Suona scale e note lunghe sopra questa nota fissa: le "battimenti" (il suono che ondeggia) spariscono quando sei intonato. È il modo migliore per allenare l\'orecchio.')),
    h('section', { class: 'card' },
      h('div', { class: 'field-l' }, 'Nota (come la leggi sulla tromba)'),
      segmented(notes, pc, (v) => { pc = Number(v); update(); }, 'seg-grid'),
      h('div', { class: 'field-l mt' }, 'Registro'),
      segmented([[3, 'Grave'], [4, 'Medio']], octave, (v) => { octave = Number(v); update(); }),
      h('label', { class: 'switch-row mt' }, h('div', {}, h('div', { class: 'field-l' }, 'Aggiungi la quinta'), h('div', { class: 'muted small' }, 'Suono più ricco, utile per le scale.')),
        h('span', { class: 'switch' }, h('input', { type: 'checkbox', onchange: (e) => { fifth = e.target.checked; if (drone) { stop(); start(); } } }), h('span', { class: 'slider' }))),
      btn, info),
  );
  update();
  return () => stop();
}

// ------------------------------------------------------------ Respirazione
export function mountBreath(root, params = new URLSearchParams()) {
  const presets = {
    calma: { label: 'Relax', inhale: 4, hold: 0, exhale: 6, rounds: 6, desc: 'Respiri lenti per sciogliere le tensioni prima di suonare.' },
    capacita: { label: 'Capacità', inhale: 4, hold: 2, exhale: 12, rounds: 5, desc: 'Inspira a fondo (pancia, fianchi, schiena), espira lentamente su "ssss" in modo costante.' },
    rapido: { label: 'Rapido', inhale: 1, hold: 0, exhale: 8, rounds: 6, desc: 'Inspira velocemente dalla bocca come durante un brano, poi espira lungo e costante.' },
  };
  let preset = presets[params.get('preset')] ? params.get('preset') : 'capacita';
  let running = false;
  let timer = null;

  const circle = h('div', { class: 'breath-circle' }, h('div', { class: 'breath-txt' }, 'Pronto'));
  const sub = h('div', { class: 'breath-sub muted' }, ' ');
  const desc = h('p', { class: 'muted small center' }, presets[preset].desc);
  const btn = h('button', { class: 'btn btn-primary btn-lg', onclick: () => (running ? stop() : start()) }, 'Inizia');

  function phase(name, secs, scale) {
    return new Promise((res) => {
      circle.firstChild.textContent = name;
      circle.style.transitionDuration = `${secs}s`;
      circle.style.transform = `scale(${scale})`;
      let left = secs;
      sub.textContent = left;
      const iv = setInterval(() => { left--; sub.textContent = left > 0 ? left : ''; }, 1000);
      timer = setTimeout(() => { clearInterval(iv); res(); }, secs * 1000);
      stopIv = () => clearInterval(iv);
    });
  }
  let stopIv = () => {};

  async function start() {
    running = true;
    getCtx();
    btn.textContent = 'Ferma';
    const p = presets[preset];
    for (let r = 0; r < p.rounds && running; r++) {
      circle.dataset.round = `${r + 1}/${p.rounds}`;
      await phase('Inspira', p.inhale, 1.0);
      if (!running) break;
      if (p.hold) { await phase('Trattieni', p.hold, 1.0); if (!running) break; }
      await phase('Espira', p.exhale, 0.45);
    }
    if (running) { bell(); toast('Fatto! Ora prendi la tromba.'); store.markDone('respiro'); }
    stop();
  }
  function stop() {
    running = false;
    clearTimeout(timer);
    stopIv();
    circle.style.transitionDuration = '0.6s';
    circle.style.transform = 'scale(0.45)';
    circle.firstChild.textContent = 'Pronto';
    delete circle.dataset.round;
    sub.textContent = ' ';
    btn.textContent = 'Inizia';
  }

  // test del fiato
  let tStart = 0;
  let tIv = null;
  const tOut = h('div', { class: 'big-time' }, '0:00');
  const best = () => Number(localStorage.getItem('pistoni:breathBest') || 0);
  const bestEl = h('div', { class: 'muted small center' }, `Record: ${best()} s`);
  const tBtn = h('button', { class: 'btn btn-ghost btn-lg', onclick: () => {
    if (tIv) {
      clearInterval(tIv); tIv = null;
      const sec = Math.round((Date.now() - tStart) / 1000);
      if (sec > best()) { try { localStorage.setItem('pistoni:breathBest', sec); } catch (e) { /* */ } toast('Nuovo record! 🎉'); }
      bestEl.textContent = `Record: ${best()} s`;
      tBtn.textContent = 'Avvia cronometro';
    } else {
      tStart = Date.now();
      tIv = setInterval(() => { tOut.textContent = fmtTime((Date.now() - tStart) / 1000); }, 200);
      tBtn.textContent = 'Stop';
    }
  } }, 'Avvia cronometro');

  root.append(
    h('header', { class: 'page-head' }, h('a', { class: 'back', href: '#/' }, icon('back'), 'Oggi'), h('h1', {}, 'Respirazione'),
      h('p', { class: 'lead' }, 'Il suono della tromba nasce dall\'aria. Respira in modo profondo e rilassato: spalle basse, si espande la zona della pancia e dei fianchi, non il petto.')),
    h('section', { class: 'card breath-card' },
      segmented(Object.entries(presets).map(([k, v]) => [k, v.label]), preset, (v) => { stop(); preset = v; desc.textContent = presets[v].desc; }, 'seg-wide'),
      desc,
      h('div', { class: 'breath-stage' }, circle),
      sub,
      btn),
    h('section', { class: 'card' },
      h('h2', {}, 'Quanto dura il tuo fiato?'),
      h('p', { class: 'muted small' }, 'Fai un respiro profondo e suona una nota media (es. Sol) piano e costante il più a lungo possibile. Avvia il cronometro quando inizi, fermalo quando finisce l\'aria. Non forzare mai fino a farti male.'),
      tOut, bestEl, tBtn),
  );
  return () => { stop(); clearInterval(tIv); };
}

// ------------------------------------------------------------ Trasposizione
export function mountTranspose(root) {
  const it = store.settings().names === 'it';
  const nm = (n) => (it ? nameIt(n) : nameEn(n, false));
  const rows = Array.from({ length: 12 }, (_, i) => {
    const concert = fromMidi(60 + i);
    const written = fromMidi(60 + i + 2);
    return h('tr', {}, h('td', {}, nm(concert)), h('td', { class: 'arrow' }, '→'), h('td', { class: 'strong' }, nm(written)), h('td', { class: 'muted' }, (fingeringsFor(60 + i + 2).primary.valves.join('') || '0')));
  });
  root.append(
    h('header', { class: 'page-head' }, h('a', { class: 'back', href: '#/altro' }, icon('back'), 'Altro'), h('h1', {}, 'Trasposizione'),
      h('p', { class: 'lead' }, 'La tromba è uno strumento "traspositore": quando leggi Do, in realtà suona un Si♭ (un tono sotto). Per suonare una parte scritta per pianoforte, voce o chitarra, devi leggere ogni nota un tono SOPRA.')),
    h('section', { class: 'card' },
      h('table', { class: 'tbl' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Suono reale'), h('th', {}, ''), h('th', {}, 'Leggi/suoni sulla tromba'), h('th', {}, 'Pistoni'))),
        h('tbody', {}, rows)),
      h('p', { class: 'tip' }, '💡 Le tonalità si spostano allo stesso modo: un brano in Fa maggiore (suono reale) per te sarà in Sol maggiore; uno in Si♭ diventa Do.'),
      h('p', { class: 'tip' }, '💡 Se suoni una tromba in Do (usata in orchestra), non serve trasporre: imposta "Suono reale" in Impostazioni.')),
  );
}

// ------------------------------------------------------------ Consigli
export function mountTips(root) {
  const sec = (title, items) => h('details', { class: 'acc' }, h('summary', {}, title), h('ul', { class: 'tips' }, items.map((t) => h('li', {}, t))));
  root.append(
    h('header', { class: 'page-head' }, h('a', { class: 'back', href: '#/altro' }, icon('back'), 'Altro'), h('h1', {}, 'Consigli e cura')),
    h('section', { class: 'card' },
      sec('🧍 Postura', [
        'Stai dritto ma rilassato, in piedi o seduto sul bordo della sedia.',
        'La tromba va verso l\'alto o dritta, non puntata verso il pavimento: l\'aria deve scorrere libera.',
        'La mano sinistra regge lo strumento, la destra deve solo muovere le dita: niente forza sul mignolo (anello).',
        'Polso destro morbido, dita curve, si preme con i polpastrelli al centro dei pistoni.',
      ]),
      sec('👄 Imboccatura', [
        'Il bocchino si appoggia di solito circa metà sul labbro superiore e metà su quello inferiore (varia da persona a persona: chiedi al tuo insegnante).',
        'Angoli della bocca fermi e "a punta", non tirati in un sorriso.',
        'Non premere il bocchino contro le labbra per salire all\'acuto: usa più velocità d\'aria.',
        'Se le labbra si gonfiano o bruciano, fermati: è stanchezza, non va forzata.',
      ]),
      sec('⏱️ Come studiare', [
        'Riposa quanto suoni: es. 1 minuto di esercizio, 1 minuto di pausa (o lavori di testa nel frattempo).',
        'Inizia sempre con un riscaldamento morbido nel registro medio-grave.',
        'Meglio poco ma ogni giorno: i muscoli delle labbra si costruiscono con la costanza.',
        'Studia lento e preciso, poi aumenta la velocità con il metronomo (+4 bpm alla volta).',
        'Registrati con il telefono e riascoltati: si sentono cose che suonando non si notano.',
        'Finisci la sessione con qualche nota lunga piano nel registro grave per "rilassare" le labbra.',
      ]),
      sec('🛢️ Olio dei pistoni', [
        'Metti qualche goccia di olio quando i pistoni diventano lenti o rumorosi (spesso ogni 2-3 giorni di studio).',
        'Svita il pistone, tiralo su a metà, metti 2-3 gocce sulla parte metallica, rimettilo girandolo finché non "scatta" nella guida.',
        'Ogni pistone ha il suo numero: non scambiarli di posto!',
        'Le pompe (le parti che si sfilano) vanno ingrassate con un grasso apposito, non con l\'olio.',
      ]),
      sec('🛁 Pulizia', [
        'Sciacquati la bocca o lavati i denti prima di suonare: il cibo finisce dentro la tromba.',
        'Svuota l\'acqua di condensa con la chiave dell\'acqua (la levetta sulla pompa di accordo): è normale, non è saliva.',
        'Bocchino: puliscilo ogni settimana con acqua tiepida, sapone e lo scovolino apposito.',
        'Una volta al mese (o ogni 2-3 mesi) fai il "bagno" completo: acqua tiepida (mai bollente) e sapone delicato, scovolino nei tubi, poi asciuga, olia e ingrassa.',
        'Non far cadere il bocchino: un piccolo bozzo nel cannello cambia il suono.',
      ]),
      sec('🎧 Orecchio e intonazione', [
        'Usa il bordone: suona una scala sopra la nota fissa e ascolta quando i suoni "si fondono".',
        'Canta (anche a bocca chiusa) le note prima di suonarle.',
        'Accorda con la pompa principale (quella grande davanti) dopo esserti scaldato, su un Do o un Sol scritto.',
        'Ascolta tanti trombettisti: classica, jazz, banda, pop. Il suono che hai in testa è quello che uscirà dalla tromba.',
      ]),
    ),
  );
}

// ------------------------------------------------------------ Impostazioni
export function mountSettings(root) {
  const s = store.settings();
  const row = (label, desc, ctrl) => h('div', { class: 'set-row' }, h('div', {}, h('div', { class: 'field-l' }, label), desc ? h('div', { class: 'muted small' }, desc) : null), ctrl);
  const a4 = h('output', {}, s.a4);
  root.append(
    h('header', { class: 'page-head' }, h('a', { class: 'back', href: '#/altro' }, icon('back'), 'Altro'), h('h1', {}, 'Impostazioni')),
    h('section', { class: 'card' },
      row('Livello', 'Adatta l\'estensione e la difficoltà degli esercizi e della routine.', segmented([['base', 'Base'], ['medio', 'Medio'], ['avanzato', 'Avanzato']], s.level, (v) => { store.setSetting('level', v); store.setSetting('levelChosen', true); })),
      row('Nomi delle note', null, segmented([['it', 'Do Re Mi'], ['en', 'C D E']], s.names, (v) => store.setSetting('names', v))),
      row('Strumento', 'La maggior parte degli studenti suona la tromba in Si♭.', segmented([['Bb', 'Tromba in Si♭'], ['C', 'Tromba in Do']], s.instrument, (v) => store.setSetting('instrument', v))),
      row('La di riferimento', 'Usato da accordatore, bordone e suoni guida.', h('div', { class: 'stepper' },
        h('button', { class: 'btn btn-round sm', onclick: () => { store.setSetting('a4', Math.max(436, store.settings().a4 - 1)); a4.textContent = store.settings().a4; } }, '−'),
        h('span', {}, a4, ' Hz'),
        h('button', { class: 'btn btn-round sm', onclick: () => { store.setSetting('a4', Math.min(446, store.settings().a4 + 1)); a4.textContent = store.settings().a4; } }, '+'))),
    ),
    installCard(),
    h('section', { class: 'card' },
      h('h2', {}, 'Dati'),
      h('p', { class: 'muted small' }, 'Il diario di studio resta solo su questo dispositivo, nel browser. Nessun dato viene inviato altrove.'),
      h('button', { class: 'btn btn-danger', onclick: () => { if (confirm('Cancellare diario e impostazioni?')) { session.reset(); store.reset(); toast('Dati cancellati'); location.hash = '#/'; } } }, 'Cancella tutti i dati')),
    h('p', { class: 'muted small center' }, 'Pistoni · fatto con ♥ per chi suona la tromba'),
  );
}

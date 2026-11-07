import { h, icon, fmtTime, toast } from '../ui.js';
import { recordings, startRecording, recorderSupported, extFor } from '../recordings.js';
import { micErrorMessage } from '../mic.js';
import { session } from '../session.js';

/** Una registrazione con player, condivisione e cancellazione. */
export function recordingItem(rec, { onDelete } = {}) {
  const url = URL.createObjectURL(rec.blob);
  const d = new Date(rec.date);
  const fileName = `pistoni-${d.toISOString().slice(0, 16).replace(/[T:]/g, '-')}-${slug(rec.title)}.${extFor(rec.mime)}`;
  const file = typeof File === 'function' ? new File([rec.blob], fileName, { type: rec.mime }) : null;
  const canShare = file && navigator.canShare?.({ files: [file] });

  const el = h('div', { class: 'rec-item' },
    h('div', { class: 'rec-meta' },
      h('div', { class: 'rec-title' }, rec.title),
      h('div', { class: 'muted small' }, `${d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} ${d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })} · ${fmtTime(rec.duration)}`)),
    fixDuration(h('audio', { controls: true, preload: 'metadata', src: url, class: 'rec-audio' })),
    h('div', { class: 'rec-actions' },
      canShare
        ? h('button', { class: 'chip-btn', onclick: () => navigator.share({ files: [file], title: rec.title }).catch(() => {}) }, '📤 Condividi')
        : h('a', { class: 'chip-btn', href: url, download: fileName }, '⬇︎ Scarica'),
      h('button', {
        class: 'chip-btn danger',
        onclick: async () => {
          if (!confirm('Eliminare questa registrazione?')) return;
          await recordings.remove(rec.id);
          URL.revokeObjectURL(url);
          el.remove();
          onDelete?.();
        },
      }, '🗑 Elimina')),
  );
  return el;
}

// Chrome: i file webm di MediaRecorder non hanno durata finché non si "cerca" la fine
function fixDuration(audio) {
  audio.addEventListener('loadedmetadata', () => {
    if (audio.duration !== Infinity) return;
    const back = () => { audio.removeEventListener('timeupdate', back); audio.currentTime = 0; };
    audio.addEventListener('timeupdate', back);
    audio.currentTime = 1e101;
  }, { once: true });
  return audio;
}

function slug(s) {
  return (s || 'registrazione').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
}

/** Pagina "Registrazioni": registratore libero + archivio. */
export function mountRecorder(root) {
  let rec = null;
  let tick = null;
  const time = h('div', { class: 'big-time' }, '0:00');
  const status = h('div', { class: 'muted small center' }, 'Registra un brano o un esercizio, poi riascoltati.');
  const list = h('div', { class: 'rec-list' });
  const empty = h('p', { class: 'muted small' }, 'Nessuna registrazione salvata.');
  const meter = h('div', { class: 'rec-dot' });
  const btn = h('button', { class: 'btn rec-btn', 'aria-label': 'Registra', onclick: () => (rec ? stop() : start()) }, h('span', { class: 'rec-btn-in' }));

  async function start() {
    try {
      rec = await startRecording();
    } catch (e) {
      status.textContent = micErrorMessage(e);
      return;
    }
    if (!session.state().running) session.start();
    btn.classList.add('on');
    meter.classList.add('on');
    status.textContent = 'Sto registrando… tocca di nuovo per fermare.';
    tick = setInterval(() => { time.textContent = fmtTime((Date.now() - rec.startedAt) / 1000); }, 250);
  }
  async function stop() {
    clearInterval(tick);
    const r = rec;
    rec = null;
    btn.classList.remove('on');
    meter.classList.remove('on');
    const res = await r.stop();
    if (!res || res.duration < 0.5) { status.textContent = 'Registrazione troppo breve.'; return; }
    const item = { date: Date.now(), title: 'Registrazione libera', mime: res.mime, duration: res.duration, blob: res.blob };
    item.id = await recordings.add(item);
    status.textContent = 'Salvata! La trovi qui sotto.';
    time.textContent = '0:00';
    empty.remove();
    list.prepend(recordingItem(item, { onDelete: refreshEmpty }));
    toast('Registrazione salvata');
  }
  function refreshEmpty() { if (!list.children.length) list.append(empty); }

  root.append(
    h('header', { class: 'page-head' }, h('a', { class: 'back', href: '#/altro' }, icon('back'), 'Altro'), h('h1', {}, 'Registratore'),
      h('p', { class: 'lead' }, 'Mentre suoni non ti senti come ti sente chi ascolta. Registrati spesso: è uno dei consigli più utili degli insegnanti. Puoi anche mandare le registrazioni al tuo insegnante.')),
    recorderSupported()
      ? h('section', { class: 'card rec-card' }, meter, time, btn, status)
      : h('section', { class: 'card' }, h('p', {}, 'Questo browser non supporta la registrazione audio.')),
    h('section', { class: 'card' }, h('h2', {}, 'Le tue registrazioni'), h('p', { class: 'muted small' }, 'Restano solo su questo dispositivo (le ultime 30).'), list),
  );

  recordings.list().then((all) => {
    if (!all.length) list.append(empty);
    all.forEach((r) => list.append(recordingItem(r, { onDelete: refreshEmpty })));
  }).catch(() => list.append(h('p', { class: 'muted small' }, 'Archivio non disponibile in questa modalità del browser.')));

  return () => { clearInterval(tick); if (rec) stop(); };
}

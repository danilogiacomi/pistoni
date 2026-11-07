import { h, icon, fmtTime } from './ui.js';
import { unlockAudioOnGesture } from './audio.js';
import { session } from './session.js';
import * as home from './views/home.js';
import * as exercises from './views/exercises.js';
import * as fingerings from './views/fingerings.js';
import * as tuner from './views/tuner.js';
import * as metronome from './views/metronome.js';
import * as tools from './views/tools.js';

const routes = [
  { re: /^\/?$/, tab: 'home', mount: (el) => home.mount(el) },
  { re: /^\/esercizi\/?$/, tab: 'esercizi', mount: (el) => exercises.mountList(el) },
  { re: /^\/esercizi\/([\w-]+)$/, tab: 'esercizi', mount: (el, m, q) => exercises.mountDetail(el, m[1], q) },
  { re: /^\/diteggiature$/, tab: 'diteggiature', mount: (el, m, q) => fingerings.mount(el, q) },
  { re: /^\/accordatore$/, tab: 'accordatore', mount: (el) => tuner.mount(el) },
  { re: /^\/metronomo$/, tab: 'metronomo', mount: (el) => metronome.mount(el) },
  { re: /^\/altro$/, tab: 'altro', mount: (el) => tools.mountMore(el) },
  { re: /^\/bordone$/, tab: 'altro', mount: (el) => tools.mountDrone(el) },
  { re: /^\/respiro$/, tab: 'home', mount: (el) => tools.mountBreath(el) },
  { re: /^\/trasposizione$/, tab: 'altro', mount: (el) => tools.mountTranspose(el) },
  { re: /^\/consigli$/, tab: 'altro', mount: (el) => tools.mountTips(el) },
  { re: /^\/impostazioni$/, tab: 'altro', mount: (el) => tools.mountSettings(el) },
];

const TABS = [
  ['home', '#/', 'home', 'Oggi'],
  ['esercizi', '#/esercizi', 'notes', 'Esercizi'],
  ['diteggiature', '#/diteggiature', 'valves', 'Pistoni'],
  ['accordatore', '#/accordatore', 'tuner', 'Accorda'],
  ['metronomo', '#/metronomo', 'metro', 'Tempo'],
];

const main = document.getElementById('view');
const nav = document.getElementById('tabs');
let cleanup = null;

nav.append(...TABS.map(([id, href, ic, label]) => h('a', { class: 'tab', href, 'data-tab': id }, icon(ic), h('span', {}, label))));

function route() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, qs] = raw.split('?');
  const q = new URLSearchParams(qs || '');
  const r = routes.find((x) => x.re.test(path)) || routes[0];
  try { cleanup?.(); } catch (e) { console.error(e); }
  cleanup = null;
  main.replaceChildren();
  const el = h('div', { class: 'view-inner' });
  main.append(el);
  cleanup = r.mount(el, path.match(r.re), q) || null;
  nav.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === r.tab));
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', route);
route();
unlockAudioOnGesture();

// pillola del cronometro nell'header
const pill = document.getElementById('session-pill');
session.on((st) => {
  pill.hidden = !st.running && st.elapsed < 1;
  pill.classList.toggle('paused', !st.running);
  pill.querySelector('span').textContent = fmtTime(st.elapsed);
});
pill.addEventListener('click', () => session.toggle());

// Service worker (offline)
if ('serviceWorker' in navigator && location.hostname !== 'localhost') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

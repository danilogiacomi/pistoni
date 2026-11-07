// Service worker: app shell offline (cache-first) con aggiornamento in background.
const VERSION = 'pistoni-v3';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './vendor/vexflow-bravura.js',
  './js/app.js',
  './js/install.js',
  './js/mic.js',
  './js/verify.js',
  './js/recordings.js',
  './js/views/recorder.js',
  './js/views/installCard.js',
  './js/ui.js',
  './js/audio.js',
  './js/music.js',
  './js/notation.js',
  './js/exercises.js',
  './js/player.js',
  './js/pitch.js',
  './js/session.js',
  './js/store.js',
  './js/views/home.js',
  './js/views/exercises.js',
  './js/views/fingerings.js',
  './js/views/tuner.js',
  './js/views/metronome.js',
  './js/views/tools.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// stale-while-revalidate per i file dell'app
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const cached = await cache.match(req, { ignoreSearch: req.mode === 'navigate' });
      const network = fetch(req)
        .then((res) => {
          if (res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached || (req.mode === 'navigate' ? cache.match('./index.html') : undefined));
      return cached || network;
    }),
  );
});

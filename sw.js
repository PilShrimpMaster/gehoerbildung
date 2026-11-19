// Service Worker: speichert die App für die Offline-Nutzung.
const VERSION = 'gbt-v1.3.1';
const CORE = [
  './', 'index.html', 'manifest.webmanifest', 'css/style.css',
  'js/app.js', 'js/store.js', 'js/sync.js', 'js/theory.js', 'js/audio.js', 'js/pitch.js', 'js/notation.js',
  'js/modules/index.js', 'js/modules/intervals.js', 'js/modules/chords.js', 'js/modules/scales.js',
  'vendor/vexflow.js', 'icons/icon.svg', 'icons/icon-192.png', 'icons/apple-touch-icon.png',
];
const SAMPLES = ['A1', 'C2', 'Ds2', 'Fs2', 'A2', 'C3', 'Ds3', 'Fs3', 'A3', 'C4', 'Ds4', 'Fs4', 'A4', 'C5', 'Ds5', 'Fs5', 'A5', 'C6', 'Ds6', 'Fs6', 'A6', 'C7']
  .map((n) => `audio/${n}.mp3`);

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    await c.addAll(CORE);
    // Klänge einzeln, damit ein Fehler nicht die ganze Installation abbricht
    await Promise.all(SAMPLES.map((u) => c.add(u).catch(() => null)));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const c = await caches.open(VERSION);
    const hit = await c.match(req, { ignoreSearch: true });
    if (hit) {
      // Im Hintergrund aktualisieren (nicht für die großen Klangdateien)
      if (!req.url.includes('/audio/')) fetch(req).then((r) => r.ok && c.put(req, r)).catch(() => {});
      return hit;
    }
    try {
      const res = await fetch(req);
      if (res.ok) c.put(req, res.clone());
      return res;
    } catch (err) {
      if (req.mode === 'navigate') return (await c.match('index.html')) || Response.error();
      return Response.error();
    }
  })());
});

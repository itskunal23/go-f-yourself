// Service worker for the "Go Fuck Yourself" PWA.
// Strategy: precache the app shell, serve static assets cache-first, and
// always go to the network for the live game (the /ws WebSocket and /api/*
// are never cached so multiplayer stays real-time).

const CACHE = 'gfy-v34';
const SHELL = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/app.js',
  '/js/api.js',
  '/js/mobile.js',
  '/js/cards.js',
  '/js/game.js',
  '/js/bac.js',
  '/manifest.webmanifest',
  '/assets/app-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Never cache the API or websocket upgrade — multiplayer must be live.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/ws')) return;

  // JS modules: network-first so game code updates without stale SW lock-in.
  if (url.pathname.startsWith('/js/') || url.pathname.startsWith('/vendor/')) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res && res.status === 200 && url.origin === self.location.origin) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // App shell / static: cache-first, fall back to network and update cache.
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((res) => {
          if (res && res.status === 200 && url.origin === self.location.origin) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() => cached || caches.match('/index.html'));
      return cached || fetchPromise;
    })
  );
});

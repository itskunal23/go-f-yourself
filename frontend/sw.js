const CACHE = 'gfy-v98';
const SHELL = [
  '/',
  '/index.html',
  '/css/styles.css?v=98',
  '/css/game-theatre.css?v=15',
  '/css/card-stacks.css?v=9',
  '/js/app.js?v=98',
  '/js/motion.js',
  '/js/dom-utils.js',
  '/js/physics/card-motion.js',
  '/js/interactions/hand-focus.js',
  '/js/render/hand-render.js',
  '/js/render/table-diff.js',
  '/manifest.webmanifest',
  '/assets/app-icon-180.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/ws')) return;

  if (url.pathname.startsWith('/js/') || url.pathname.startsWith('/vendor/') || url.pathname.startsWith('/css/')) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res?.status === 200 && url.origin === self.location.origin) {
            caches.open(CACHE).then((c) => c.put(request, res.clone()));
          }
          return res;
        })
        .catch(() => caches.match(request)),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((res) => {
      if (res?.status === 200 && url.origin === self.location.origin) {
        caches.open(CACHE).then((c) => c.put(request, res.clone()));
      }
      return res;
    })),
  );
});

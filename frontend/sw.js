// ─── Murmur Service Worker ───
const SW_CACHE = 'murmur-v18';
const APP_SHELL = [
  '/',
  '/static/index.html',
  '/static/css/style.css',
  '/static/js/app.js',
  '/static/manifest.json'
];

// ─── Install: cache app shell ───
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SW_CACHE).then((cache) => {
      return cache.addAll(APP_SHELL).catch(() => {});
    }).then(() => self.skipWaiting())
  );
});

// ─── Activate: clean old caches ───
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((k) => k !== SW_CACHE).map((k) => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

// ─── Fetch: network-first for navigations & static assets, cache-first for media ───
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Never cache API requests
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Cover images: cache-first (they don't change often)
  if (url.pathname.startsWith('/media/covers/')) {
    event.respondWith(
      caches.open(SW_CACHE).then((cache) => {
        return cache.match(req).then((cached) => {
          const network = fetch(req).then((res) => {
            if (res && res.status === 200) {
              cache.put(req, res.clone()).catch(() => {});
            }
            return res;
          }).catch(() => cached);
          return cached || network;
        });
      })
    );
    return;
  }

  // Skip audio/video files (they use Range requests that SW can't cache)
  if (url.pathname.startsWith('/media/audio/') || url.pathname.startsWith('/media/video/')) {
    return;
  }

  // ─── Network-first for HTML, CSS, JS ───
  // Always try network first so latest code is served; fall back to cache only when offline
  event.respondWith(
    fetch(req).then((res) => {
      if (res && res.status === 200 && req.url.startsWith(self.location.origin)) {
        const clone = res.clone();
        caches.open(SW_CACHE).then((cache) => cache.put(req, clone)).catch(() => {});
      }
      return res;
    }).catch(() => {
      return caches.match(req).then((cached) => cached || new Response('Offline', { status: 503 }));
    })
  );
});

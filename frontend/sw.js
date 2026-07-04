// ─── Murmur Service Worker ───
const SW_CACHE = 'murmur-v1';
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

// ─── Fetch: stale-while-revalidate ───
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Never cache API requests
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Cover images under /media/
  if (url.pathname.startsWith('/media/')) {
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

  // Default: stale-while-revalidate for app shell & static assets
  event.respondWith(
    caches.open(SW_CACHE).then((cache) => {
      return cache.match(req).then((cached) => {
        const network = fetch(req).then((res) => {
          if (res && res.status === 200 && (req.url.startsWith(self.location.origin))) {
            cache.put(req, res.clone()).catch(() => {});
          }
          return res;
        }).catch(() => cached);
        return cached || network;
      });
    })
  );
});

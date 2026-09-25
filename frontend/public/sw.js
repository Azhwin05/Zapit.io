// A8: Cache name must be incremented on every deploy to bust stale caches.
// Use the build timestamp injected at build time, or increment the version manually.
const CACHE_NAME = 'zapit-shell-v2';

const SHELL_ASSETS = ['/', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never intercept non-GET or cross-origin requests.
  if (event.request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.protocol === 'ws:' || url.protocol === 'wss:') return;

  // A8: Network-first for HTML navigation requests.
  // This ensures users always get fresh HTML (with current JS chunk URLs) after
  // a deploy, preventing broken pages caused by stale HTML referencing old chunks.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
          }
          return res;
        })
        .catch(() =>
          // Offline fallback: serve cached shell.
          caches.match('/').then((cached) => cached ?? Response.error()),
        ),
    );
    return;
  }

  // Cache-first for all other assets (JS/CSS/fonts are hashed by Next.js).
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
        }
        return res;
      });
    }),
  );
});

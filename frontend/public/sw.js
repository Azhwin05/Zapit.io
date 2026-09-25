// A8: Cache name must be incremented on every deploy to bust stale caches.
// Use the build timestamp injected at build time, or increment the version manually.
const CACHE_NAME = 'zapit-shell-v3';

const SHELL_ASSETS = ['/', '/manifest.json'];

// Web Share Target (Android/Chrome — no iOS Safari support as of this
// writing). Files shared from the OS share sheet arrive here as a POST;
// there's no client-side JS running yet to hand them to, so they're staged
// in a dedicated Cache Storage bucket and the page reads them back on load.
// Files are opaque Blobs to the Cache API, so this needs no IndexedDB/lib.
const SHARE_CACHE = 'zapit-share-target-v1';

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

  // Web Share Target: the OS delivers shared files as a POST here. Read the
  // multipart body, stash each file in Cache Storage under a fresh session
  // key, then redirect to a normal GET page that reads them back — a
  // service worker can't hand a File object directly to page JS any other way.
  if (event.request.method === 'POST' && url.pathname === '/share-target') {
    event.respondWith(handleShareTarget(event.request));
    return;
  }

  // Never intercept other non-GET or cross-origin requests.
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

async function handleShareTarget(request) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('shared_files').filter((f) => f instanceof File);

    const sessionId = crypto.randomUUID();
    const cache = await caches.open(SHARE_CACHE);
    const index = files.map((f, i) => ({ name: f.name, type: f.type, key: `/shared-file/${sessionId}/${i}` }));

    await Promise.all(
      files.map((f, i) =>
        cache.put(index[i].key, new Response(f, { headers: { 'Content-Type': f.type || 'application/octet-stream' } })),
      ),
    );
    await cache.put(
      `/shared-file/${sessionId}/index`,
      new Response(JSON.stringify(index), { headers: { 'Content-Type': 'application/json' } }),
    );

    return Response.redirect(`/?shared=${sessionId}`, 303);
  } catch (err) {
    console.error('[zapit:sw] share-target failed', err);
    return Response.redirect('/', 303);
  }
}

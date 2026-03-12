// ─────────────────────────────────────────────────────────
//  F2K IMMO PLUS — Service Worker v2
//  Compatible GitHub Pages (f2k229.github.io)
// ─────────────────────────────────────────────────────────

const CACHE_NAME   = 'f2k-immo-v2';

// Fichiers à précacher — chemins RELATIFS pour GitHub Pages
const PRECACHE = [
  './',
  './index.html',
  './offline.html',
  './manifest.json'
];

// ── INSTALL ───────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => Promise.allSettled(
        PRECACHE.map(url =>
          cache.add(url).catch(e => console.warn('[SW] Cache miss:', url, e))
        )
      ))
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVATE ──────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── FETCH ─────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Ne PAS intercepter Firebase / Google APIs / Fonts
  const bypass = [
    'firebaseio.com','firestore.googleapis.com',
    'firebase.googleapis.com','identitytoolkit.googleapis.com',
    'firebasestorage.googleapis.com','gstatic.com',
    'fonts.googleapis.com','fonts.gstatic.com'
  ];
  if (bypass.some(h => url.hostname.includes(h))) return;

  // Navigation HTML → Network First
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          return res;
        })
        .catch(() =>
          caches.match(event.request)
            .then(cached => cached || caches.match('./offline.html'))
        )
    );
    return;
  }

  // Assets → Cache First
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(res => {
        if (!res || res.status !== 200 || res.type === 'opaque') return res;
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        return res;
      }).catch(() => {
        if (event.request.destination === 'image')
          return caches.match('./icons/icon-192x192.png');
      });
    })
  );
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

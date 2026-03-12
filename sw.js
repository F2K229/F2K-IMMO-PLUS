// ─────────────────────────────────────────────────────────
//  F2K IMMO PLUS — Service Worker
//  Version : 1.0.0
// ─────────────────────────────────────────────────────────

const CACHE_NAME    = 'f2k-immo-v1';
const OFFLINE_PAGE  = '/offline.html';

// Fichiers à mettre en cache dès l'installation
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  // Fonts Google (optionnel — elles seront aussi mises en cache à la volée)
  'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700;900&family=DM+Sans:wght@300;400;500;600&display=swap'
];

// ── INSTALL ───────────────────────────────────────────────
// Met en cache les ressources essentielles au démarrage
self.addEventListener('install', (event) => {
  console.log('[SW] Installation...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Mise en cache des ressources essentielles');
      // On utilise addAll avec gestion d'erreur pour ne pas bloquer si une ressource échoue
      return Promise.allSettled(
        PRECACHE_ASSETS.map(url =>
          cache.add(url).catch(err => console.warn('[SW] Impossible de mettre en cache :', url, err))
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE ──────────────────────────────────────────────
// Supprime les anciens caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activation...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => {
            console.log('[SW] Suppression ancien cache :', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// ── FETCH ─────────────────────────────────────────────────
// Stratégie : Network First pour les API Firebase, Cache First pour les assets statiques
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // ── Ne pas intercepter les requêtes Firebase / Google APIs
  if (
    url.hostname.includes('firebaseio.com')     ||
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('firebase.googleapis.com')  ||
    url.hostname.includes('identitytoolkit.googleapis.com') ||
    url.hostname.includes('firebasestorage.googleapis.com') ||
    url.hostname.includes('gstatic.com')
  ) {
    return; // Laisser passer sans interception
  }

  // ── Stratégie pour les pages HTML : Network First
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Mettre en cache la réponse fraîche
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => {
          // Pas de réseau → servir depuis le cache ou la page offline
          return caches.match(event.request)
            .then(cached => cached || caches.match(OFFLINE_PAGE));
        })
    );
    return;
  }

  // ── Stratégie pour les assets statiques : Cache First puis Network
  if (
    event.request.destination === 'style'  ||
    event.request.destination === 'script' ||
    event.request.destination === 'font'   ||
    event.request.destination === 'image'
  ) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        }).catch(() => {
          // Pour les images, retourner une image de remplacement si disponible
          if (event.request.destination === 'image') {
            return caches.match('/icons/icon-192x192.png');
          }
        });
      })
    );
    return;
  }

  // ── Stratégie par défaut : Network avec fallback cache
  event.respondWith(
    fetch(event.request)
      .then(response => response)
      .catch(() => caches.match(event.request))
  );
});

// ── MESSAGE ───────────────────────────────────────────────
// Permet de forcer la mise à jour depuis la page
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

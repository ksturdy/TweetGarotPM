// Service Worker for Titan PM
// CACHE_NAME is rewritten at build time by scripts/version-sw.js so every
// production deploy invalidates the cache automatically. The literal token
// __BUILD_ID__ is the rewrite target — do not hand-edit it here.
const CACHE_NAME = 'titan-pm-__BUILD_ID__';
const urlsToCache = [
  '/',
  '/static/css/main.css',
  '/static/js/main.js'
];

// Install Service Worker
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  // Skip waiting to activate immediately
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching files');
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.log('Service Worker: Cache error', error);
      })
  );
});

// Activate Service Worker
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Delete old caches
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Take control of all pages immediately
      return self.clients.claim();
    })
  );
});

// Fetch Strategy:
//   - Navigations / HTML  → network only, fall back to cached '/' offline.
//     We deliberately never cache HTML responses so a fresh deploy's index.html
//     (which references the new hashed bundles) is always served when online.
//   - Everything else (hashed JS/CSS/images) → network first, update cache,
//     fall back to cache when offline. Hashed filenames make this safe.
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle GETs; let the browser handle POST/PUT/etc directly.
  if (req.method !== 'GET') {
    return;
  }

  const isNavigation =
    req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html');

  if (isNavigation) {
    event.respondWith(
      fetch(req).catch(() => caches.match('/'))
    );
    return;
  }

  event.respondWith(
    fetch(req)
      .then((response) => {
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(req, responseToCache);
        });
        return response;
      })
      .catch(() => caches.match(req))
  );
});

// Listen for messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

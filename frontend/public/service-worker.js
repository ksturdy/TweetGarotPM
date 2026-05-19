// Tombstone service worker.
//
// A previous service worker version was causing problems during Render
// deploys (broken precache list referenced unhashed bundle filenames,
// which caused install to fail and the old cache to be wiped on every
// activate). This file replaces it with a no-op SW that unregisters
// itself and clears all caches.
//
// Do NOT delete this file. Existing users still have the old SW
// installed and will only see this replacement when their browser
// checks /service-worker.js for updates. Once they've run it once,
// they're back to a normal (no-SW) state.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach((client) => {
        if ('navigate' in client) {
          client.navigate(client.url);
        }
      });
    })()
  );
});

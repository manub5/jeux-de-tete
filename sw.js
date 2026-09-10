// sw.js
// Cache-first service worker.
//
// CACHE_VERSION MUST be bumped on every deployment. Forgetting it is the
// classic failure of this kind of app: the old files are served forever and
// nobody understands why nothing changes.
const CACHE_VERSION = 'v3';
const CACHE_PREFIX = 'jeux-de-tete-';
const CACHE_NAME = `${CACHE_PREFIX}${CACHE_VERSION}`;

const ASSETS = [
  './',
  'core/rng.js',
  'core/router.js',
  'core/stats.js',
  'core/storage.js',
  'core/ui.js',
  'core/update.js',
  'css/anagrammes.css',
  'css/base.css',
  'css/mot-le-plus-long.css',
  'css/tous-les-mots.css',
  'data/frequences.txt.gz',
  'data/signatures.txt.gz',
  'games/anagrammes/game.js',
  'games/anagrammes/pick.js',
  'games/anagrammes/scramble.js',
  'games/anagrammes/screen.js',
  'games/index.js',
  'games/mot-le-plus-long/draw.js',
  'games/mot-le-plus-long/game.js',
  'games/mot-le-plus-long/screen.js',
  'games/tous-les-mots/draw.js',
  'games/tous-les-mots/game.js',
  'games/tous-les-mots/screen.js',
  'icons/icone-192.png',
  'icons/icone-512.png',
  'icons/icone-maskable-512.png',
  'index.html',
  'lexicon/lexicon.js',
  'lexicon/loader.js',
  'lexicon/signature.js',
  'lexicon/solver.js',
  'main.js',
  'manifest.webmanifest',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      // Only this app's own caches. Filtering on "not the current name" would
      // delete anything else that ever cached something on this origin.
      await Promise.all(
        names
          .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(request, response.clone());
        }
        return response;
      } catch (error) {
        // Offline and never seen: let the page show its own message.
        const fallback = await caches.match('index.html');
        if (fallback && request.mode === 'navigate') return fallback;
        throw error;
      }
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'passer-a-la-nouvelle-version') self.skipWaiting();
});

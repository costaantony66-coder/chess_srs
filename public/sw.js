/* Service worker de Chess SRS : usage hors ligne. L'identifiant de build ci-dessous est renouvelé à chaque build. */
const CACHE = 'chess-srs-__BUILD_ID__';
const SCOPE = new URL(self.registration.scope);

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

// La page envoie la liste des fichiers qu'elle a déjà chargés : on les garde pour le mode hors ligne.
self.addEventListener('message', (event) => {
  if (event.data?.type !== 'CACHE_URLS') return;
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all(
        event.data.urls
          .filter((u) => new URL(u).origin === self.location.origin)
          .map((u) => cache.add(u).catch(() => undefined)),
      ),
    ),
  );
});

async function put(request, response) {
  if (response.ok) (await caches.open(CACHE)).put(request, response.clone());
  return response;
}

// Pages : réseau d'abord (nouvelle version dès que possible), cache en secours.
async function networkFirst(request) {
  try {
    return await put(request, await fetch(request));
  } catch {
    return (await caches.match(request)) || (await caches.match(SCOPE.href)) || (await caches.match(new URL('index.html', SCOPE).href)) || Response.error();
  }
}

// Fichiers à nom unique (assets, moteur) : cache d'abord.
async function cacheFirst(request) {
  return (await caches.match(request)) || put(request, await fetch(request));
}

// Le reste (puzzles, icônes…) : on sert le cache et on le rafraîchit en arrière-plan.
async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const network = fetch(request).then((r) => put(request, r)).catch(() => undefined);
  return cached || (await network) || Response.error();
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') event.respondWith(networkFirst(request));
  else if (url.pathname.includes('/assets/') || url.pathname.includes('/stockfish/')) event.respondWith(cacheFirst(request));
  else event.respondWith(staleWhileRevalidate(request));
});

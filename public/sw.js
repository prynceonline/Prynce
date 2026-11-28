const APP_BASE = new URL('/Prynce/', self.location.origin).pathname;
const CACHE_PREFIX = 'active-shell-';
const CACHE = `${CACHE_PREFIX}v2`;
const CORE = [
  APP_BASE,
  `${APP_BASE}manifest.webmanifest`,
  `${APP_BASE}active-icon.svg`
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(CORE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(APP_BASE)) return;

  event.respondWith(
    fetch(request).then(response => {
      if (response && response.ok) {
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE).then(cache => cache.put(request, copy)));
      }
      return response;
    }).catch(() =>
      caches.open(CACHE).then(cache =>
        cache.match(request).then(cached => cached || cache.match(APP_BASE))
      )
    )
  );
});

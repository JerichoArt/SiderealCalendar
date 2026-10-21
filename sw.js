// Network first, so updates arrive as soon as you are online; the cache is the offline fallback.
// Bump the version number whenever you want installed copies to drop their old files.
const CACHE_NAME = 'sidereal-calendar-v2';
const ASSETS = [
  './',
  'index.html',
  'calendar.js',
  'calendar.css',
  'rooms.js',
  'sidereal-core.js',
  'manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

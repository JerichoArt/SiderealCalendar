const CACHE_NAME = 'sidereal-calendar-v1';
const urlsToCache = [
  '/',
  '/index.html', // Assuming you'll rename index 4.html to index.html
  '/manifest.json',
  '/sw.js',
  // Add paths to your icons here once created, e.g.:
  // '/icons/icon-192x192.png',
  // '/icons/icon-512x512.png',
  // Note: External CDN resources like Tailwind CSS are generally not cached by your service worker.
];
 
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        // No cache hit - fetch from network
        return fetch(event.request);
      })
  );
});

self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            // Delete old caches
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

const CACHE_NAME = 'sidereal-calendar-v1';
const urlsToCache = [
  './', // Caches the root (index.html)
  'index.html',
  'manifest.json',
  'sw.js',
  'https://cdn.tailwindcss.com', // Caches Tailwind CSS
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap', // Caches Google Fonts CSS
  'https://fonts.gstatic.com/s/inter/v13/UcC73FwrK3iLTeHuS_fvQtMwCp50KnMwwnxmr-Ew.woff2', // Example: Caches a specific Inter font file (adjust if needed)
  'icon-192x192.png', // Caches your icons
  'icon-512x512.png'   // Caches your icons
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
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

const CACHE_NAME = 'faith-journal-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/favicon-32.png',
  '/favicon-16.png',
  '/apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Modified fetch handler: bypass cache for Supabase requests
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  // If the request is to Supabase, always go to network (no cache)
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(fetch(event.request));
    return;
  }
  // Otherwise, try cache first, fallback to network
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});

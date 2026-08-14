/* Faith Journal service worker — cache-first assets with offline navigation fallback. */
const VERSION = 'faith-journal-v3';
const STATIC_CACHE = `${VERSION}-static`;
const RUNTIME_CACHE = `${VERSION}-runtime`;

const REMOTE_ASSETS = [
  'https://raw.githubusercontent.com/websolutionsza/Faith-Journal/refs/heads/main/WhatsApp%20Image%202026-06-19%20at%2010.59.51.png',
  'https://raw.githubusercontent.com/websolutionsza/Faith-Journal/refs/heads/main/1.%20Hero%20Banner%20(Home%20Screen).png',
  'https://raw.githubusercontent.com/websolutionsza/Faith-Journal/refs/heads/main/2.%20journal%20header%20image.png',
  'https://raw.githubusercontent.com/websolutionsza/Faith-Journal/refs/heads/main/3.%20prayer%20header.png',
  'https://raw.githubusercontent.com/websolutionsza/Faith-Journal/refs/heads/main/4.%20reflection%20header.png',
  'https://raw.githubusercontent.com/websolutionsza/Faith-Journal/refs/heads/main/5.%20Daily%20check%20in%20header.png',
  'https://raw.githubusercontent.com/websolutionsza/Faith-Journal/refs/heads/main/6.%20empty%20slate%20illustration.png',
  'https://cdn.jsdelivr.net/npm/lucide@0.344.0/dist/umd/lucide.min.js'
];

const localAsset = (path) => new URL(path, self.registration.scope).href;
const LOCAL_ASSETS = [
  localAsset('./'),
  localAsset('./index.html'),
  localAsset('./manifest.json'),
  localAsset('./sw.js')
];

async function cacheOne(cache, url) {
  try {
    const isCrossOrigin = new URL(url).origin !== self.location.origin;
    const request = new Request(url, {
      cache: 'no-cache',
      credentials: 'omit',
      mode: isCrossOrigin ? 'no-cors' : 'same-origin'
    });
    const response = await fetch(request);
    if (response.ok || response.type === 'opaque') {
      await cache.put(request, response.clone());
    }
  } catch (error) {
    // A single optional asset must not make installation fail.
    console.warn('[Faith Journal SW] Could not precache:', url, error);
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    await Promise.all([...LOCAL_ASSETS, ...REMOTE_ASSETS].map((url) => cacheOne(cache, url)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keep = new Set([STATIC_CACHE, RUNTIME_CACHE]);
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => !keep.has(key)).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    return (await caches.match(request)) ||
      (await caches.match(localAsset('./index.html'))) ||
      new Response('Faith Journal is offline.', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request, { ignoreVary: true });
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok || response.type === 'opaque') {
      const cache = await caches.open(RUNTIME_CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    return Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  const isImage = request.destination === 'image' || /\.(png|jpe?g|gif|webp|svg|avif)(\?|$)/i.test(url.pathname);
  const isStatic = ['style', 'script', 'font', 'manifest'].includes(request.destination) || isImage;
  if (isStatic || url.origin !== self.location.origin) {
    event.respondWith(cacheFirst(request));
  }
});

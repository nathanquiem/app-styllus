// Service Worker — Styllus Nego D'hora
// Strategy: Cache First for static assets, Network First for API calls

const CACHE_NAME = 'styllus-v1';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/android-chrome-192x192.png',
  '/android-chrome-512x512.png',
  '/apple-touch-icon.png',
];

// Install: pre-cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch: Network First for API/Supabase, Cache First for static
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests and browser extensions
  if (request.method !== 'GET' || url.protocol === 'chrome-extension:') return;

  // Network First: Supabase API calls and Next.js data fetching
  if (
    url.hostname.includes('supabase.co') ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/_next/data/')
  ) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
    return;
  }

  // Cache First: static assets (_next/static, images, icons)
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/android-chrome') ||
    url.pathname.startsWith('/apple-touch') ||
    url.pathname.startsWith('/favicon') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.ico')
  ) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request))
    );
    return;
  }

  // Default: Network First with cache fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache valid responses
        if (response && response.status === 200) {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});

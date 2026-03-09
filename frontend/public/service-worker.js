// HashThis Service Worker — v1
// Provides offline shell caching and background sync for pending verifications.

const CACHE_NAME    = 'hashthis-v1';
const OFFLINE_URL   = '/offline.html';

// App shell assets to pre-cache on install
const PRECACHE_URLS = [
  '/',
  '/offline.html',
  '/manifest.json',
];

// ── Install ───────────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch(() => {
        // Non-fatal — some assets may not exist yet during dev
      });
    }).then(() => self.skipWaiting())
  );
});

// ── Activate ──────────────────────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch strategy ────────────────────────────────────────────────────────────
// - API requests:    Network-first, no caching (blockchain data must be fresh)
// - Static assets:   Cache-first with network fallback
// - Navigation:      Network-first; fall back to cached index or offline page

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Never intercept cross-origin requests or non-GET requests
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // API calls — always go to network
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/hashes/')) {
    event.respondWith(fetch(request).catch(() => new Response(
      JSON.stringify({ error: 'You appear to be offline.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    )));
    return;
  }

  // Navigation requests — network first, fall back to index (SPA), then offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match('/');
          return cached ?? (await caches.match(OFFLINE_URL)) ?? new Response(
            '<h1>Offline</h1><p>HashThis requires an internet connection.</p>',
            { headers: { 'Content-Type': 'text/html' } }
          );
        })
    );
    return;
  }

  // Static assets — cache first
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (!response.ok) return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        return response;
      });
    })
  );
});

// ── Background sync ───────────────────────────────────────────────────────────
// Re-attempts pending verifications queued while offline.

self.addEventListener('sync', (event) => {
  if (event.tag === 'verify-sync') {
    event.waitUntil(processPendingVerifications());
  }
});

async function processPendingVerifications() {
  try {
    const cache   = await caches.open('hashthis-pending');
    const keys    = await cache.keys();
    const clients = await self.clients.matchAll({ type: 'window' });

    for (const key of keys) {
      const stored = await cache.match(key);
      if (!stored) continue;
      const payload = await stored.json();

      // Notify open tabs that sync is available
      clients.forEach((client) => {
        client.postMessage({ type: 'SYNC_READY', payload });
      });

      await cache.delete(key);
    }
  } catch {
    // Sync failed — will retry on next connectivity event
  }
}

// ── Push notifications ────────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try { data = event.data.json(); }
  catch { return; }

  const title   = data.title   ?? 'HashThis';
  const options = {
    body:    data.body    ?? 'Your proof has been confirmed.',
    icon:    '/icon-192.png',
    badge:   '/icon-192.png',
    tag:     data.tag     ?? 'proof-confirmed',
    data:    { url: data.url ?? '/' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      const existing = clients.find((c) => c.url === url);
      if (existing) return existing.focus();
      return self.clients.openWindow(url);
    })
  );
});
// CityCells Service Worker
// WHY: Enable offline support per ADR 014 and TICKET-006.
// Precaches critical assets; caches map tiles and app resources on first use.

const CACHE_VERSION = 'v1';
const PRECACHE_NAME = `citycells-precache-${CACHE_VERSION}`;
const RUNTIME_CACHE_NAME = `citycells-runtime-${CACHE_VERSION}`;
const TILE_CACHE_NAME = `citycells-tiles-${CACHE_VERSION}`;

// WHY: Precache critical static assets that we control.
// App JS/CSS are hashed by Next.js, so we cache them on first visit instead.
const PRECACHE_URLS = [
  '/data/malmo_delomraden.geojson',
  '/sql-wasm/sql-wasm.wasm',
];

// WHY: Max tile cache entries to prevent unbounded storage growth (ADR 014).
const MAX_TILE_ENTRIES = 500;

// Install event: precache critical assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(PRECACHE_NAME).then((cache) => {
      console.log('[SW] Precaching critical assets');
      return cache.addAll(PRECACHE_URLS);
    }).then(() => {
      // WHY: Skip waiting to activate immediately (new SW takes over).
      return self.skipWaiting();
    })
  );
});

// Activate event: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => {
            // Delete old versioned caches
            return (
              name.startsWith('citycells-') &&
              name !== PRECACHE_NAME &&
              name !== RUNTIME_CACHE_NAME &&
              name !== TILE_CACHE_NAME
            );
          })
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      // WHY: Claim clients immediately so the SW controls the page without reload.
      return self.clients.claim();
    })
  );
});

// Fetch event: serve from cache or network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // WHY: Only handle GET requests; let other methods pass through.
  if (request.method !== 'GET') {
    return;
  }

  // WHY: Handle OpenStreetMap tiles with cache-on-use strategy.
  if (url.hostname.endsWith('.tile.openstreetmap.org')) {
    event.respondWith(handleTileRequest(request));
    return;
  }

  // WHY: Handle same-origin requests (app shell, API, static assets).
  if (url.origin === self.location.origin) {
    event.respondWith(handleAppRequest(request, url));
    return;
  }

  // WHY: For other cross-origin requests, just fetch from network.
  // (e.g., external CDNs for Leaflet marker icons)
});

/**
 * Handle map tile requests with stale-while-revalidate strategy.
 * WHY: Tiles are large and numerous; cache on use for offline viewing.
 */
async function handleTileRequest(request) {
  const cache = await caches.open(TILE_CACHE_NAME);
  const cachedResponse = await cache.match(request);

  // WHY: Stale-while-revalidate: return cached immediately, update in background.
  const fetchPromise = fetch(request)
    .then(async (networkResponse) => {
      if (networkResponse.ok) {
        // Clone before caching since response can only be consumed once
        await cache.put(request, networkResponse.clone());
        // WHY: Prune old tiles if cache exceeds limit.
        await pruneTileCache(cache);
      }
      return networkResponse;
    })
    .catch(() => {
      // Network failed, will use cached response if available
      return null;
    });

  // Return cached response immediately if available, else wait for network
  if (cachedResponse) {
    // Update cache in background (void suppresses unused expression warning)
    void fetchPromise;
    return cachedResponse;
  }

  // No cache, wait for network
  const networkResponse = await fetchPromise;
  if (networkResponse) {
    return networkResponse;
  }

  // Both cache and network failed
  return new Response('Tile not available offline', { status: 503 });
}

/**
 * Handle app requests (HTML, JS, CSS, API, static files).
 * WHY: Cache-first for static assets; network-first for API and navigation.
 */
async function handleAppRequest(request, url) {
  // WHY: API routes should not be cached (they return user-specific data).
  if (url.pathname.startsWith('/api/')) {
    return fetch(request).catch(() => {
      return new Response(JSON.stringify({ error: 'Offline' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    });
  }

  // WHY: Precached assets (GeoJSON, WASM) - serve from precache first.
  if (PRECACHE_URLS.includes(url.pathname)) {
    const precache = await caches.open(PRECACHE_NAME);
    const cachedResponse = await precache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
  }

  // WHY: For navigation requests (HTML pages), use network-first with cache fallback.
  // This ensures users get the latest app version when online.
  if (request.mode === 'navigate') {
    return handleNavigationRequest(request);
  }

  // WHY: For static assets (JS, CSS, images), use cache-first with network fallback.
  // Next.js hashes these files, so cached versions are safe to serve.
  return handleStaticAssetRequest(request);
}

/**
 * Handle navigation (HTML page) requests.
 * WHY: Network-first ensures fresh content; cache fallback enables offline.
 */
async function handleNavigationRequest(request) {
  const cache = await caches.open(RUNTIME_CACHE_NAME);

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      // Cache successful navigation responses
      await cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    // Network failed, try cache
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Try to serve the root page as fallback for client-side routing
    const rootResponse = await cache.match('/');
    if (rootResponse) {
      return rootResponse;
    }

    return new Response('App not available offline. Please connect to the internet.', {
      status: 503,
      headers: { 'Content-Type': 'text/html' },
    });
  }
}

/**
 * Handle static asset requests (JS, CSS, images, etc.).
 * WHY: Cache-first since hashed assets don't change.
 */
async function handleStaticAssetRequest(request) {
  const cache = await caches.open(RUNTIME_CACHE_NAME);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      // Cache successful responses
      await cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    return new Response('Asset not available offline', { status: 503 });
  }
}

/**
 * Prune tile cache to stay under MAX_TILE_ENTRIES.
 * WHY: Prevent unbounded storage growth per ADR 014.
 */
async function pruneTileCache(cache) {
  const keys = await cache.keys();
  if (keys.length > MAX_TILE_ENTRIES) {
    // WHY: Delete oldest entries (FIFO). Cache API doesn't track age,
    // so we just delete from the start of the keys array.
    const deleteCount = keys.length - MAX_TILE_ENTRIES;
    const keysToDelete = keys.slice(0, deleteCount);
    await Promise.all(keysToDelete.map((key) => cache.delete(key)));
    console.log(`[SW] Pruned ${deleteCount} tiles from cache`);
  }
}

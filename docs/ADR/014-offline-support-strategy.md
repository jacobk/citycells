# ADR 014: Offline Support Strategy

**Date:** 2026-02-07
**Status:** Accepted

## Context

Users want the CityCells app to work well without an internet connection. Typical scenarios include checking progress or planning walks in areas with poor connectivity (e.g. in the field). The PRD already states a non-functional requirement: "After initial sync, app should work offline (viewing progress, not syncing new walks)."

Current state:
- **User data** (progress, analyses, areas, walks) is already stored locally via SQLite + IndexedDB (ADR 004). Once loaded, this data does not require the network.
- **Map tiles** are loaded from OpenStreetMap over the network; without caching they fail when offline.
- **GeoJSON** (sub-area boundaries) is fetched from `/data/malmo_delomraden.geojson`; the DB also seeds from this file, so after first load area geometry can come from DB.
- **App shell** (HTML, JS, CSS, WASM) is served by Next.js; without a cache, the app may not load at all when offline.

We need a clear strategy for what is cached, how it is cached, and what behavior and UI we provide when the app is offline.

## Decision

We will implement **offline support** so that once the map, sub-areas, and user progress are loaded, the user can navigate the app and view area details without an internet connection.

### Scope: What Works Offline

| Capability | Offline behavior | Rationale |
|------------|------------------|-----------|
| App load | Supported | App shell and critical assets cached so the app can start. |
| Map view | Supported | Map tiles cached (see below); polygons from DB or cached GeoJSON. |
| Sub-area list | Supported | Data from SQLite (areas, completions). |
| Area details panel | Supported | All data from SQLite (analyses, walks, deviations). |
| Progress / stats | Supported | Data from SQLite. |
| Metrics documentation | Supported if cached | Static pages; include in precache or cache on first visit. |
| Strava sync / re-fetch | Unavailable | Requires network; show clear offline state and disable or hide. |
| External links (e.g. Strava activity) | Unavailable | No network; show link but indicate it will work when online. |

### Caching Strategy

1. **Service Worker**
   - Use a Service Worker (e.g. Next.js PWA support or Workbox) to:
     - Precache the app shell (HTML, JS, CSS, WASM) so the app loads offline.
     - Precache or cache critical static assets: GeoJSON (`/data/malmo_delomraden.geojson`), metrics docs if desired.
   - This ensures the app can start and load the SQLite/IndexedDB stack even when offline.

2. **Map tiles**
   - Cache map tiles in the Cache API (via Service Worker) when they are requested (cache-on-use).
   - Optionally limit cache size (e.g. by number of tiles or eviction policy) to avoid excessive storage.
   - Tiles for the Malmö region at typical zoom levels should be cached as the user explores; no requirement to precache the entire region.

3. **No change to SQLite/IndexedDB**
   - Persistence remains as in ADR 004. No schema or API changes required for offline; existing local data is already used when the app runs.

### Offline Detection and UX

- **Detection:** Use `navigator.onLine` and the `online` / `offline` events to track connectivity.
- **Indicator:** Show a subtle offline indicator (e.g. banner or icon) when the app is offline so the user understands why sync/links are unavailable.
- **Graceful degradation:** When offline, do not attempt Strava API calls; disable or hide "Sync" / "Re-fetch" actions; allow all read-only navigation (map, list, area details, progress). External links can remain visible with a note that they require connectivity.

### Out of Scope (MVP)

- Preloading the full Malmö tile set.
- Offline-first write queue (e.g. queuing exemptions to sync later); MVP is read-only offline.
- Background sync when coming back online (future improvement).

## Consequences

### Positive

- Users can open the app and use it for navigation and progress review without connectivity.
- Aligns with mobile-first, "use in the field" usage.
- Builds on existing local storage (ADR 004) without duplicating data model.

### Negative

- Service Worker and tile caching add complexity and require testing (cache invalidation, storage limits).
- Map may show blank or partial tiles in never-visited areas when offline.

### Technical

- Next.js app must integrate a Service Worker (e.g. `next-pwa` or custom Workbox config).
- Map component or tile layer should request tiles in a way the SW can cache (same-origin or configured for OSM).
- Offline state (and optionally cache readiness) may need to be exposed to the UI (e.g. React context or hook).

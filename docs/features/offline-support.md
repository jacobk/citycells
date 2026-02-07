# Offline Support

## Overview

Offline support allows the CityCells app to work without an internet connection once the user has loaded the map, sub-areas, and their progress at least once. Users can navigate the app, view the map, open the sub-area list, open area details, and view progress and stats when offline—e.g. in the field or in areas with poor connectivity. Sync and external links (e.g. Strava) are unavailable offline and are indicated as such.

This feature builds on existing local storage (ADR 004): progress and analyses are already stored in SQLite/IndexedDB. The main additions are caching the app shell and map tiles via a Service Worker, plus offline detection and UX (indicator, graceful degradation).

## User Stories

From [PRD 001](../PRD/001-mvp-mobile-walker.md) section 2 (Offline Support Stories):

- "As a user, I want the app to work well offline so I can check my progress and plan walks when I have no connection (e.g. in the field)."
- "As a user, I want to open the app when offline (after I have used it at least once) so I can view the map, sub-areas, and my progress without internet."
- "As a user, I want to navigate the app and view area details when offline, so I can browse which areas I have completed and their scores without connectivity."
- "As a user, I want a clear indication when I am offline so I understand why syncing or external links are unavailable."

## Implementation

### Key Files

| File | Purpose |
|------|---------|
| `public/sw.js` | Service Worker with precache (GeoJSON, WASM) and runtime cache for tiles and app assets |
| `src/components/ServiceWorkerRegistration/` | Client component that registers the SW on mount |
| `src/hooks/useOnlineStatus.ts` | Hook exposing `isOnline` via `navigator.onLine` + online/offline events |
| `src/components/OfflineIndicator/` | Banner shown at top of viewport when offline |
| `src/components/ProfileCard/ProfileCard.tsx` | Re-analyze buttons disabled when offline |
| `src/components/AreaDetailsPanel/AreaDetailsPanel.tsx` | Per-walk re-analyze menu hidden when offline |
| `src/app/layout.tsx` | Mounts ServiceWorkerRegistration and OfflineIndicator |
| `src/lib/db.ts` | Existing; area/analysis data already local (no change required for offline read) |

### Data Flow

- **App load offline:** Service Worker serves cached app shell (HTML, JS, CSS, WASM). App initializes; database restores from IndexedDB. Map requests tiles from cache when available.
- **Navigation:** All list and detail data comes from SQLite; no network required.
- **Map tiles:** Fetched via same-origin or SW-intercepted requests; cached on first use (stale-while-revalidate strategy); served from cache when offline.

### Key Functions

- **`public/sw.js`:** `install` event precaches `/data/malmo_delomraden.geojson` and `/sql-wasm/sql-wasm.wasm`. `fetch` event intercepts requests: OSM tiles use stale-while-revalidate with a 500-tile cache limit; app assets use cache-first; navigation uses network-first with cache fallback; API routes are not cached (return 503 offline).
- **`useOnlineStatus()`:** Uses `useSyncExternalStore` to subscribe to `online`/`offline` window events; returns `{ isOnline: boolean }`.
- **`OfflineIndicator`:** Renders a fixed amber banner "You're offline — viewing cached data" when `!isOnline`; hidden when online.
- **Graceful degradation:** `ProfileCard` disables "Re-score All" and "Full Re-fetch" buttons and shows "Offline — re-analysis unavailable" message when offline. `AreaDetailsPanel` hides the per-walk re-analyze menu when offline.

## Rationale

### Design Decisions

- **Cache-on-use for tiles:** Precache only the app shell and critical static assets; cache map tiles as the user views them. This keeps storage and build complexity manageable while still enabling offline use for areas the user has already viewed.
- **Read-only offline:** MVP does not queue writes (e.g. exemptions) for later sync; offline is for viewing only. Sync and re-fetch require network.
- **Offline indicator:** Users need to know why sync or external links do not work; a clear indicator avoids confusion.

### ADR References

- [ADR 014: Offline Support Strategy](../ADR/014-offline-support-strategy.md) — Scope (what works offline), caching strategy (Service Worker, map tiles), offline detection and UX, out-of-scope items.
- [ADR 004: SQLite Storage](../ADR/004-sqlite-storage.md) — Local data (progress, areas, analyses) is already persisted; offline support uses this without schema changes.

## Current Limitations

1. Map may show blank or partial tiles in regions the user has never viewed while online.
2. No background sync when connectivity returns; user must trigger sync manually.
3. No offline write queue (e.g. exemptions created offline and synced later).

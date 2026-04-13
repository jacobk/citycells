# ADR 026: IndexedDB Storage (Replacing sql.js)

**Date:** 2026-04-13
**Status:** Accepted
**Supersedes:** ADR 004 (SQLite Storage Architecture)

## Context

ADR 004 introduced sql.js (SQLite compiled to WebAssembly) for browser-side persistence. This worked but caused a critical issue: **the app freezes on iPhone**.

Root cause: sql.js runs synchronous WASM queries on the main thread. The `loadCachedAnalyses()` function executes a 4-table JOIN with GROUP_CONCAT through WASM, blocking the main thread for hundreds of milliseconds on mobile Safari. Additionally:

- The ~1MB WASM binary must load on every page visit
- Every write serializes the entire SQLite database to a blob and writes it to IndexedDB (`persistDatabase()`)
- sql.js offers no async query API — every `db.exec()` blocks until completion

Structured debugging with a feature toggle panel confirmed that enabling the "Cached Analysis" feature (which calls `loadCachedAnalyses`) is the exact trigger for the freeze.

## Decision

Replace sql.js entirely with **native IndexedDB**, using a thin (~150 line) Promise wrapper with zero external dependencies.

IndexedDB is:
- Already the actual backing store (sql.js persisted to IndexedDB as a blob)
- Fully asynchronous by design — cannot freeze the main thread
- Built into every browser since 2012
- Zero dependency cost (no WASM, no npm package)

## Data Model

Seven IndexedDB object stores replace the SQL tables:

| Store | Key | Indexes | Notes |
|-------|-----|---------|-------|
| `users` | `stravaId` | — | Single user per device |
| `walks` | `stravaActivityId` | `userId` | Walk metadata, polyline |
| `walkStreams` | `stravaActivityId` | — | GPS data separated from walks for query performance |
| `walkAnalyses` | auto-increment `id` | `walkId`, `areaFid`, `[walkId, areaFid]` (unique) | Analysis metrics per walk-area pair |
| `deviations` | auto-increment `id` | `walkAnalysisId` | Boundary deviations |
| `areaCompletions` | `areaFid` | `userId` | Denormalized: embeds display metrics, activityIds, polylines |
| `userAchievements` | `[userId, achievementId]` | `userId` | Achievement unlock records |

**Dropped tables:**
- `areas` — FID used as natural key everywhere. Geometry/perimeter/area computed from GeoJSON at runtime (already done in `buildAreaDetailMap()`).
- `achievements` — static definitions already in `src/lib/achievements.ts` as JS constants.
- `schema_version` — IndexedDB has built-in versioning via `onupgradeneeded`.

**Key simplification:** The `areaCompletions` store is denormalized to contain all data needed for `loadCachedAnalyses()`. This reduces the hot path from a 4-table SQL JOIN to a single IndexedDB index scan.

## Consequences

### Positive
- No more iPhone freeze — all operations are async
- 1MB+ smaller payload (no WASM binary)
- Faster startup (no WASM init, no blob deserialization)
- Granular writes (save one record, not the entire database)
- Zero runtime dependencies for storage
- Simpler `next.config.ts` (remove WASM headers, fs/path fallbacks)

### Negative
- No ad-hoc SQL queries (JOINs, GROUP BY must be done in JS)
- No foreign key enforcement (managed in application code — same as before, sql.js didn't enforce FKs by default)
- Export format changes from SQLite binary to JSON

### Migration
Big bang: existing sql.js data is discarded. User re-syncs from Strava. On first load, if old `citycells-db` IndexedDB exists, it is deleted.

## Key Files
- `src/lib/idb.ts` — IndexedDB wrapper, schema, Promise helpers
- `src/lib/db.ts` — rewritten, all exports async
- `src/lib/analysis-persistence.ts` — rewritten, async IDB queries
- `src/lib/exemptions.ts` — rewritten, async IDB queries

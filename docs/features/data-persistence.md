# Data Persistence

*Updated: 2026-04-13*

## Overview

CityCells uses native IndexedDB for all browser-side storage. All user data remains on the device with zero external dependencies for persistence. See [ADR 026](../ADR/026-indexeddb-storage.md) for the migration rationale (replaced sql.js/WASM).

## User Stories

From [PRD 001](../PRD/001-mvp-mobile-walker.md) section 3.8:
- "All data stored locally in browser using IndexedDB"
- "Data persists across sessions"
- "Analysis results cached—no re-analysis on page reload"
- "Export database feature for backup (JSON format)"
- "Import database feature to restore from backup"

## Implementation

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/idb.ts` | IndexedDB wrapper: schema, Promise helpers, store definitions (~220 lines, zero dependencies) |
| `src/lib/db.ts` | Core database module: async init, queries, user/walk CRUD |
| `src/lib/analysis-persistence.ts` | Functions for saving/loading analysis results (async IDB) |
| `src/lib/exemptions.ts` | Exemption CRUD (async IDB) |
| `src/hooks/useDatabase.ts` | React hook for database access with loading states |

### Technology Stack

**IndexedDB**: Native browser storage API. Fully asynchronous — cannot freeze the main thread. Built into every browser since 2012. Zero dependency cost (no WASM, no npm package).

### Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser                               │
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   React UI   │───>│  useDatabase │───>│   db.ts      │  │
│  │              │<───│    Hook      │<───│   Module     │  │
│  └──────────────┘    └──────────────┘    └──────┬───────┘  │
│                                                  │          │
│                                          ┌──────▼───────┐  │
│                                          │   idb.ts     │  │
│                                          │  (wrapper)   │  │
│                                          └──────┬───────┘  │
│                                                  │          │
│                                          ┌──────▼───────┐  │
│                                          │  IndexedDB   │  │
│                                          │  (native)    │  │
│                                          └──────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Database Schema

See [ADR 026](../ADR/026-indexeddb-storage.md) for complete schema. Seven object stores:

| Store | Key | Purpose |
|-------|-----|---------|
| `users` | `stravaId` | Strava user info and tokens |
| `walks` | `stravaActivityId` | Synced Strava activities and polyline data |
| `walkStreams` | `stravaActivityId` | GPS stream data (separated for query performance) |
| `walkAnalyses` | auto `id` | Analysis results per walk-area pair |
| `deviations` | auto `id` | Detected obstacle avoidances |
| `areaCompletions` | `areaFid` | Denormalized completion status with display metrics |
| `userAchievements` | `[userId, achievementId]` | Achievement unlock records |

**Dropped from previous sql.js schema:**
- `areas` — FID used as natural key; geometry computed from GeoJSON at runtime
- `achievements` — static definitions in `src/lib/achievements.ts` as JS constants
- `schema_version` — IndexedDB has built-in versioning via `onupgradeneeded`

### Initialization Flow

1. **Open IndexedDB** - `idb.ts` opens the database, triggers `onupgradeneeded` if schema version changed
2. **Create stores** - On first load or version bump, object stores and indexes are created
3. **Ready** - All db.ts exports are async functions that use the initialized IDB connection

### Persistence Strategy

IndexedDB writes are natively granular — each put/delete operates on a single record without serializing the entire database.

```typescript
// Example: saving a walk analysis
async function saveWalkAnalysis(analysis: WalkAnalysis) {
  const db = await getDb();
  const tx = db.transaction(['walkAnalyses', 'areaCompletions'], 'readwrite');
  await tx.objectStore('walkAnalyses').put(analysis);
  await updateAreaCompletion(tx, analysis);
  await tx.done;
}
```

WHY: No more `persistDatabase()` pattern (which serialized the entire SQLite DB on every write). IndexedDB writes are granular, fast, and async — they cannot freeze the main thread.

### Analysis Result Persistence

Analysis results are automatically saved to the database after computation and loaded on subsequent page visits.

**Flow (implemented in `Map.tsx`):**
1. **Load Cached Results** - On page load, `loadCachedAnalyses()` retrieves existing analyses from database
2. **Immediate UI Update** - Cached tier colors and progress are displayed instantly (no "Analyzing paths..." delay)
3. **Identify New Activities** - `getActivitiesToAnalyze()` compares current Strava activities with analyzed ones
4. **Analyze Only New** - Only run analysis for activities not yet in database
5. **Save Results** - `saveWalkAnalysis()` stores results, deviations, and updates area_completions
6. **Merge & Display** - New results are merged with cached data for final UI state

**Key Functions (in `analysis-persistence.ts`):**
- `saveWalkAnalysis()` - Saves full analysis result including deviations
  - Stores both `raw_quality_score` (original) and `quality_score` (adjusted with exemptions)
  - Selects best walk per area using adjusted scores
- `loadCachedAnalyses()` - Loads cached results via single IndexedDB index scan on `areaCompletions` store
  - **WHY:** The `areaCompletions` store is denormalized to contain all display data, replacing the old 4-table SQL JOIN
  - Ensures displayed scores match tiers calculated with exemptions applied
  - Prevents score instability across page reloads
- `getActivitiesToAnalyze()` - Identifies which activities need analysis
- `getOrCreateUserId()` - Maps Strava user ID to internal database ID

**WHY:** Analysis computation is expensive (geospatial calculations). Caching results means:
- Fast page loads (no re-computation)
- Only analyze new activities
- Persist across browser sessions
- Support offline viewing of progress

**Score Consistency:** The system stores both `raw_quality_score` (original) and `quality_score` (adjusted with exemptions). When loading cached results, `quality_score` is preferred to ensure displayed scores and tiers match what users see after applying exemptions. This prevents scores from jumping between tiers on rebuild.

**Re-Analysis:** Cached analysis results can be invalidated and recomputed via the [Re-Analysis](../features/re-analysis.md) feature. Users can trigger re-score only (re-run algorithm on existing GPS cache) or full re-analyze (re-fetch streams then re-score). See [ADR 011](../ADR/011-re-analysis-strategy.md).

### Stream Data Caching (ADR 006)

High-fidelity GPS streams are cached in a dedicated `walkStreams` IndexedDB store (keyed by `stravaActivityId`) to avoid repeated Strava API calls.

**Store fields:**
- Stream payload (`latlng`, `time`, `distance`)
- `streamsFetchedAt` - ISO timestamp when streams were fetched
- `streamPointCount` - Point count for diagnostics

**Flow:**
1. Fetch streams for a walk when needed for analysis.
2. Store streams in `walkStreams` store after analysis is persisted.
3. Reuse cached streams on subsequent sessions.

WHY: Streams are stored separately from `walks` for query performance — loading walk metadata does not require loading large GPS arrays.

### Export/Import

**Export**: Serialize all IndexedDB stores to a JSON file for user download.

**Import**: Load a JSON file, validate it's a CityCells export, replace current data.

WHY: Since data is browser-local, users need a way to backup and restore their progress. This also enables moving data between devices. The format changed from SQLite binary (`.db`) to JSON as part of the IndexedDB migration (ADR 026).

## Rationale

### Why IndexedDB over sql.js (WASM SQLite)?

From [ADR 026](../ADR/026-indexeddb-storage.md):

1. **No main-thread freeze**: sql.js ran synchronous WASM queries that froze iPhones; IndexedDB is natively async
2. **Zero dependencies**: No ~1MB WASM binary to download and initialize
3. **Granular writes**: Save one record instead of serializing the entire database
4. **Simpler config**: No WASM headers or fs/path fallbacks in `next.config.ts`

### Why Browser Storage over Server?

1. **Privacy**: User data never leaves their device
2. **Cost**: No server infrastructure for MVP
3. **Offline**: Works without internet after initial load
4. **Simplicity**: No auth complexity, no data sync issues

### Why Granular Persistence?

Each write operation saves only the affected records to IndexedDB:

1. **Data Safety**: User closes tab unexpectedly? Data saved.
2. **Simplicity**: No complex flush logic or timers
3. **Performance**: IndexedDB writes are fast (~1-5ms for small changes)
4. **No serialization overhead**: Unlike sql.js where every write serialized the entire database

### Magic Numbers

| Value | Meaning | Source |
|-------|---------|--------|
| `citycells-db` | IndexedDB database name | Chosen for clarity |
| `SCHEMA_VERSION = 2` | Schema migration version | Increment for migrations |

## Database Reset (Added: 2026-02-15, Implemented: 2026-02-15)

*Reference: [ADR 026](../ADR/026-indexeddb-storage.md)*

Users can clear all synced activities and analysis results to resolve data issues.

**Purpose:**
- Fix persistence bugs causing stale data or tier inconsistencies
- Clear corrupted data without manually clearing browser storage
- Start fresh while preserving authentication

**What is cleared:**
- All synced walks (`walks` store)
- All stream data (`walkStreams` store)
- All analysis results (`walkAnalyses`, `deviations`, `areaCompletions` stores)
- Sync timestamp (forces full re-sync on next load)

**What is preserved:**
- User authentication tokens (`users` store)

**UI Location:** Profile card (expanded) → "Clear All Data" button

### Implementation

**Key Files:**
- `src/lib/db.ts` - `clearUserData(userId)` function
- `src/components/ProfileCard/ProfileCard.tsx` - UI button with confirmation dialog
- `src/app/page.tsx` - `handleClearData()` handler

**Stores cleared:**
1. `deviations`
2. `walkAnalyses`
3. `areaCompletions`
4. `walkStreams`
5. `walks`

**User Flow:**
1. User clicks "Clear All Data" in expanded profile card
2. Confirmation dialog appears with warning about data loss
3. User confirms by clicking "Yes, Delete All"
4. Data is cleared and page reloads for fresh state

## Incremental Activity Sync (Added: 2026-02-15, Implemented: 2026-02-15)

*Reference: [ADR 004](../ADR/004-sqlite-storage.md) section "Incremental Activity Sync"*

To provide instant page loads for returning users, the app uses incremental sync instead of fetching all activities on every load.

**Problem Solved:**
- Previously, all 200 activities were fetched from Strava on every page load
- This caused slow "empty map → loading → display" experience
- Unnecessary API calls even when user has no new activities

**Solution:**
- Track last sync timestamp per user in `users` table
- Use Strava's `after` parameter to only fetch new activities
- Cache provides instant display, sync adds new data in background

**User Experience:**

| Scenario | Behavior |
|----------|----------|
| First visit | Full sync (all activities fetched and analyzed) |
| Return visit (no new) | Instant load from cache, quick API check returns 0 new |
| Return visit (new activities) | Instant cache display, then sync and analyze only new activities |
| Force refresh | User-triggered full re-sync (resets sync timestamp) |

### Implementation

**User store fields:**
- `lastActivitySyncAt` - ISO timestamp of last sync
- `lastSyncedActivityId` - Most recent synced activity

**Key Files:**
- `src/lib/db.ts` - `getLastSyncTimestamp()`, `updateLastSync()` (async IDB)
- `src/app/api/activities/route.ts` - Accepts `?after=<timestamp>` query param
- `src/hooks/useStrava.ts` - `fetchActivities(afterTimestamp?)` supports incremental fetch
- `src/components/ProfileCard/ProfileCard.tsx` - "Force Refresh All Activities" button
- `src/app/page.tsx` - `handleForceRefresh()` resets sync timestamp

**Sync Flow:**
1. Page loads → cached analyses displayed instantly
2. Check `lastActivitySyncAt` from `users` store
3. If exists: call API with `?after=<epoch_seconds>`
4. If null: full sync (first visit or after force refresh)
5. After successful fetch: update `lastActivitySyncAt`

**Force Refresh:**
- Button in expanded ProfileCard under "Sync Activities"
- Resets `lastActivitySyncAt` to epoch (1970-01-01)
- Triggers page reload for full re-sync

## Current Limitations

1. **No cross-device sync**: Data stays on one browser. Future: cloud storage option.

2. **No ad-hoc SQL**: JOINs and GROUP BY must be done in JavaScript (trade-off of dropping sql.js).

3. **Storage limits**: IndexedDB typically allows 50MB+, sufficient for this app.

4. **No automatic backup**: User must manually export. Consider periodic reminder.

## Known Issues (Updated: 2026-02-15)

*No critical known issues at this time.*

### Resolved Issues

1. **Potato tier persistence bug** (Fixed in TICKET-016): Scores < 0.50 but > 0 were saved with `tier = null` instead of `'potato'`. Areas would disappear after page refresh. **Fix:** Centralized tier assignment logic in `src/lib/tiers.ts` with `assignTier()` function that correctly handles all tiers including potato.

## Planned Improvements

1. **Automatic export reminder** - Prompt user to backup periodically
2. **Cloud sync option** - Optional server-side storage (post-MVP)
3. **Data compression** - Compress polylines to reduce storage size

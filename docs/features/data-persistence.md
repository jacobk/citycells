# Data Persistence

## Overview

CityCells uses SQLite running in the browser via sql.js (WebAssembly) with IndexedDB for persistence. This allows all user data to remain on their device while providing powerful SQL query capabilities.

## User Stories

From [PRD 001](../PRD/001-mvp-mobile-walker.md) section 3.8:
- "All data stored locally in browser using sql.js (SQLite in WebAssembly)"
- "Data persists to IndexedDB across sessions"
- "Analysis results cached—no re-analysis on page reload"
- "Export database feature for backup"
- "Import database feature to restore from backup"

## Implementation

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/db.ts` | Core database module: init, schema, persistence, queries |
| `src/lib/analysis-persistence.ts` | Functions for saving/loading analysis results |
| `src/hooks/useDatabase.ts` | React hook for database access with loading states |
| `public/sql-wasm/sql-wasm.wasm` | WebAssembly SQLite binary (~1MB) |
| `next.config.ts` | WASM file serving headers configuration |

### Technology Stack

**sql.js**: SQLite compiled to WebAssembly, runs entirely in browser.

**IndexedDB**: Browser storage API used to persist the SQLite database file.

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
│                                          │    sql.js    │  │
│                                          │   (WASM)     │  │
│                                          └──────┬───────┘  │
│                                                  │          │
│                                          ┌──────▼───────┐  │
│                                          │  IndexedDB   │  │
│                                          │ (Persistence)│  │
│                                          └──────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Database Schema

See [ADR 004](../ADR/004-sqlite-storage.md) for complete schema. Key tables:

| Table | Purpose |
|-------|---------|
| `users` | Strava user info and tokens |
| `areas` | Cached sub-area data from GeoJSON |
| `walks` | Synced Strava activities and cached stream data |
| `walk_analyses` | Analysis results per walk-area pair |
| `deviations` | Detected obstacle avoidances |
| `area_completions` | Denormalized completion status |

### Initialization Flow

1. **Load sql.js WASM** - ~1MB download, cached by browser
2. **Check IndexedDB** - Look for existing database
3. **Create or Restore** - New database or restore from IndexedDB
4. **Run Migrations** - Apply schema updates if needed
5. **Seed Areas** - Load from GeoJSON if areas table empty

### Persistence Strategy

```typescript
// After any write operation
async function executeWrite(sql: string, params?: any[]) {
  db.run('BEGIN TRANSACTION');
  try {
    db.run(sql, params);
    db.run('COMMIT');
    await persistDatabase(); // Save to IndexedDB
  } catch (e) {
    db.run('ROLLBACK');
    throw e;
  }
}
```

WHY: Every write is wrapped in a transaction for atomicity, then immediately persisted to IndexedDB to survive page reloads.

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
- `loadCachedAnalyses()` - Loads cached results with all metrics for fast page rendering
  - **WHY:** Uses `COALESCE(quality_score, raw_quality_score)` to prefer exemption-adjusted scores
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

High-fidelity GPS streams are cached alongside walk records to avoid repeated Strava API calls.

**Columns:**
- `walks.streams_json` - Serialized stream payload (`latlng`, `time`, `distance`)
- `walks.streams_fetched_at` - ISO timestamp when streams were fetched
- `walks.stream_point_count` - Point count for diagnostics

**Flow:**
1. Fetch streams for a walk when needed for analysis.
2. Store streams in `walks` after analysis is persisted.
3. Reuse cached streams on subsequent sessions.

### Export/Import

**Export**: Serialize entire SQLite database to a `.db` file for user download.

**Import**: Load a `.db` file, validate it's a CityCells database, replace current data.

WHY: Since data is browser-local, users need a way to backup and restore their progress. This also enables moving data between devices.

## Rationale

### Why SQLite over localStorage/IndexedDB directly?

From [ADR 004](../ADR/004-sqlite-storage.md):

1. **SQL Power**: Complex queries (joins, aggregations) needed for progress tracking
2. **Schema Enforcement**: Relationships between walks, analyses, deviations
3. **Transactions**: Atomic updates across multiple tables
4. **Portability**: Export entire database as single file

### Why Browser Storage over Server?

1. **Privacy**: User data never leaves their device
2. **Cost**: No server infrastructure for MVP
3. **Offline**: Works without internet after initial load
4. **Simplicity**: No auth complexity, no data sync issues

### Why Eager Persistence?

Every write immediately persists to IndexedDB rather than batching:

1. **Data Safety**: User closes tab unexpectedly? Data saved.
2. **Simplicity**: No complex flush logic or timers
3. **Performance**: IndexedDB writes are fast (~1-5ms for small changes)

### Magic Numbers

| Value | Meaning | Source |
|-------|---------|--------|
| `citycells-db` | IndexedDB database name | Chosen for clarity |
| `SCHEMA_VERSION = 2` | Schema migration version | Increment for migrations |

## Current Limitations

1. **No cross-device sync**: Data stays on one browser. Future: cloud storage option.

2. **Bundle size**: sql.js WASM adds ~1MB to initial load. Mitigated by lazy loading.

3. **Storage limits**: IndexedDB typically allows 50MB+, sufficient for this app.

4. **No automatic backup**: User must manually export. Consider periodic reminder.

## Planned Improvements

1. **Automatic export reminder** - Prompt user to backup periodically
2. **Cloud sync option** - Optional server-side storage (post-MVP)
3. **Data compression** - Compress polylines to reduce storage size

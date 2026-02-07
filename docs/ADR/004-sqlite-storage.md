# ADR 004: SQLite Storage Architecture

**Date:** 2026-02-03
**Status:** Accepted

## Context

The CityCells application needs to persist:
1. User authentication data (Strava OAuth tokens)
2. Synced Strava activities (walks)
3. Analysis results (metrics, scores, tiers)
4. Detected deviations and user exemptions
5. Area completion status per user

Previously, all analysis was performed on-the-fly in the browser with no persistence. This approach has limitations:
- Re-analysis required on every page load
- No way to store exemptions
- No historical data for trends/statistics
- Performance degrades with many activities

We need a storage solution that:
- Works in the browser (no server required for MVP)
- Provides SQL query capabilities
- Persists across sessions
- Can be exported/backed up

## Decision

We will use **SQLite** via **sql.js** (WebAssembly) with **IndexedDB** persistence.

### Technology Choice: sql.js

[sql.js](https://github.com/sql-js/sql.js) is a JavaScript library that runs SQLite compiled to WebAssembly entirely in the browser.

**Why sql.js:**
- Full SQLite compatibility (joins, indexes, transactions)
- No server required
- Data stays on user's device (privacy)
- Can export entire database as a file for backup
- ~1MB WASM bundle (acceptable for this app)

**Persistence Layer:**
- sql.js databases are in-memory by default
- We persist to IndexedDB after each write transaction
- On load, restore from IndexedDB if available

### Database Schema

```sql
-- ============================================
-- USERS
-- ============================================
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  strava_id INTEGER UNIQUE NOT NULL,
  username TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ============================================
-- AREAS (cached from GeoJSON)
-- ============================================
CREATE TABLE areas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fid INTEGER UNIQUE NOT NULL,           -- From GeoJSON properties.FID
  name TEXT NOT NULL,                     -- From properties.delomr
  perimeter_meters REAL NOT NULL,
  area_sqm REAL NOT NULL,                 -- Total area in square meters
  geometry_json TEXT NOT NULL,            -- Full polygon GeoJSON
  created_at TEXT DEFAULT (datetime('now'))
);

-- ============================================
-- WALKS (Strava activities)
-- ============================================
CREATE TABLE walks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  strava_activity_id INTEGER UNIQUE NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id),
  name TEXT,
  total_distance_meters REAL,
  polyline TEXT NOT NULL,                 -- Encoded polyline from Strava
  started_at TEXT,                        -- ISO 8601 timestamp
  synced_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_walks_user ON walks(user_id);
CREATE INDEX idx_walks_strava_id ON walks(strava_activity_id);

-- ============================================
-- WALK ANALYSES (one per walk-area pair)
-- ============================================
CREATE TABLE walk_analyses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  walk_id INTEGER NOT NULL REFERENCES walks(id),
  area_id INTEGER NOT NULL REFERENCES areas(id),
  
  -- Perimeter metrics
  perimeter_coverage_percent REAL NOT NULL,
  covered_distance_meters REAL NOT NULL,
  rmse_meters REAL,
  max_deviation_meters REAL,
  p90_deviation_meters REAL,
  efficiency REAL,
  
  -- Area metrics (m²)
  area_coverage_percent REAL,             -- % of sub-area enclosed by walk
  enclosed_area_sqm REAL,                 -- Actual m² enclosed
  is_closed_loop INTEGER DEFAULT 0,       -- 1 if walk forms closed polygon
  loop_gap_meters REAL,                   -- Distance between start and end
  
  -- Computed score (before exemptions)
  raw_quality_score REAL,
  
  -- Computed score (after exemptions applied)
  -- WHY: When exemptions are applied, quality_score is recalculated and updated.
  -- The system prefers quality_score over raw_quality_score when loading cached results
  -- to ensure displayed scores match exemption-adjusted tiers.
  quality_score REAL,
  tier TEXT CHECK(tier IN ('platinum', 'gold', 'silver', 'bronze')),
  
  -- Exclusive assignment (from ADR 002)
  is_primary_match INTEGER DEFAULT 0,
  
  analyzed_at TEXT DEFAULT (datetime('now')),
  
  UNIQUE(walk_id, area_id)
);

CREATE INDEX idx_analyses_area ON walk_analyses(area_id);
CREATE INDEX idx_analyses_walk ON walk_analyses(walk_id);
CREATE INDEX idx_analyses_primary ON walk_analyses(is_primary_match) 
  WHERE is_primary_match = 1;

-- ============================================
-- DEVIATIONS (detected obstacle avoidances)
-- ============================================
CREATE TABLE deviations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  walk_analysis_id INTEGER NOT NULL REFERENCES walk_analyses(id),
  
  -- Position in walk polyline
  start_point_index INTEGER NOT NULL,
  end_point_index INTEGER NOT NULL,
  
  -- Coordinates where deviation started/ended
  start_lat REAL NOT NULL,
  start_lng REAL NOT NULL,
  end_lat REAL NOT NULL,
  end_lng REAL NOT NULL,
  
  -- Border points (where walker left/rejoined)
  start_border_lat REAL NOT NULL,
  start_border_lng REAL NOT NULL,
  end_border_lat REAL NOT NULL,
  end_border_lng REAL NOT NULL,
  
  -- Measurements
  border_gap_meters REAL NOT NULL,        -- Distance along border bypassed
  detour_distance_meters REAL NOT NULL,   -- Actual path taken
  max_deviation_meters REAL NOT NULL,     -- Furthest from border
  return_accuracy_meters REAL NOT NULL,   -- How close end is to start on border
  detour_ratio REAL NOT NULL,             -- detour_distance / border_gap
  
  -- Auto-classification
  classification TEXT CHECK(classification IN 
    ('obstacle_avoidance', 'shortcut', 'drift')),
  
  -- User exemption
  is_exempt INTEGER DEFAULT 0,
  exemption_reason TEXT,
  exempted_at TEXT,
  
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_deviations_analysis ON deviations(walk_analysis_id);
CREATE INDEX idx_deviations_exempt ON deviations(is_exempt) 
  WHERE is_exempt = 1;

-- ============================================
-- AREA COMPLETIONS (denormalized for fast queries)
-- ============================================
CREATE TABLE area_completions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  area_id INTEGER NOT NULL REFERENCES areas(id),
  
  -- Best walk info
  best_walk_analysis_id INTEGER REFERENCES walk_analyses(id),
  best_quality_score REAL,
  tier TEXT,
  
  -- Statistics
  total_walks INTEGER DEFAULT 1,
  total_exemptions INTEGER DEFAULT 0,
  
  -- Timestamps
  first_completed_at TEXT,
  best_completed_at TEXT,
  
  UNIQUE(user_id, area_id)
);

CREATE INDEX idx_completions_user ON area_completions(user_id);
CREATE INDEX idx_completions_tier ON area_completions(tier);

-- ============================================
-- VIEWS (for common queries)
-- ============================================

-- User progress summary
CREATE VIEW user_progress AS
SELECT 
  u.id as user_id,
  u.username,
  COUNT(ac.id) as completed_areas,
  (SELECT COUNT(*) FROM areas) as total_areas,
  ROUND(COUNT(ac.id) * 100.0 / (SELECT COUNT(*) FROM areas), 1) as completion_percent,
  SUM(CASE WHEN ac.tier = 'platinum' THEN 1 ELSE 0 END) as platinum_count,
  SUM(CASE WHEN ac.tier = 'gold' THEN 1 ELSE 0 END) as gold_count,
  SUM(CASE WHEN ac.tier = 'silver' THEN 1 ELSE 0 END) as silver_count,
  SUM(CASE WHEN ac.tier = 'bronze' THEN 1 ELSE 0 END) as bronze_count
FROM users u
LEFT JOIN area_completions ac ON u.id = ac.user_id
GROUP BY u.id;

-- Area leaderboard (best score per area)
CREATE VIEW area_leaderboard AS
SELECT 
  a.id as area_id,
  a.name as area_name,
  ac.user_id,
  u.username,
  ac.best_quality_score,
  ac.tier,
  ac.best_completed_at
FROM areas a
LEFT JOIN area_completions ac ON a.id = ac.area_id
LEFT JOIN users u ON ac.user_id = u.id
ORDER BY a.id, ac.best_quality_score DESC;
```

### Storage Location

| Environment | Location | Notes |
|-------------|----------|-------|
| Development | `./data/citycells.db` | Gitignored, file-based for debugging |
| Production  | IndexedDB (`citycells-db`) | Browser storage, persists across sessions |

### Implementation Notes

#### Initialization Flow

```typescript
// 1. Load sql.js WASM
const SQL = await initSqlJs({
  locateFile: file => `/sql-wasm/${file}`
});

// 2. Try to restore from IndexedDB
const savedDb = await loadFromIndexedDB('citycells-db');

// 3. Create or restore database
const db = savedDb 
  ? new SQL.Database(savedDb) 
  : new SQL.Database();

// 4. Run migrations if needed
await runMigrations(db);

// 5. Seed areas from GeoJSON if empty
if (db.exec("SELECT COUNT(*) FROM areas")[0].values[0][0] === 0) {
  await seedAreasFromGeoJSON(db);
}
```

#### Persistence Strategy

```typescript
// After any write operation
async function persistDatabase(db: Database) {
  const data = db.export(); // Uint8Array
  await saveToIndexedDB('citycells-db', data);
}

// Wrap writes in transaction + persist
async function executeWrite(db: Database, sql: string, params?: any[]) {
  db.run('BEGIN TRANSACTION');
  try {
    db.run(sql, params);
    db.run('COMMIT');
    await persistDatabase(db);
  } catch (e) {
    db.run('ROLLBACK');
    throw e;
  }
}
```

#### Cache Loading Strategy (Updated: 2026-02-05)

Analysis results MUST be loaded from the database before re-computation to avoid unnecessary processing on page load.

**Required Page Load Flow:**

```typescript
// 1. After database initialization and user authentication
const userId = getOrCreateUserId(stravaId);

// 2. Load cached analysis results FIRST (fast - direct DB query)
const cachedResults = loadCachedAnalyses(userId);

// 3. Immediately populate UI with cached data
// WHY: User sees completed areas instantly without waiting for analysis
cachedResults.forEach((cached, areaFid) => {
  areaAnalyses.set(areaFid, {
    tier: cached.metrics.tier,
    qualityScore: cached.metrics.rawQualityScore,
    // ... other metrics from cache
  });
});

// 4. Identify activities that need analysis
const allActivityIds = activities.map(a => a.id);
const newActivityIds = getActivitiesToAnalyze(userId, allActivityIds);

// 5. Only analyze NEW activities (skip already-analyzed)
if (newActivityIds.length > 0) {
  const activitiesToProcess = activities.filter(
    a => newActivityIds.includes(a.id)
  );
  // Run analysis only for new activities
  // Merge results with cached data for final display
}
```

**Expected Behavior:**

| Scenario | User Experience |
|----------|-----------------|
| First visit | Full analysis runs, results saved to DB |
| Return visit (same activities) | Cached results load instantly (<100ms), no analysis |
| New activity synced | Only new activity analyzed, merged with cache |

**Key Functions (in `analysis-persistence.ts`):**

- `loadCachedAnalyses(userId)` - Returns Map of area FID → cached metrics
  - **WHY:** Uses `COALESCE(quality_score, raw_quality_score)` to prefer exemption-adjusted scores
  - Ensures displayed scores match tiers calculated with exemptions applied
- `getActivitiesToAnalyze(userId, activityIds)` - Returns IDs not yet analyzed
- `saveWalkAnalysis(...)` - Persists analysis results after computation
  - **WHY:** Selects best walk per area using adjusted scores (`COALESCE(quality_score, raw_quality_score)`)
  - Ensures `area_completions` reflects the actual best walk after exemptions

**WHY:** Analysis computation is expensive (geospatial calculations with Turf.js). Caching avoids re-computation on every page load, providing instant feedback for returning users. The preference for `quality_score` ensures score stability across rebuilds when exemptions are applied.

#### Export/Import for Backup

```typescript
// Export
function exportDatabase(db: Database): Blob {
  const data = db.export();
  return new Blob([data], { type: 'application/x-sqlite3' });
}

// Import
async function importDatabase(file: File): Promise<Database> {
  const buffer = await file.arrayBuffer();
  return new SQL.Database(new Uint8Array(buffer));
}
```

## Consequences

### Positive
- **No server needed**: All data stays local, reducing infrastructure costs
- **Privacy**: User data never leaves their device
- **SQL power**: Complex queries, joins, aggregations available
- **Offline capable**: Works without internet after initial load
- **Portable**: Users can export/import their data

### Negative
- **Bundle size**: sql.js WASM adds ~1MB to initial load
- **No sync**: Data doesn't sync across devices (future consideration)
- **Browser limits**: IndexedDB has storage limits (typically 50MB+, sufficient for this app)
- **No server backup**: If user clears browser data, progress is lost (mitigated by export feature)

### Technical
- WASM file must be served with correct MIME type
- Need to handle database corruption gracefully
- Consider lazy-loading sql.js to improve initial page load

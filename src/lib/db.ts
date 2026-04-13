/**
 * CityCells Database Module
 * 
 * SQLite database using sql.js (WebAssembly) with IndexedDB persistence.
 * See ADR 004 for architecture decision and schema details.
 * 
 * @module db
 */

import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import type { CachedStreams } from '@/lib/types/strava-streams';

// ============================================
// Constants
// ============================================

// WHY: IndexedDB database and store names for persistence
// Using a consistent name allows data to persist across sessions
const INDEXEDDB_NAME = 'citycells-db';
const INDEXEDDB_STORE = 'database';

// WHY: Schema version for migrations - increment when schema changes
// v5: Added last_activity_sync_at and last_synced_activity_id columns for incremental sync (TICKET-016)
// v6: Added achievements and user_achievements tables for gamification (TICKET-023)
// v7: Added athlete info columns (firstname, lastname, profile) for caching (TICKET-024)
// v8: Added tier_distribution and tiered_border_score columns for ADR 021 tiered scoring (TICKET-026)
const SCHEMA_VERSION = 8;

// ============================================
// Types
// ============================================

export interface AreaRow {
  id: number;
  fid: number;
  name: string;
  perimeter_meters: number;
  area_sqm: number;
  geometry_json: string;
}

export interface UserProgressRow {
  user_id: number;
  username: string | null;
  completed_areas: number;
  total_areas: number;
  completion_percent: number;
  platinum_count: number;
  gold_count: number;
  silver_count: number;
  bronze_count: number;
  potato_count: number;
}

export type Tier = 'platinum' | 'gold' | 'silver' | 'bronze' | 'potato';

// WHY: UserRow includes token fields for persistent authentication (ADR 013)
// and cached athlete info for session restoration optimization (TICKET-024)
export interface UserRow {
  id: number;
  strava_id: number;
  username: string | null;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: number | null;
  // WHY: Cached athlete info to avoid extra Strava API call on session restoration
  // See ADR 013 (2026-02-17 Update) for rationale
  firstname: string | null;
  lastname: string | null;
  profile: string | null;
  created_at: string;
}

// WHY: TokenData is used to update user tokens after OAuth or refresh
export interface TokenData {
  access_token: string;
  refresh_token: string;
  token_expires_at: number; // Unix timestamp in seconds
}

// WHY: CachedAthleteInfo matches the AthleteInfo type from auth-cookies.ts
// Used to cache athlete display info in SQLite (TICKET-024, ADR 013 2026-02-17 Update)
export interface CachedAthleteInfo {
  firstname: string;
  lastname: string;
  profile: string;
}

// ============================================
// Module State
// ============================================

let SQL: SqlJsStatic | null = null;
let db: Database | null = null;
let isInitialized = false;

// ============================================
// IndexedDB Persistence Layer
// ============================================

/**
 * Save database to IndexedDB for persistence across sessions.
 * WHY: sql.js databases are in-memory by default; we persist after each write
 * to ensure data survives page reloads.
 */
async function saveToIndexedDB(data: Uint8Array): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(INDEXEDDB_NAME, 1);
    
    request.onerror = () => reject(request.error);
    
    request.onupgradeneeded = () => {
      const idb = request.result;
      if (!idb.objectStoreNames.contains(INDEXEDDB_STORE)) {
        idb.createObjectStore(INDEXEDDB_STORE);
      }
    };
    
    request.onsuccess = () => {
      const idb = request.result;
      const tx = idb.transaction(INDEXEDDB_STORE, 'readwrite');
      const store = tx.objectStore(INDEXEDDB_STORE);
      
      // WHY: Using a fixed key 'db' since we only store one database
      store.put(data, 'db');
      
      tx.oncomplete = () => {
        idb.close();
        resolve();
      };
      tx.onerror = () => {
        idb.close();
        reject(tx.error);
      };
    };
  });
}

/**
 * Load database from IndexedDB if it exists.
 * Returns null if no saved database found.
 */
async function loadFromIndexedDB(): Promise<Uint8Array | null> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(INDEXEDDB_NAME, 1);
    
    request.onerror = () => reject(request.error);
    
    request.onupgradeneeded = () => {
      const idb = request.result;
      if (!idb.objectStoreNames.contains(INDEXEDDB_STORE)) {
        idb.createObjectStore(INDEXEDDB_STORE);
      }
    };
    
    request.onsuccess = () => {
      const idb = request.result;
      const tx = idb.transaction(INDEXEDDB_STORE, 'readonly');
      const store = tx.objectStore(INDEXEDDB_STORE);
      const getRequest = store.get('db');
      
      getRequest.onsuccess = () => {
        idb.close();
        resolve(getRequest.result || null);
      };
      getRequest.onerror = () => {
        idb.close();
        reject(getRequest.error);
      };
    };
  });
}

// ============================================
// Schema Definition
// ============================================

/**
 * Database schema from ADR 004.
 * WHY: All tables support the multi-metric scoring system (ADR 003)
 * and exemption workflow defined in the PRD.
 */
const SCHEMA_SQL = `
-- ============================================
-- USERS
-- ============================================
CREATE TABLE IF NOT EXISTS users (
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
CREATE TABLE IF NOT EXISTS areas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fid INTEGER UNIQUE NOT NULL,
  name TEXT NOT NULL,
  perimeter_meters REAL NOT NULL,
  area_sqm REAL NOT NULL,
  geometry_json TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ============================================
-- WALKS (Strava activities)
-- ============================================
CREATE TABLE IF NOT EXISTS walks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  strava_activity_id INTEGER UNIQUE NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id),
  name TEXT,
  total_distance_meters REAL,
  polyline TEXT NOT NULL,
  streams_json TEXT,
  streams_fetched_at TEXT,
  stream_point_count INTEGER,
  -- WHY: Store original start/end coordinates from Strava activity for accurate loop detection
  -- during re-analysis. Streams can be truncated by privacy zones, but activity start/end are not.
  start_lat REAL,
  start_lng REAL,
  end_lat REAL,
  end_lng REAL,
  started_at TEXT,
  synced_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_walks_user ON walks(user_id);
CREATE INDEX IF NOT EXISTS idx_walks_strava_id ON walks(strava_activity_id);

-- ============================================
-- WALK ANALYSES (one per walk-area pair)
-- ============================================
CREATE TABLE IF NOT EXISTS walk_analyses (
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
  
  -- Area metrics
  area_coverage_percent REAL,
  enclosed_area_sqm REAL,
  is_closed_loop INTEGER DEFAULT 0,
  loop_gap_meters REAL,
  
  -- Computed scores
  raw_quality_score REAL,
  quality_score REAL,
  tier TEXT CHECK(tier IN ('platinum', 'gold', 'silver', 'bronze', 'potato')),
  
  -- Tiered scoring (ADR 021)
  tiered_border_score REAL,
  tier_distribution TEXT,
  
  -- Exclusive assignment (from ADR 002)
  is_primary_match INTEGER DEFAULT 0,
  
  analyzed_at TEXT DEFAULT (datetime('now')),
  
  UNIQUE(walk_id, area_id)
);

CREATE INDEX IF NOT EXISTS idx_analyses_area ON walk_analyses(area_id);
CREATE INDEX IF NOT EXISTS idx_analyses_walk ON walk_analyses(walk_id);

-- ============================================
-- DEVIATIONS (detected obstacle avoidances)
-- ============================================
CREATE TABLE IF NOT EXISTS deviations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  walk_analysis_id INTEGER NOT NULL REFERENCES walk_analyses(id),
  
  start_point_index INTEGER NOT NULL,
  end_point_index INTEGER NOT NULL,
  
  start_lat REAL NOT NULL,
  start_lng REAL NOT NULL,
  end_lat REAL NOT NULL,
  end_lng REAL NOT NULL,
  
  start_border_lat REAL NOT NULL,
  start_border_lng REAL NOT NULL,
  end_border_lat REAL NOT NULL,
  end_border_lng REAL NOT NULL,
  
  border_gap_meters REAL NOT NULL,
  detour_distance_meters REAL NOT NULL,
  max_deviation_meters REAL NOT NULL,
  return_accuracy_meters REAL NOT NULL,
  detour_ratio REAL NOT NULL,
  
  classification TEXT CHECK(classification IN ('obstacle_avoidance', 'shortcut', 'drift')),
  
  is_exempt INTEGER DEFAULT 0,
  exemption_reason TEXT,
  exempted_at TEXT,
  
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_deviations_analysis ON deviations(walk_analysis_id);

-- ============================================
-- AREA COMPLETIONS (denormalized for fast queries)
-- ============================================
CREATE TABLE IF NOT EXISTS area_completions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  area_id INTEGER NOT NULL REFERENCES areas(id),
  
  best_walk_analysis_id INTEGER REFERENCES walk_analyses(id),
  best_quality_score REAL,
  tier TEXT,
  
  total_walks INTEGER DEFAULT 1,
  total_exemptions INTEGER DEFAULT 0,
  
  first_completed_at TEXT,
  best_completed_at TEXT,
  
  UNIQUE(user_id, area_id)
);

CREATE INDEX IF NOT EXISTS idx_completions_user ON area_completions(user_id);
CREATE INDEX IF NOT EXISTS idx_completions_tier ON area_completions(tier);

-- ============================================
-- SCHEMA VERSION (for migrations)
-- ============================================
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY
);

-- ============================================
-- ACHIEVEMENTS (static definitions, seeded on init)
-- See ADR 019 for schema design
-- ============================================
CREATE TABLE IF NOT EXISTS achievements (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  category TEXT NOT NULL,
  is_hidden INTEGER DEFAULT 0,
  sort_order INTEGER NOT NULL,
  condition_type TEXT NOT NULL,
  condition_value TEXT NOT NULL
);

-- ============================================
-- USER ACHIEVEMENTS (unlock records)
-- ============================================
CREATE TABLE IF NOT EXISTS user_achievements (
  user_id INTEGER NOT NULL REFERENCES users(id),
  achievement_id TEXT NOT NULL REFERENCES achievements(id),
  unlocked_at TEXT NOT NULL,
  PRIMARY KEY (user_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id);
`;

// ============================================
// Initialization
// ============================================

/**
 * Initialize the database.
 * - Loads sql.js WASM
 * - Restores from IndexedDB if available
 * - Creates schema if new database
 * - Seeds areas from GeoJSON if empty
 */
export async function initDatabase(): Promise<Database> {
  if (isInitialized && db) {
    return db;
  }

  const t0 = performance.now();
  const dbPerf = (stage: string) => console.log(`[DB-PERF] +${(performance.now() - t0).toFixed(0)}ms ${stage}`);

  // WHY: Lazy load sql.js to avoid blocking initial page render
  // The WASM file is ~1MB, so we only load it when needed
  if (!SQL) {
    dbPerf('wasm-load-start');
    SQL = await initSqlJs({
      locateFile: (file: string) => `/sql-wasm/${file}`
    });
    dbPerf('wasm-load-done');
  }

  // Try to restore from IndexedDB
  dbPerf('indexeddb-load-start');
  const savedData = await loadFromIndexedDB();
  dbPerf('indexeddb-load-done');
  
  if (savedData) {
    db = new SQL.Database(savedData);
    console.log('[DB] Restored database from IndexedDB');
  } else {
    db = new SQL.Database();
    console.log('[DB] Created new database');
  }

  // Run schema creation (IF NOT EXISTS makes this safe to run repeatedly)
  dbPerf('schema-run-start');
  db.run(SCHEMA_SQL);
  dbPerf('schema-run-done');

  // Check and update schema version
  const versionResult = db.exec('SELECT version FROM schema_version LIMIT 1');
  const currentVersion = versionResult.length > 0 ? versionResult[0].values[0][0] as number : 0;
  
  // WHY: Capture db reference to avoid race condition where closeDatabase()
  // sets module-level db to null during React Strict Mode cleanup while migrations run
  const database = db;
  
  if (currentVersion < SCHEMA_VERSION) {
    if (currentVersion < 2) {
      const columnsResult = db.exec("PRAGMA table_info(walks)");
      const columnNames = new Set(
        columnsResult.length > 0
          ? columnsResult[0].values.map(row => row[1] as string)
          : []
      );

      if (!columnNames.has('streams_json')) {
        db.run('ALTER TABLE walks ADD COLUMN streams_json TEXT');
      }
      if (!columnNames.has('streams_fetched_at')) {
        db.run('ALTER TABLE walks ADD COLUMN streams_fetched_at TEXT');
      }
      if (!columnNames.has('stream_point_count')) {
        db.run('ALTER TABLE walks ADD COLUMN stream_point_count INTEGER');
      }
    }

    // WHY: Schema version 3 adds start/end coordinates for accurate loop detection during re-analysis
    // Streams can be truncated by privacy zones, but activity start/end are not.
    if (currentVersion < 3) {
      const columnsResult = db.exec("PRAGMA table_info(walks)");
      const columnNames = new Set(
        columnsResult.length > 0
          ? columnsResult[0].values.map(row => row[1] as string)
          : []
      );

      if (!columnNames.has('start_lat')) {
        db.run('ALTER TABLE walks ADD COLUMN start_lat REAL');
      }
      if (!columnNames.has('start_lng')) {
        db.run('ALTER TABLE walks ADD COLUMN start_lng REAL');
      }
      if (!columnNames.has('end_lat')) {
        db.run('ALTER TABLE walks ADD COLUMN end_lat REAL');
      }
      if (!columnNames.has('end_lng')) {
        db.run('ALTER TABLE walks ADD COLUMN end_lng REAL');
      }
    }

    // WHY: Schema version 4 adds 'potato' tier to CHECK constraint (Ticket 013)
    // SQLite doesn't support modifying CHECK constraints, so we need to:
    // 1. Create new table with updated constraint
    // 2. Copy data
    // 3. Drop old table
    // 4. Rename new table
    if (currentVersion < 4) {
      console.log('[DB Migration] Adding potato tier support...');
      
      // Check if we need to migrate (table exists and has old constraint)
      const tableExists = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='walk_analyses'");
      if (tableExists.length > 0) {
        // Create temporary table with new constraint (must match full schema)
        db.run(`
          CREATE TABLE walk_analyses_new (
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
            
            -- Area metrics
            area_coverage_percent REAL,
            enclosed_area_sqm REAL,
            is_closed_loop INTEGER DEFAULT 0,
            loop_gap_meters REAL,
            
            -- Computed scores
            raw_quality_score REAL,
            quality_score REAL,
            tier TEXT CHECK(tier IN ('platinum', 'gold', 'silver', 'bronze', 'potato')),
            
            -- Exclusive assignment (from ADR 002)
            is_primary_match INTEGER DEFAULT 0,
            
            analyzed_at TEXT DEFAULT (datetime('now')),
            
            UNIQUE(walk_id, area_id)
          )
        `);
        
        // Copy data from old table to new table (explicitly list all columns)
        db.run(`
          INSERT INTO walk_analyses_new 
          SELECT 
            id,
            walk_id,
            area_id,
            perimeter_coverage_percent,
            covered_distance_meters,
            rmse_meters,
            max_deviation_meters,
            p90_deviation_meters,
            efficiency,
            area_coverage_percent,
            enclosed_area_sqm,
            is_closed_loop,
            loop_gap_meters,
            raw_quality_score,
            quality_score,
            tier,
            is_primary_match,
            analyzed_at
          FROM walk_analyses
        `);
        
        // Drop old table
        db.run('DROP TABLE walk_analyses');
        
        // Rename new table
        db.run('ALTER TABLE walk_analyses_new RENAME TO walk_analyses');
        
        // Recreate indexes
        db.run('CREATE INDEX IF NOT EXISTS idx_analyses_area ON walk_analyses(area_id)');
        db.run('CREATE INDEX IF NOT EXISTS idx_analyses_walk ON walk_analyses(walk_id)');
        
        console.log('[DB Migration] Potato tier support added successfully');
      }
    }

    // WHY: Schema version 5 adds incremental sync support (TICKET-016)
    // Tracks when activities were last synced from Strava to avoid fetching all on every load
    if (currentVersion < 5) {
      console.log('[DB Migration] Adding incremental sync columns...');
      
      const columnsResult = db.exec("PRAGMA table_info(users)");
      const columnNames = new Set(
        columnsResult.length > 0
          ? columnsResult[0].values.map(row => row[1] as string)
          : []
      );

      if (!columnNames.has('last_activity_sync_at')) {
        db.run('ALTER TABLE users ADD COLUMN last_activity_sync_at TEXT');
      }
      if (!columnNames.has('last_synced_activity_id')) {
        db.run('ALTER TABLE users ADD COLUMN last_synced_activity_id INTEGER');
      }
      
      console.log('[DB Migration] Incremental sync columns added successfully');
    }

    // WHY: Schema version 6 adds achievement system tables (TICKET-023)
    // Tables created by schema SQL, need to seed achievement definitions
    if (currentVersion < 6) {
      console.log('[DB Migration] Setting up achievement system...');
      await seedAchievements();
      console.log('[DB Migration] Achievement system setup complete');
    }

    // WHY: Re-check db after async seedAchievements - it may have been closed during HMR/Strict Mode
    if (!db) {
      console.warn('[DB] Database closed during achievement seeding, aborting initialization');
      throw new Error('Database closed during initialization');
    }

    // WHY: Schema version 7 adds athlete info caching columns (TICKET-024)
    // Caches firstname, lastname, profile to avoid extra Strava API call on session restoration
    // See ADR 013 (2026-02-17 Update) for rationale
    if (currentVersion < 7) {
      console.log('[DB Migration] Adding athlete info cache columns...');
      
      const columnsResult = db.exec("PRAGMA table_info(users)");
      const columnNames = new Set(
        columnsResult.length > 0
          ? columnsResult[0].values.map(row => row[1] as string)
          : []
      );

      if (!columnNames.has('firstname')) {
        db.run('ALTER TABLE users ADD COLUMN firstname TEXT');
      }
      if (!columnNames.has('lastname')) {
        db.run('ALTER TABLE users ADD COLUMN lastname TEXT');
      }
      if (!columnNames.has('profile')) {
        db.run('ALTER TABLE users ADD COLUMN profile TEXT');
      }
      
      console.log('[DB Migration] Athlete info cache columns added successfully');
    }

    // WHY: Schema version 8 adds tier distribution storage for ADR 021 tiered scoring
    // Stores JSON like: {"platinum": 0.15, "gold": 0.28, "silver": 0.22, "bronze": 0.12, "potato": 0.08, "missed": 0.15}
    if (currentVersion < 8) {
      console.log('[DB Migration] Adding tier_distribution column for tiered scoring...');
      
      const columnsResult = db.exec("PRAGMA table_info(walk_analyses)");
      const columnNames = new Set(
        columnsResult.length > 0
          ? columnsResult[0].values.map(row => row[1] as string)
          : []
      );

      if (!columnNames.has('tier_distribution')) {
        db.run('ALTER TABLE walk_analyses ADD COLUMN tier_distribution TEXT');
      }
      
      // WHY: Also add tiered_border_score column for the new composite metric
      if (!columnNames.has('tiered_border_score')) {
        db.run('ALTER TABLE walk_analyses ADD COLUMN tiered_border_score REAL');
      }
      
      console.log('[DB Migration] Tier distribution columns added successfully');
    }

    // WHY: Final null check before persisting - db may have been closed during migrations
    // Use captured 'database' reference since it's still valid even if module-level db was nulled
    if (!database) {
      console.warn('[DB] Database reference lost during migrations, aborting initialization');
      throw new Error('Database closed during initialization');
    }

    database.run('INSERT OR REPLACE INTO schema_version (version) VALUES (?)', [SCHEMA_VERSION]);
    await persistDatabase();
  }

  // WHY: Re-check db after async migrations - it may have been closed during HMR/Strict Mode
  // In this case, don't throw - just abort silently as a new initialization will follow
  if (!db) {
    console.warn('[DB] Database closed during migration (likely Strict Mode cleanup), aborting');
    isInitialized = false;
    return null as unknown as Database; // Return will be ignored, new init will start
  }

  // Seed areas if empty
  const areasCount = db.exec('SELECT COUNT(*) FROM areas');
  if (areasCount[0].values[0][0] === 0) {
    dbPerf('seed-areas-start');
    await seedAreasFromGeoJSON();
    dbPerf('seed-areas-done');
  } else {
    dbPerf(`areas-already-seeded (${areasCount[0].values[0][0]})`);
  }

  isInitialized = true;
  return db;
}

/**
 * Get the database instance.
 * Throws if not initialized.
 */
export function getDatabase(): Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

// ============================================
// Persistence
// ============================================

/**
 * Persist the current database state to IndexedDB.
 * Call after any write operation.
 */
export async function persistDatabase(): Promise<void> {
  if (!db) {
    throw new Error('Database not initialized');
  }
  
  const data = db.export();
  await saveToIndexedDB(data);
  console.log('[DB] Persisted to IndexedDB');
}

/**
 * Execute a write operation with automatic persistence.
 * WHY: Wraps writes in transaction for atomicity and persists after commit.
 */
export async function executeWrite(
  sql: string,
  params?: (string | number | null | Uint8Array)[],
  // WHY: skipPersist allows batching multiple writes with a single persistDatabase() call
  // at the end, avoiding N full-DB serializations during bulk saves. See TICKET-032.
  options?: { skipPersist?: boolean }
): Promise<void> {
  const database = getDatabase();

  database.run('BEGIN TRANSACTION');
  try {
    database.run(sql, params);
    database.run('COMMIT');
    if (!options?.skipPersist) {
      await persistDatabase();
    }
  } catch (e) {
    database.run('ROLLBACK');
    throw e;
  }
}

// ============================================
// Achievement Seeding (TICKET-023)
// ============================================

/**
 * Seed the achievements table with static definitions.
 * WHY: Achievements are defined in code but stored in DB for relational queries.
 * See ADR 019 for achievement system design.
 */
async function seedAchievements(): Promise<void> {
  if (!db) {
    throw new Error('Database not initialized');
  }

  // WHY: Capture db reference to avoid race condition where closeDatabase()
  // sets module-level db to null while we're awaiting the dynamic import
  const database = db;

  console.log('[DB] Seeding achievements...');
  
  // WHY: Dynamic import to avoid circular dependency
  const { ACHIEVEMENTS } = await import('@/lib/achievements');

  // WHY: Re-check db after async operation - it may have been closed during HMR/Strict Mode
  if (!db) {
    console.warn('[DB] Database closed during achievement seeding, aborting');
    return;
  }

  database.run('BEGIN TRANSACTION');
  
  try {
    for (const achievement of ACHIEVEMENTS) {
      database.run(
        `INSERT OR REPLACE INTO achievements 
         (id, name, description, icon, category, is_hidden, sort_order, condition_type, condition_value)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          achievement.id,
          achievement.name,
          achievement.description,
          achievement.icon,
          achievement.category,
          achievement.isHidden ? 1 : 0,
          achievement.sortOrder,
          achievement.conditionType,
          JSON.stringify(achievement.conditionValue),
        ]
      );
    }

    database.run('COMMIT');
    await persistDatabase();
    
    const count = database.exec('SELECT COUNT(*) FROM achievements')[0].values[0][0];
    console.log(`[DB] Seeded ${count} achievements`);
  } catch (e) {
    // WHY: Check if database is still valid before rollback
    if (db) {
      try {
        database.run('ROLLBACK');
      } catch {
        // Database may have been closed, ignore rollback error
      }
    }
    throw e;
  }
}

// ============================================
// Area Seeding
// ============================================

/**
 * Seed the areas table from the GeoJSON file.
 * WHY: Pre-populates area data so we don't need to re-parse GeoJSON on every analysis.
 * Calculates perimeter and area using Turf.js.
 */
async function seedAreasFromGeoJSON(): Promise<void> {
  if (!db) {
    throw new Error('Database not initialized');
  }

  console.log('[DB] Seeding areas from GeoJSON...');

  // Fetch the GeoJSON file
  const response = await fetch('/data/malmo_delomraden.geojson');
  const geoData = await response.json();

  // WHY: Import turf dynamically to avoid SSR issues and reduce initial bundle
  const turf = await import('@turf/turf');
  const { calculatePerimeterMeters } = await import('@/lib/geo-utils');

  // WHY: Process in chunks and yield to main thread to prevent mobile UI freeze.
  // Without this, 136 turf calculations + DB inserts block the main thread for
  // 5-10+ seconds on mobile, causing iOS to suppress all touch events. See TICKET-032.
  const CHUNK_SIZE = 10;
  const features = geoData.features;

  db.run('BEGIN TRANSACTION');

  try {
    for (let i = 0; i < features.length; i++) {
      const feature = features[i];
      if (!feature.geometry ||
          (feature.geometry.type !== 'Polygon' && feature.geometry.type !== 'MultiPolygon')) {
        continue;
      }

      const fid = feature.properties?.FID;
      const name = feature.properties?.delomr || 'Unknown';

      if (fid === undefined || fid === null) {
        continue;
      }

      // WHY: Use shared geo-utils to avoid duplicating perimeter logic (see geo-utils.ts)
      const perimeterMeters = calculatePerimeterMeters(feature);
      const areaSqm = turf.area(feature);
      const geometryJson = JSON.stringify(feature.geometry);

      db.run(
        `INSERT OR IGNORE INTO areas (fid, name, perimeter_meters, area_sqm, geometry_json)
         VALUES (?, ?, ?, ?, ?)`,
        [fid, name, perimeterMeters, areaSqm, geometryJson]
      );

      // WHY: Yield to main thread every CHUNK_SIZE features to keep UI responsive (TICKET-032)
      if ((i + 1) % CHUNK_SIZE === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    db.run('COMMIT');
    await persistDatabase();

    const count = db.exec('SELECT COUNT(*) FROM areas')[0].values[0][0];
    console.log(`[DB] Seeded ${count} areas`);
  } catch (e) {
    db.run('ROLLBACK');
    throw e;
  }
}

// ============================================
// Export/Import for Backup
// ============================================

/**
 * Export the database as a downloadable file.
 * WHY: Allows users to backup their progress since data is stored locally.
 */
export function exportDatabase(): Blob {
  const database = getDatabase();
  const data = database.export();
  // WHY: Create a copy of the data to ensure proper Blob construction
  // sql.js export() returns Uint8Array, but TypeScript's strict mode
  // complains about potential SharedArrayBuffer. Using new Uint8Array()
  // creates a guaranteed regular ArrayBuffer copy.
  const copy = new Uint8Array(data);
  return new Blob([copy], { type: 'application/x-sqlite3' });
}

/**
 * Import a database from a file.
 * WHY: Allows users to restore their progress from a backup.
 * Warning: This replaces all existing data!
 */
export async function importDatabase(file: File): Promise<void> {
  if (!SQL) {
    SQL = await initSqlJs({
      locateFile: (file: string) => `/sql-wasm/${file}`
    });
  }

  const buffer = await file.arrayBuffer();
  const newDb = new SQL.Database(new Uint8Array(buffer));
  
  // Validate that this is a CityCells database
  try {
    newDb.exec('SELECT COUNT(*) FROM areas');
    newDb.exec('SELECT COUNT(*) FROM schema_version');
  } catch {
    newDb.close();
    throw new Error('Invalid database file. This does not appear to be a CityCells backup.');
  }

  // Replace current database
  if (db) {
    db.close();
  }
  db = newDb;
  
  await persistDatabase();
  console.log('[DB] Imported database from file');
}

// ============================================
// Query Helpers
// ============================================

/**
 * Get all areas from the database.
 */
export function getAllAreas(): AreaRow[] {
  const database = getDatabase();
  const result = database.exec('SELECT id, fid, name, perimeter_meters, area_sqm, geometry_json FROM areas');
  
  if (result.length === 0) {
    return [];
  }

  return result[0].values.map(row => ({
    id: row[0] as number,
    fid: row[1] as number,
    name: row[2] as string,
    perimeter_meters: row[3] as number,
    area_sqm: row[4] as number,
    geometry_json: row[5] as string,
  }));
}

/**
 * Save stream data for a walk.
 */
export async function saveWalkStreams(
  walkId: number,
  streams: CachedStreams,
  options?: { skipPersist?: boolean }
): Promise<void> {
  await executeWrite(
    `UPDATE walks
     SET streams_json = ?, streams_fetched_at = ?, stream_point_count = ?
     WHERE id = ?`,
    [JSON.stringify(streams), streams.fetchedAt, streams.pointCount, walkId],
    options
  );
}

/**
 * Get cached streams for a walk by Strava activity id.
 */
export function getWalkStreams(stravaActivityId: number): CachedStreams | null {
  const database = getDatabase();
  const result = database.exec(
    'SELECT streams_json, stream_point_count FROM walks WHERE strava_activity_id = ? LIMIT 1',
    [stravaActivityId]
  );

  if (result.length === 0 || result[0].values.length === 0) {
    return null;
  }

  const streamsJson = result[0].values[0][0] as string | null;
  
  if (!streamsJson) {
    return null;
  }

  try {
    const parsed = JSON.parse(streamsJson) as CachedStreams;
    if (parsed.latlng.length === 0) {
      return null;
    }
    return parsed;
  } catch (e) {
    console.error(`[getWalkStreams] Failed to parse streams_json for activity ${stravaActivityId}:`, e);
    return null;
  }
}

/**
 * Check if streams should be fetched for an activity.
 */
export function needsStreamsFetch(stravaActivityId: number): boolean {
  const database = getDatabase();
  const result = database.exec(
    'SELECT streams_fetched_at, stream_point_count FROM walks WHERE strava_activity_id = ? LIMIT 1',
    [stravaActivityId]
  );

  if (result.length === 0 || result[0].values.length === 0) {
    return true;
  }

  const row = result[0].values[0];
  const fetchedAt = row[0] as string | null;
  const pointCount = row[1] as number | null;

  return !fetchedAt || !pointCount || pointCount <= 0;
}

/**
 * Get walk database id for a Strava activity.
 */
export function getWalkIdByActivityId(stravaActivityId: number): number | null {
  const database = getDatabase();
  const result = database.exec(
    'SELECT id FROM walks WHERE strava_activity_id = ? LIMIT 1',
    [stravaActivityId]
  );

  if (result.length === 0 || result[0].values.length === 0) {
    return null;
  }

  return result[0].values[0][0] as number;
}

/**
 * Get user progress summary.
 * Returns null if user not found.
 */
export function getUserProgress(userId: number): UserProgressRow | null {
  const database = getDatabase();
  
  const result = database.exec(`
    SELECT 
      u.id as user_id,
      u.username,
      COUNT(ac.id) as completed_areas,
      (SELECT COUNT(*) FROM areas) as total_areas,
      ROUND(COUNT(ac.id) * 100.0 / (SELECT COUNT(*) FROM areas), 1) as completion_percent,
      SUM(CASE WHEN ac.tier = 'platinum' THEN 1 ELSE 0 END) as platinum_count,
      SUM(CASE WHEN ac.tier = 'gold' THEN 1 ELSE 0 END) as gold_count,
      SUM(CASE WHEN ac.tier = 'silver' THEN 1 ELSE 0 END) as silver_count,
      SUM(CASE WHEN ac.tier = 'bronze' THEN 1 ELSE 0 END) as bronze_count,
      SUM(CASE WHEN ac.tier = 'potato' THEN 1 ELSE 0 END) as potato_count
    FROM users u
    LEFT JOIN area_completions ac ON u.id = ac.user_id
    WHERE u.id = ?
    GROUP BY u.id
  `, [userId]);

  if (result.length === 0 || result[0].values.length === 0) {
    return null;
  }

  const row = result[0].values[0];
  return {
    user_id: row[0] as number,
    username: row[1] as string | null,
    completed_areas: row[2] as number,
    total_areas: row[3] as number,
    completion_percent: row[4] as number,
    platinum_count: row[5] as number,
    gold_count: row[6] as number,
    silver_count: row[7] as number,
    bronze_count: row[8] as number,
    potato_count: row[9] as number,
  };
}

// ============================================
// Distance Metrics Queries (Ticket 012)
// ============================================

/**
 * Get theoretical distance (sum of perimeters for completed areas).
 * WHY: Represents the "ideal" distance if walking exactly the perimeter of each completed area.
 * Uses perimeter_meters from areas table joined with area_completions.
 * See ADR 005 for rationale on using perimeter_meters.
 * 
 * @param userId - User ID to get completed areas for
 * @returns Sum of perimeter_meters for all completed areas, or 0 if none
 */
export function getTheoreticalDistance(userId: number): number {
  const database = getDatabase();
  
  const result = database.exec(
    `SELECT SUM(a.perimeter_meters) 
     FROM areas a 
     INNER JOIN area_completions ac ON a.id = ac.area_id 
     WHERE ac.user_id = ?`,
    [userId]
  );

  if (result.length === 0 || result[0].values.length === 0) {
    return 0;
  }

  const value = result[0].values[0][0];
  // WHY: SUM() returns null if no rows match, handle gracefully
  return value !== null ? (value as number) : 0;
}

// WHY: Cache total perimeter distance since it's static (sum of all 136 areas)
// This value never changes, so we calculate once and reuse
let cachedTotalPerimeterDistance: number | null = null;

/**
 * Get total perimeter distance (sum of all area perimeters).
 * WHY: This is a static value representing the total challenge distance if walking
 * every area perimeter (all 136 sub-areas). Cached at module level since it never changes.
 * See PRD 001 Section 3.9.1 for distance tracking requirements.
 * 
 * @returns Sum of perimeter_meters for all areas, or 0 if no areas found
 */
export function getTotalPerimeterDistance(): number {
  // WHY: Return cached value if available to avoid repeated calculation
  if (cachedTotalPerimeterDistance !== null) {
    return cachedTotalPerimeterDistance;
  }

  const database = getDatabase();
  
  const result = database.exec('SELECT SUM(perimeter_meters) FROM areas');

  if (result.length === 0 || result[0].values.length === 0) {
    cachedTotalPerimeterDistance = 0;
    return 0;
  }

  const value = result[0].values[0][0];
  // WHY: SUM() returns null if no rows match, handle gracefully
  const total = value !== null ? (value as number) : 0;
  cachedTotalPerimeterDistance = total;
  return total;
}

/**
 * Get actual walked distance (sum of all walk distances for user).
 * WHY: Uses total_distance_meters from walks table, which stores Strava's distance field.
 * This accounts for privacy zone truncation in the polyline (see ADR 005) and provides
 * accurate total distance even when GPS points are missing.
 * Uses indexed user_id column for efficiency.
 * 
 * @param userId - User ID to get walk distances for
 * @returns Sum of total_distance_meters for all walks, or 0 if none
 */
export function getActualWalkedDistance(userId: number): number {
  const database = getDatabase();
  
  const result = database.exec(
    'SELECT SUM(total_distance_meters) FROM walks WHERE user_id = ?',
    [userId]
  );

  if (result.length === 0 || result[0].values.length === 0) {
    return 0;
  }

  const value = result[0].values[0][0];
  // WHY: SUM() returns null if no rows match, handle gracefully
  return value !== null ? (value as number) : 0;
}

// ============================================
// User Token Operations (ADR 013)
// ============================================

/**
 * Get a user by their Strava ID.
 * WHY: Used to check for existing user with stored tokens on page load.
 * See ADR 013 for the returning user flow.
 */
export function getUserByStravaId(stravaId: number): UserRow | null {
  const database = getDatabase();
  
  const result = database.exec(
    `SELECT id, strava_id, username, access_token, refresh_token, token_expires_at, 
            firstname, lastname, profile, created_at
     FROM users WHERE strava_id = ? LIMIT 1`,
    [stravaId]
  );

  if (result.length === 0 || result[0].values.length === 0) {
    return null;
  }

  const row = result[0].values[0];
  return {
    id: row[0] as number,
    strava_id: row[1] as number,
    username: row[2] as string | null,
    access_token: row[3] as string | null,
    refresh_token: row[4] as string | null,
    token_expires_at: row[5] as number | null,
    firstname: row[6] as string | null,
    lastname: row[7] as string | null,
    profile: row[8] as string | null,
    created_at: row[9] as string,
  };
}

/**
 * Update tokens for a user (create if not exists).
 * WHY: Called after OAuth callback and token refresh to persist tokens.
 * See ADR 013 "Token Storage Strategy" section.
 * 
 * @param stravaId - Strava athlete ID
 * @param tokens - Token data (access, refresh, expiry)
 * @param username - Optional username for display
 * @param athleteInfo - Optional athlete info to cache (TICKET-024)
 *                      When provided, caches firstname/lastname/profile to avoid
 *                      extra Strava API call on session restoration
 */
export async function updateUserTokens(
  stravaId: number,
  tokens: TokenData,
  username?: string,
  athleteInfo?: CachedAthleteInfo
): Promise<number> {
  const database = getDatabase();
  
  // Check if user exists
  const existing = database.exec('SELECT id FROM users WHERE strava_id = ?', [stravaId]);
  
  if (existing.length > 0 && existing[0].values.length > 0) {
    // Update existing user
    const userId = existing[0].values[0][0] as number;
    
    // WHY: If athlete info provided, update it alongside tokens
    // This ensures cache is fresh after OAuth or when explicitly updated
    if (athleteInfo) {
      await executeWrite(
        `UPDATE users 
         SET access_token = ?, refresh_token = ?, token_expires_at = ?, 
             username = COALESCE(?, username),
             firstname = ?, lastname = ?, profile = ?
         WHERE strava_id = ?`,
        [
          tokens.access_token, tokens.refresh_token, tokens.token_expires_at,
          username || null,
          athleteInfo.firstname, athleteInfo.lastname, athleteInfo.profile,
          stravaId
        ]
      );
    } else {
      await executeWrite(
        `UPDATE users 
         SET access_token = ?, refresh_token = ?, token_expires_at = ?, username = COALESCE(?, username)
         WHERE strava_id = ?`,
        [tokens.access_token, tokens.refresh_token, tokens.token_expires_at, username || null, stravaId]
      );
    }
    console.log(`[DB] Updated tokens for user ${stravaId}${athleteInfo ? ' (with athlete cache)' : ''}`);
    return userId;
  } else {
    // Create new user
    await executeWrite(
      `INSERT INTO users (strava_id, username, access_token, refresh_token, token_expires_at, firstname, lastname, profile)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        stravaId, 
        username || null, 
        tokens.access_token, 
        tokens.refresh_token, 
        tokens.token_expires_at,
        athleteInfo?.firstname || null,
        athleteInfo?.lastname || null,
        athleteInfo?.profile || null
      ]
    );
    const newUser = database.exec('SELECT id FROM users WHERE strava_id = ?', [stravaId]);
    const userId = newUser[0].values[0][0] as number;
    console.log(`[DB] Created user ${stravaId} with tokens${athleteInfo ? ' and athlete cache' : ''}`);
    return userId;
  }
}

/**
 * Clear tokens for a user (logout).
 * WHY: On logout, clear tokens from SQLite but keep user record for potential re-auth.
 * See ADR 013 "User logout" in Token Lifecycle.
 */
export async function clearUserTokens(stravaId: number): Promise<void> {
  await executeWrite(
    `UPDATE users 
     SET access_token = NULL, refresh_token = NULL, token_expires_at = NULL
     WHERE strava_id = ?`,
    [stravaId]
  );
  console.log(`[DB] Cleared tokens for user ${stravaId}`);
}

/**
 * Get cached athlete info for a user.
 * WHY: Used during session restoration to avoid extra Strava API call.
 * If athlete info is cached, client can send it to restore-session endpoint
 * and skip the /api/v3/athlete API call.
 * See ADR 013 (2026-02-17 Update) and TICKET-024.
 * 
 * @param stravaId - Strava athlete ID
 * @returns Cached athlete info if all fields are present, null otherwise
 */
export function getCachedAthleteInfo(stravaId: number): CachedAthleteInfo | null {
  const database = getDatabase();
  
  const result = database.exec(
    'SELECT firstname, lastname, profile FROM users WHERE strava_id = ? LIMIT 1',
    [stravaId]
  );

  if (result.length === 0 || result[0].values.length === 0) {
    return null;
  }

  const row = result[0].values[0];
  const firstname = row[0] as string | null;
  const lastname = row[1] as string | null;
  const profile = row[2] as string | null;

  // WHY: Only return if all fields are present to ensure complete cache
  if (firstname && lastname && profile) {
    return { firstname, lastname, profile };
  }

  return null;
}

/**
 * Check if database is initialized.
 * WHY: Used by auth-persistence to safely check for stored tokens before DB is ready.
 */
export function isDatabaseInitialized(): boolean {
  return isInitialized && db !== null;
}

// ============================================
// Data Reset Operations (TICKET-016)
// ============================================

/**
 * Clear all user data while preserving authentication and area definitions.
 * 
 * WHY: Users need a way to reset when experiencing data issues (stale data, 
 * tier inconsistencies, corruption). This function clears synced activities 
 * and analysis results but preserves:
 * - User authentication tokens (users table - only clears activity data)
 * - Area definitions (areas table - seeded from GeoJSON)
 * 
 * See ADR 004 "Database Reset" section for rationale.
 * See TICKET-016 for implementation requirements.
 * 
 * @param userId - Database user ID (not Strava ID) to clear data for
 */
export async function clearUserData(userId: number): Promise<void> {
  const database = getDatabase();
  
  database.run('BEGIN TRANSACTION');
  try {
    // WHY: Delete in order respecting foreign key constraints
    // 1. deviations → references walk_analyses
    // 2. walk_analyses → references walks and areas
    // 3. area_completions → references walks and areas
    // 4. walks → main activity data
    
    // Step 1: Delete deviations for this user's walk analyses
    database.run(`
      DELETE FROM deviations 
      WHERE walk_analysis_id IN (
        SELECT wa.id FROM walk_analyses wa
        JOIN walks w ON wa.walk_id = w.id
        WHERE w.user_id = ?
      )
    `, [userId]);
    
    // Step 2: Delete walk analyses for this user's walks
    database.run(`
      DELETE FROM walk_analyses 
      WHERE walk_id IN (
        SELECT id FROM walks WHERE user_id = ?
      )
    `, [userId]);
    
    // Step 3: Delete area completions for this user
    database.run('DELETE FROM area_completions WHERE user_id = ?', [userId]);
    
    // Step 4: Delete walks for this user
    database.run('DELETE FROM walks WHERE user_id = ?', [userId]);
    
    // Step 5: Reset sync timestamp so next load does a full sync
    database.run(`
      UPDATE users 
      SET last_activity_sync_at = NULL, last_synced_activity_id = NULL
      WHERE id = ?
    `, [userId]);
    
    database.run('COMMIT');
    await persistDatabase();
    
    console.log(`[DB] Cleared all data for user ${userId}`);
  } catch (e) {
    database.run('ROLLBACK');
    console.error('[DB] Failed to clear user data:', e);
    throw e;
  }
}

// ============================================
// Incremental Sync Operations (TICKET-016)
// ============================================

/**
 * Sync timestamp data returned by getLastSyncTimestamp.
 */
export interface SyncTimestamp {
  lastSyncAt: string | null;      // ISO timestamp of last successful sync
  lastActivityId: number | null;  // Most recent activity ID synced
}

/**
 * Get the last activity sync timestamp for a user.
 * 
 * WHY: Enables incremental sync - only fetch activities newer than this timestamp
 * from Strava API using the 'after' parameter. This dramatically reduces API calls
 * and provides instant page loads for returning users.
 * 
 * See ADR 004 "Incremental Activity Sync" section for rationale.
 * 
 * @param userId - Database user ID
 * @returns Sync timestamp data, or null values if never synced
 */
export function getLastSyncTimestamp(userId: number): SyncTimestamp {
  const database = getDatabase();
  
  const result = database.exec(
    'SELECT last_activity_sync_at, last_synced_activity_id FROM users WHERE id = ?',
    [userId]
  );
  
  if (result.length === 0 || result[0].values.length === 0) {
    return { lastSyncAt: null, lastActivityId: null };
  }
  
  const row = result[0].values[0];
  return {
    lastSyncAt: row[0] as string | null,
    lastActivityId: row[1] as number | null,
  };
}

/**
 * Update the last sync timestamp after a successful activity fetch.
 * 
 * WHY: Called after successfully fetching activities from Strava API.
 * The timestamp is used for the next incremental sync to only fetch new activities.
 * 
 * @param userId - Database user ID
 * @param syncTimestamp - ISO timestamp of when sync completed
 * @param newestActivityId - ID of the newest activity fetched (optional)
 */
export async function updateLastSync(
  userId: number,
  syncTimestamp: string,
  newestActivityId?: number
): Promise<void> {
  await executeWrite(
    `UPDATE users 
     SET last_activity_sync_at = ?, last_synced_activity_id = ?
     WHERE id = ?`,
    [syncTimestamp, newestActivityId ?? null, userId]
  );
  console.log(`[DB] Updated sync timestamp for user ${userId}: ${syncTimestamp}`);
}

// ============================================
// Achievement Queries (TICKET-023)
// ============================================

/**
 * Get all user achievements (unlocked).
 * WHY: Returns map of achievement_id -> unlock info for fast lookup.
 */
export function getUserAchievements(userId: number): Map<string, { unlockedAt: string }> {
  const database = getDatabase();
  
  const result = database.exec(
    'SELECT achievement_id, unlocked_at FROM user_achievements WHERE user_id = ?',
    [userId]
  );
  
  const achievements = new Map<string, { unlockedAt: string }>();
  
  if (result.length > 0) {
    for (const row of result[0].values) {
      achievements.set(row[0] as string, {
        unlockedAt: row[1] as string,
      });
    }
  }
  
  return achievements;
}

/**
 * Unlock an achievement for a user.
 * WHY: Records the unlock with timestamp for display in achievement browser.
 */
export async function unlockAchievement(
  userId: number,
  achievementId: string
): Promise<void> {
  await executeWrite(
    `INSERT OR IGNORE INTO user_achievements (user_id, achievement_id, unlocked_at)
     VALUES (?, ?, datetime('now'))`,
    [userId, achievementId]
  );
  console.log(`[DB] Unlocked achievement ${achievementId} for user ${userId}`);
}

/**
 * Check if a user has a specific achievement.
 */
export function hasAchievement(userId: number, achievementId: string): boolean {
  const database = getDatabase();
  
  const result = database.exec(
    'SELECT 1 FROM user_achievements WHERE user_id = ? AND achievement_id = ? LIMIT 1',
    [userId, achievementId]
  );
  
  return result.length > 0 && result[0].values.length > 0;
}

/**
 * Get count of unlocked achievements for a user.
 */
export function getUnlockedAchievementCount(userId: number): number {
  const database = getDatabase();
  
  const result = database.exec(
    'SELECT COUNT(*) FROM user_achievements WHERE user_id = ?',
    [userId]
  );
  
  if (result.length === 0 || result[0].values.length === 0) {
    return 0;
  }
  
  return result[0].values[0][0] as number;
}

/**
 * Get completed area IDs with their perimeters for a user.
 * WHY: Needed for achievement condition evaluation (size-based achievements).
 */
export function getCompletedAreasWithPerimeter(userId: number): Map<number, number> {
  const database = getDatabase();
  
  const result = database.exec(
    `SELECT a.fid, a.perimeter_meters 
     FROM areas a
     INNER JOIN area_completions ac ON a.id = ac.area_id
     WHERE ac.user_id = ?`,
    [userId]
  );
  
  const areas = new Map<number, number>();
  
  if (result.length > 0) {
    for (const row of result[0].values) {
      areas.set(row[0] as number, row[1] as number);
    }
  }
  
  return areas;
}

/**
 * Get the smallest area by perimeter (FID).
 * WHY: Needed for "Bite Sized" achievement.
 */
export function getSmallestAreaFid(): number | null {
  const database = getDatabase();
  
  const result = database.exec(
    'SELECT fid FROM areas ORDER BY perimeter_meters ASC LIMIT 1'
  );
  
  if (result.length === 0 || result[0].values.length === 0) {
    return null;
  }
  
  return result[0].values[0][0] as number;
}

/**
 * Get the area FID containing Malmö's geographic center.
 * WHY: Needed for "The Centered" hidden achievement.
 * Malmö center is approximately 55.6050°N, 13.0038°E
 */
export function getCenterAreaFid(): number | null {
  const database = getDatabase();
  
  // WHY: This requires checking which polygon contains the center point
  // We'll compute this by checking each area - expensive but only done once
  // The result should be cached by the caller
  const result = database.exec(
    'SELECT fid, geometry_json FROM areas'
  );
  
  if (result.length === 0) {
    return null;
  }
  
  // Malmö center coordinates
  const centerLng = 13.0038;
  const centerLat = 55.6050;
  
  // WHY: We need to check which polygon contains this point
  // This is done synchronously since it's a one-time computation
  for (const row of result[0].values) {
    const fid = row[0] as number;
    const geometryJson = row[1] as string;
    
    try {
      const geometry = JSON.parse(geometryJson);
      
      // Simple point-in-polygon check for the center
      // WHY: Using a simplified check - we'll use Turf.js in the service layer for accuracy
      if (geometry.type === 'Polygon') {
        // Check if center is roughly within bounding box as a quick filter
        const coords = geometry.coordinates[0];
        let minLng = Infinity, maxLng = -Infinity;
        let minLat = Infinity, maxLat = -Infinity;
        
        for (const [lng, lat] of coords) {
          minLng = Math.min(minLng, lng);
          maxLng = Math.max(maxLng, lng);
          minLat = Math.min(minLat, lat);
          maxLat = Math.max(maxLat, lat);
        }
        
        if (centerLng >= minLng && centerLng <= maxLng &&
            centerLat >= minLat && centerLat <= maxLat) {
          // WHY: More accurate check will be done in achievement service with Turf.js
          // For now, return the first area whose bounding box contains the center
          // The actual point-in-polygon check happens in achievement-service.ts
          return fid;
        }
      }
    } catch {
      // Skip invalid geometry
    }
  }
  
  return null;
}

/**
 * Close the database connection.
 * Call when unmounting the app.
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
    isInitialized = false;
  }
}

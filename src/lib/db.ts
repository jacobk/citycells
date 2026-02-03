/**
 * CityCells Database Module
 * 
 * SQLite database using sql.js (WebAssembly) with IndexedDB persistence.
 * See ADR 004 for architecture decision and schema details.
 * 
 * @module db
 */

import initSqlJs, { Database, SqlJsStatic } from 'sql.js';

// ============================================
// Constants
// ============================================

// WHY: IndexedDB database and store names for persistence
// Using a consistent name allows data to persist across sessions
const INDEXEDDB_NAME = 'citycells-db';
const INDEXEDDB_STORE = 'database';

// WHY: Schema version for migrations - increment when schema changes
const SCHEMA_VERSION = 1;

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
}

export type Tier = 'platinum' | 'gold' | 'silver' | 'bronze';

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
  tier TEXT CHECK(tier IN ('platinum', 'gold', 'silver', 'bronze')),
  
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

  // WHY: Lazy load sql.js to avoid blocking initial page render
  // The WASM file is ~1MB, so we only load it when needed
  if (!SQL) {
    SQL = await initSqlJs({
      locateFile: (file: string) => `/sql-wasm/${file}`
    });
  }

  // Try to restore from IndexedDB
  const savedData = await loadFromIndexedDB();
  
  if (savedData) {
    db = new SQL.Database(savedData);
    console.log('[DB] Restored database from IndexedDB');
  } else {
    db = new SQL.Database();
    console.log('[DB] Created new database');
  }

  // Run schema creation (IF NOT EXISTS makes this safe to run repeatedly)
  db.run(SCHEMA_SQL);

  // Check and update schema version
  const versionResult = db.exec('SELECT version FROM schema_version LIMIT 1');
  const currentVersion = versionResult.length > 0 ? versionResult[0].values[0][0] as number : 0;
  
  if (currentVersion < SCHEMA_VERSION) {
    // Run migrations here when needed
    db.run('INSERT OR REPLACE INTO schema_version (version) VALUES (?)', [SCHEMA_VERSION]);
    await persistDatabase();
  }

  // Seed areas if empty
  const areasCount = db.exec('SELECT COUNT(*) FROM areas');
  if (areasCount[0].values[0][0] === 0) {
    await seedAreasFromGeoJSON();
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
  params?: (string | number | null | Uint8Array)[]
): Promise<void> {
  const database = getDatabase();
  
  database.run('BEGIN TRANSACTION');
  try {
    database.run(sql, params);
    database.run('COMMIT');
    await persistDatabase();
  } catch (e) {
    database.run('ROLLBACK');
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

  db.run('BEGIN TRANSACTION');
  
  try {
    for (const feature of geoData.features) {
      if (!feature.geometry || 
          (feature.geometry.type !== 'Polygon' && feature.geometry.type !== 'MultiPolygon')) {
        continue;
      }

      const fid = feature.properties?.FID;
      const name = feature.properties?.delomr || 'Unknown';
      
      if (fid === undefined || fid === null) {
        continue;
      }

      // Calculate perimeter
      const perimeterLine = turf.polygonToLine(feature);
      let perimeterMeters: number;
      
      if (perimeterLine.type === 'FeatureCollection') {
        // WHY: MultiPolygon returns FeatureCollection, sum all perimeters
        perimeterMeters = perimeterLine.features.reduce((sum, f) => {
          return sum + turf.length(f, { units: 'meters' });
        }, 0);
      } else {
        perimeterMeters = turf.length(perimeterLine, { units: 'meters' });
      }

      // Calculate area
      const areaSqm = turf.area(feature);

      // Store geometry as JSON string
      const geometryJson = JSON.stringify(feature.geometry);

      db.run(
        `INSERT OR IGNORE INTO areas (fid, name, perimeter_meters, area_sqm, geometry_json) 
         VALUES (?, ?, ?, ?, ?)`,
        [fid, name, perimeterMeters, areaSqm, geometryJson]
      );
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
      SUM(CASE WHEN ac.tier = 'bronze' THEN 1 ELSE 0 END) as bronze_count
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
  };
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

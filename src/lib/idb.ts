/**
 * IndexedDB wrapper for CityCells persistence.
 * WHY: Replaces sql.js (WASM SQLite) which froze iPhones due to synchronous
 * main-thread queries. IndexedDB is async by design. See ADR 026.
 *
 * Zero external dependencies. ~150 lines.
 */

const DB_NAME = 'citycells-v2';
const DB_VERSION = 1;

// WHY: Singleton connection. IndexedDB.open() is cheap but we cache
// the result to avoid repeated onupgradeneeded checks.
let dbInstance: IDBDatabase | null = null;
let dbPromise: Promise<IDBDatabase> | null = null;

function createSchema(db: IDBDatabase): void {
  // users — keyed by Strava ID (single user per device)
  db.createObjectStore('users', { keyPath: 'stravaId' });

  // walks — keyed by Strava activity ID
  const walks = db.createObjectStore('walks', { keyPath: 'stravaActivityId' });
  walks.createIndex('userId', 'userId', { unique: false });

  // walkStreams — GPS data separated from walks for query performance
  db.createObjectStore('walkStreams', { keyPath: 'stravaActivityId' });

  // walkAnalyses — analysis metrics per walk-area pair
  const analyses = db.createObjectStore('walkAnalyses', { keyPath: 'id', autoIncrement: true });
  analyses.createIndex('walkId', 'walkId', { unique: false });
  analyses.createIndex('areaFid', 'areaFid', { unique: false });
  analyses.createIndex('walkId_areaFid', ['walkId', 'areaFid'], { unique: true });

  // deviations — boundary deviations per analysis
  const deviations = db.createObjectStore('deviations', { keyPath: 'id', autoIncrement: true });
  deviations.createIndex('walkAnalysisId', 'walkAnalysisId', { unique: false });

  // areaCompletions — denormalized for fast loadCachedAnalyses
  // WHY: keyPath is areaFid (one completion per area). Embeds display
  // metrics so loadCachedAnalyses is a single index scan with zero joins.
  const completions = db.createObjectStore('areaCompletions', { keyPath: 'areaFid' });
  completions.createIndex('userId', 'userId', { unique: false });

  // userAchievements — achievement unlock records
  const achievements = db.createObjectStore('userAchievements', { keyPath: ['userId', 'achievementId'] });
  achievements.createIndex('userId', 'userId', { unique: false });
}

export async function openDatabase(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance;
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      createSchema(request.result);
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      // WHY: Reset singleton if browser closes the connection (e.g., storage pressure)
      dbInstance.onclose = () => {
        dbInstance = null;
        dbPromise = null;
      };
      resolve(dbInstance);
    };

    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
  });

  return dbPromise;
}

// WHY: Clean up old sql.js database on first load after migration
export async function deleteOldDatabase(): Promise<void> {
  return new Promise((resolve) => {
    const request = indexedDB.deleteDatabase('citycells-db');
    request.onsuccess = () => resolve();
    request.onerror = () => resolve(); // Don't fail if it doesn't exist
    request.onblocked = () => resolve();
  });
}

// ============================================
// Generic CRUD helpers — typed, promise-based
// ============================================

export async function get<T>(storeName: string, key: IDBValidKey): Promise<T | undefined> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const request = tx.objectStore(storeName).get(key);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error);
  });
}

export async function getAll<T>(storeName: string): Promise<T[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const request = tx.objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllFromIndex<T>(
  storeName: string,
  indexName: string,
  key: IDBValidKey,
): Promise<T[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const request = tx.objectStore(storeName).index(indexName).getAll(key);
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
  });
}

export async function put<T>(storeName: string, value: T): Promise<IDBValidKey> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const request = tx.objectStore(storeName).put(value);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function del(storeName: string, key: IDBValidKey): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const request = tx.objectStore(storeName).delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function clear(storeName: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const request = tx.objectStore(storeName).clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// WHY: Multi-store transactions for atomic operations (e.g., saveWalkAnalysis)
export async function openTransaction(
  storeNames: string[],
  mode: IDBTransactionMode = 'readwrite',
): Promise<IDBTransaction> {
  const db = await openDatabase();
  return db.transaction(storeNames, mode);
}

// WHY: Helper for transaction-scoped reads (avoids opening a new tx per read)
export function txGet<T>(tx: IDBTransaction, storeName: string, key: IDBValidKey): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const request = tx.objectStore(storeName).get(key);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error);
  });
}

export function txGetAllFromIndex<T>(
  tx: IDBTransaction,
  storeName: string,
  indexName: string,
  key: IDBValidKey,
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const request = tx.objectStore(storeName).index(indexName).getAll(key);
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
  });
}

export function txPut<T>(tx: IDBTransaction, storeName: string, value: T): Promise<IDBValidKey> {
  return new Promise((resolve, reject) => {
    const request = tx.objectStore(storeName).put(value);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function txDelete(tx: IDBTransaction, storeName: string, key: IDBValidKey): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = tx.objectStore(storeName).delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Transaction aborted'));
  });
}

export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
    dbPromise = null;
  }
}

export function isDatabaseOpen(): boolean {
  return dbInstance !== null;
}

/**
 * CityCells Database Module (IndexedDB)
 *
 * Async persistence layer built on native IndexedDB via `@/lib/idb`.
 * Replaces the sql.js (WASM SQLite) implementation which froze iPhones.
 * See ADR 026 for the migration decision and schema mapping.
 *
 * WHY: Big-bang migration (no data migration). Old sql.js database is deleted
 * on first load via `deleteOldDatabase()`. Users re-sync from Strava.
 *
 * @module db
 */

import {
  openDatabase,
  deleteOldDatabase,
  isDatabaseOpen,
  closeDatabase as idbClose,
  get,
  put,
  getAll,
  getAllFromIndex,
  del,
  clear,
  openTransaction,
  txGet,
  txGetAllFromIndex,
  txPut,
  txDelete,
  txDone,
} from '@/lib/idb';
import type { TierDistribution } from '@/lib/distance-tiers';

// ============================================
// Record types for IndexedDB stores
// ============================================

export interface UserRecord {
  stravaId: number;
  username: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiresAt: number | null;
  firstname: string | null;
  lastname: string | null;
  profile: string | null;
  lastActivitySyncAt: string | null;
  lastSyncedActivityId: number | null;
  createdAt: string;
}

export interface WalkRecord {
  stravaActivityId: number;
  userId: number;
  name: string | null;
  totalDistanceMeters: number | null;
  polyline: string;
  startLat: number | null;
  startLng: number | null;
  endLat: number | null;
  endLng: number | null;
  startedAt: string | null;
  syncedAt: string;
}

export interface WalkStreamsRecord {
  stravaActivityId: number;
  latlng: [number, number][];
  time?: number[];
  distance?: number[];
  fetchedAt: string;
  pointCount: number;
}

export interface WalkAnalysisRecord {
  id?: number; // auto-increment
  walkId: number; // stravaActivityId
  areaFid: number;
  perimeterCoveragePercent: number;
  coveredDistanceMeters: number;
  rmseMeters: number | null;
  maxDeviationMeters: number | null;
  p90DeviationMeters: number | null;
  efficiency: number | null;
  areaCoveragePercent: number | null;
  enclosedAreaSqm: number | null;
  isClosedLoop: boolean;
  loopGapMeters: number | null;
  rawQualityScore: number | null;
  qualityScore: number | null;
  tier: string | null;
  tieredBorderScore: number | null;
  tierDistribution: TierDistribution | null;
  isPrimaryMatch: boolean;
  analyzedAt: string;
}

export interface DeviationRecord {
  id?: number; // auto-increment
  walkAnalysisId: number;
  startPointIndex: number;
  endPointIndex: number;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  startBorderLat: number;
  startBorderLng: number;
  endBorderLat: number;
  endBorderLng: number;
  borderGapMeters: number;
  detourDistanceMeters: number;
  maxDeviationMeters: number;
  returnAccuracyMeters: number;
  detourRatio: number;
  classification: string;
  isExempt: boolean;
  exemptionReason: string | null;
  exemptedAt: string | null;
}

export interface AreaCompletionRecord {
  areaFid: number; // keyPath
  userId: number;
  bestWalkAnalysisId: number;
  bestQualityScore: number;
  tier: string | null;
  totalWalks: number;
  totalExemptions: number;
  firstCompletedAt: string;
  bestCompletedAt: string;
  // WHY: Denormalized for fast loadCachedAnalyses — avoids joins across stores
  activityIds: number[];
  activityPolylines: Record<number, string>; // activityId -> polyline
  cachedMetrics: CachedMetricsBlob;
}

/**
 * Shape of `cachedMetrics` embedded in AreaCompletionRecord.
 * Matches `CachedMetrics` from analysis-persistence.ts so loadCachedAnalyses
 * can return it directly without transformation.
 */
export interface CachedMetricsBlob {
  perimeterCoveragePercent: number;
  areaCoveragePercent: number;
  rawQualityScore: number;
  tier: string | null;
  isClosedLoop: boolean;
  coveredDistanceMeters: number;
  rmseMeters: number;
  maxDeviationMeters: number;
  p90DeviationMeters: number;
  efficiency: number;
  enclosedAreaSqm: number;
  loopGapMeters: number;
  tieredBorderScore: number;
  tierDistribution: TierDistribution;
  walkFocus: number;
}

export interface UserAchievementRecord {
  userId: number;
  achievementId: string;
  unlockedAt: string;
}

// ============================================
// Legacy types — preserved for backward compatibility
// ============================================

// WHY: AreaRow is kept as an export so modules like adjacency.ts that reference
// the type still compile. Areas no longer live in DB — they come from GeoJSON.
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

// WHY: UserRow kept with original snake_case field names so existing callers
// (auth-persistence.ts, Map.tsx) can continue working until they migrate.
export interface UserRow {
  id: number;
  strava_id: number;
  username: string | null;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: number | null;
  firstname: string | null;
  lastname: string | null;
  profile: string | null;
  created_at: string;
}

export interface TokenData {
  access_token: string;
  refresh_token: string;
  token_expires_at: number; // Unix timestamp in seconds
}

export interface CachedAthleteInfo {
  firstname: string;
  lastname: string;
  profile: string;
}

export interface SyncTimestamp {
  lastSyncAt: string | null;
  lastActivityId: number | null;
}

// ============================================
// Re-analysis types (preserved for analysis-persistence.ts)
// ============================================

export type ReAnalysisMode = 'rescore' | 'full';

export interface ReAnalysisProgress {
  current: number;
  total: number;
  currentWalkName: string;
  status: 'running' | 'complete' | 'error';
  error?: string;
}

export interface ReAnalysisResult {
  success: boolean;
  walksProcessed: number;
  errors: Array<{ walkId: number; activityId: number; error: string }>;
}

export interface CachedWalkInfo {
  walkId: number;
  stravaActivityId: number;
  name: string | null;
  hasStreams: boolean;
  analyzedAreaCount: number;
}

// ============================================
// Initialization
// ============================================

/**
 * Initialize the IndexedDB database.
 * WHY: Opens (or creates) the IndexedDB store and cleans up the old sql.js
 * database. Returns void — there is no Database object to pass around.
 */
export async function initDatabase(): Promise<void> {
  await openDatabase();
  // WHY: Fire-and-forget cleanup of old sql.js IndexedDB ('citycells-db').
  // Runs on every init but is cheap (deleteDatabase on a non-existent DB is a no-op).
  deleteOldDatabase().catch((e) =>
    console.warn('[DB] Failed to delete old sql.js database:', e),
  );
  console.log('[DB] IndexedDB initialized');
}

/**
 * Check if database is initialized.
 * WHY: Used by auth-persistence to safely check for stored tokens before DB is ready.
 */
export function isDatabaseInitialized(): boolean {
  return isDatabaseOpen();
}

/**
 * Close the database connection.
 * WHY: Called on unmount to release IndexedDB connection.
 */
export function closeDatabase(): void {
  idbClose();
}

// ============================================
// Internal helpers
// ============================================

/**
 * Convert a UserRecord to the legacy UserRow format.
 * WHY: Existing callers (auth-persistence.ts) expect snake_case fields.
 * This bridge avoids a multi-file migration in one step.
 */
function toUserRow(r: UserRecord): UserRow {
  return {
    // WHY: Legacy UserRow has an `id` field (SQLite auto-increment).
    // IndexedDB uses stravaId as the keyPath. We map stravaId -> id so
    // callers that relied on `user.id` for foreign keys still work.
    id: r.stravaId,
    strava_id: r.stravaId,
    username: r.username,
    access_token: r.accessToken,
    refresh_token: r.refreshToken,
    token_expires_at: r.tokenExpiresAt,
    firstname: r.firstname,
    lastname: r.lastname,
    profile: r.profile,
    created_at: r.createdAt,
  };
}

// ============================================
// User Token Operations (ADR 013)
// ============================================

/**
 * Get a user by their Strava ID.
 * WHY: Used to check for existing user with stored tokens on page load.
 * See ADR 013 for the returning user flow.
 */
export async function getUserByStravaId(stravaId: number): Promise<UserRow | null> {
  const record = await get<UserRecord>('users', stravaId);
  if (!record) return null;
  return toUserRow(record);
}

/**
 * Update tokens for a user (create if not exists).
 * WHY: Called after OAuth callback and token refresh to persist tokens.
 * See ADR 013 "Token Storage Strategy" section.
 *
 * @returns The user's Strava ID (acts as the user ID in IndexedDB).
 */
export async function updateUserTokens(
  stravaId: number,
  tokens: TokenData,
  username?: string,
  athleteInfo?: CachedAthleteInfo,
): Promise<number> {
  const existing = await get<UserRecord>('users', stravaId);

  const record: UserRecord = {
    stravaId,
    username: username ?? existing?.username ?? null,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    tokenExpiresAt: tokens.token_expires_at,
    firstname: athleteInfo?.firstname ?? existing?.firstname ?? null,
    lastname: athleteInfo?.lastname ?? existing?.lastname ?? null,
    profile: athleteInfo?.profile ?? existing?.profile ?? null,
    lastActivitySyncAt: existing?.lastActivitySyncAt ?? null,
    lastSyncedActivityId: existing?.lastSyncedActivityId ?? null,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  };

  await put('users', record);
  console.log(`[DB] ${existing ? 'Updated' : 'Created'} user ${stravaId}${athleteInfo ? ' (with athlete cache)' : ''}`);
  return stravaId;
}

/**
 * Clear tokens for a user (logout).
 * WHY: On logout, clear tokens but keep user record for potential re-auth.
 * See ADR 013 "User logout" in Token Lifecycle.
 */
export async function clearUserTokens(stravaId: number): Promise<void> {
  const existing = await get<UserRecord>('users', stravaId);
  if (!existing) return;

  existing.accessToken = null;
  existing.refreshToken = null;
  existing.tokenExpiresAt = null;
  await put('users', existing);
  console.log(`[DB] Cleared tokens for user ${stravaId}`);
}

/**
 * Get cached athlete info for a user.
 * WHY: Used during session restoration to avoid extra Strava API call.
 * See ADR 013 (2026-02-17 Update) and TICKET-024.
 */
export async function getCachedAthleteInfo(stravaId: number): Promise<CachedAthleteInfo | null> {
  const record = await get<UserRecord>('users', stravaId);
  if (!record) return null;

  // WHY: Only return if all fields are present to ensure complete cache
  if (record.firstname && record.lastname && record.profile) {
    return {
      firstname: record.firstname,
      lastname: record.lastname,
      profile: record.profile,
    };
  }
  return null;
}

// ============================================
// Walk Operations
// ============================================

/**
 * Save stream data for a walk.
 * WHY: Streams are stored separately from walks for query performance —
 * loading a walk list shouldn't pull megabytes of GPS data.
 */
export async function saveWalkStreams(
  stravaActivityId: number,
  streams: { latlng: [number, number][]; time?: number[]; distance?: number[]; fetchedAt: string; pointCount: number },
): Promise<void> {
  const record: WalkStreamsRecord = {
    stravaActivityId,
    latlng: streams.latlng,
    time: streams.time,
    distance: streams.distance,
    fetchedAt: streams.fetchedAt,
    pointCount: streams.pointCount,
  };
  await put('walkStreams', record);
}

/**
 * Get cached streams for a walk by Strava activity ID.
 */
export async function getWalkStreams(
  stravaActivityId: number,
): Promise<{ latlng: [number, number][]; time?: number[]; distance?: number[]; fetchedAt: string; pointCount: number } | null> {
  const record = await get<WalkStreamsRecord>('walkStreams', stravaActivityId);
  if (!record || record.latlng.length === 0) return null;
  return record;
}

/**
 * Check if streams should be fetched for an activity.
 */
export async function needsStreamsFetch(stravaActivityId: number): Promise<boolean> {
  const record = await get<WalkStreamsRecord>('walkStreams', stravaActivityId);
  return !record || !record.fetchedAt || record.pointCount <= 0;
}

/**
 * Get walk database ID for a Strava activity.
 * WHY: In IndexedDB the walk key IS the stravaActivityId, so this is trivial.
 * Returns stravaActivityId if the walk exists, null otherwise.
 */
export async function getWalkIdByActivityId(stravaActivityId: number): Promise<number | null> {
  const record = await get<WalkRecord>('walks', stravaActivityId);
  return record ? record.stravaActivityId : null;
}

/**
 * Alias preserved for callers that used the longer name.
 */
export const getWalkIdByStravaActivityId = getWalkIdByActivityId;

// ============================================
// User Progress
// ============================================

/**
 * Get user progress summary.
 * WHY: Computes progress from areaCompletions store. The total_areas count
 * is no longer from a DB table — caller must provide it or we return 0.
 */
export async function getUserProgress(userId: number, totalAreas?: number): Promise<UserProgressRow | null> {
  const user = await get<UserRecord>('users', userId);
  if (!user) return null;

  const completions = await getAllFromIndex<AreaCompletionRecord>('areaCompletions', 'userId', userId);
  const total = totalAreas ?? 0;

  const tierCounts = { platinum: 0, gold: 0, silver: 0, bronze: 0, potato: 0 };
  for (const c of completions) {
    const t = c.tier as keyof typeof tierCounts;
    if (t in tierCounts) tierCounts[t]++;
  }

  return {
    user_id: userId,
    username: user.username,
    completed_areas: completions.length,
    total_areas: total,
    completion_percent: total > 0 ? Math.round((completions.length * 1000) / total) / 10 : 0,
    platinum_count: tierCounts.platinum,
    gold_count: tierCounts.gold,
    silver_count: tierCounts.silver,
    bronze_count: tierCounts.bronze,
    potato_count: tierCounts.potato,
  };
}

// ============================================
// Distance Metrics (Ticket 012)
// ============================================

/**
 * Get theoretical distance (sum of perimeters for completed areas).
 * WHY: In the IndexedDB world, perimeters come from GeoJSON at runtime.
 * The caller must supply a fid->perimeter lookup. We sum over completed areas.
 */
export async function getTheoreticalDistance(
  userId: number,
  perimeterLookup: Map<number, number>,
): Promise<number> {
  const completions = await getAllFromIndex<AreaCompletionRecord>('areaCompletions', 'userId', userId);
  let total = 0;
  for (const c of completions) {
    total += perimeterLookup.get(c.areaFid) ?? 0;
  }
  return total;
}

/**
 * Get actual walked distance (sum of all walk distances for user).
 * WHY: Uses totalDistanceMeters from walks store (Strava's distance field).
 */
export async function getActualWalkedDistance(userId: number): Promise<number> {
  const walks = await getAllFromIndex<WalkRecord>('walks', 'userId', userId);
  let total = 0;
  for (const w of walks) {
    total += w.totalDistanceMeters ?? 0;
  }
  return total;
}

// ============================================
// Incremental Sync Operations (TICKET-016)
// ============================================

/**
 * Get the last activity sync timestamp for a user.
 * WHY: Enables incremental sync — only fetch activities newer than this timestamp.
 */
export async function getLastSyncTimestamp(userId: number): Promise<SyncTimestamp> {
  const record = await get<UserRecord>('users', userId);
  if (!record) return { lastSyncAt: null, lastActivityId: null };
  return {
    lastSyncAt: record.lastActivitySyncAt,
    lastActivityId: record.lastSyncedActivityId,
  };
}

/**
 * Update the last sync timestamp after a successful activity fetch.
 */
export async function updateLastSync(
  userId: number,
  syncTimestamp: string,
  newestActivityId?: number,
): Promise<void> {
  const record = await get<UserRecord>('users', userId);
  if (!record) return;

  record.lastActivitySyncAt = syncTimestamp;
  record.lastSyncedActivityId = newestActivityId ?? record.lastSyncedActivityId;
  await put('users', record);
  console.log(`[DB] Updated sync timestamp for user ${userId}: ${syncTimestamp}`);
}

// ============================================
// Achievement Operations (TICKET-023)
// ============================================

/**
 * Get all user achievements (unlocked).
 * WHY: Returns map of achievement_id -> unlock info for fast lookup.
 */
export async function getUserAchievements(userId: number): Promise<Map<string, { unlockedAt: string }>> {
  const records = await getAllFromIndex<UserAchievementRecord>('userAchievements', 'userId', userId);
  const map = new Map<string, { unlockedAt: string }>();
  for (const r of records) {
    map.set(r.achievementId, { unlockedAt: r.unlockedAt });
  }
  return map;
}

/**
 * Unlock an achievement for a user.
 * WHY: Records the unlock with timestamp for display in achievement browser.
 */
export async function unlockAchievement(userId: number, achievementId: string): Promise<void> {
  // WHY: userAchievements has compound keyPath [userId, achievementId],
  // so put() will no-op if the record already exists (same key = overwrite with same data).
  const record: UserAchievementRecord = {
    userId,
    achievementId,
    unlockedAt: new Date().toISOString(),
  };
  await put('userAchievements', record);
  console.log(`[DB] Unlocked achievement ${achievementId} for user ${userId}`);
}

/**
 * Check if a user has a specific achievement.
 */
export async function hasAchievement(userId: number, achievementId: string): Promise<boolean> {
  // WHY: Compound keyPath in userAchievements is [userId, achievementId]
  const record = await get<UserAchievementRecord>('userAchievements', [userId, achievementId]);
  return record !== undefined;
}

/**
 * Get count of unlocked achievements for a user.
 */
export async function getUnlockedAchievementCount(userId: number): Promise<number> {
  const records = await getAllFromIndex<UserAchievementRecord>('userAchievements', 'userId', userId);
  return records.length;
}

/**
 * Get completed area FIDs with their perimeters for a user.
 * WHY: Needed for achievement condition evaluation (size-based achievements).
 * Perimeters come from GeoJSON at runtime — caller supplies the lookup.
 */
export async function getCompletedAreasWithPerimeter(
  userId: number,
  perimeterLookup: Map<number, number>,
): Promise<Map<number, number>> {
  const completions = await getAllFromIndex<AreaCompletionRecord>('areaCompletions', 'userId', userId);
  const result = new Map<number, number>();
  for (const c of completions) {
    const perimeter = perimeterLookup.get(c.areaFid);
    if (perimeter !== undefined) {
      result.set(c.areaFid, perimeter);
    }
  }
  return result;
}

// ============================================
// Export / Import for Backup
// ============================================

const ALL_STORES = ['users', 'walks', 'walkStreams', 'walkAnalyses', 'deviations', 'areaCompletions', 'userAchievements'] as const;

/**
 * Export the database as a downloadable JSON blob.
 * WHY: Allows users to backup their progress since data is stored locally.
 */
export async function exportDatabase(): Promise<Blob> {
  const data: Record<string, unknown[]> = {};

  for (const store of ALL_STORES) {
    data[store] = await getAll(store);
  }

  const json = JSON.stringify(data, null, 2);
  return new Blob([json], { type: 'application/json' });
}

/**
 * Import a database from a JSON file.
 * WHY: Allows users to restore their progress from a backup.
 * Warning: This replaces all existing data!
 */
export async function importDatabase(file: File): Promise<void> {
  const text = await file.text();
  let data: Record<string, unknown[]>;

  try {
    data = JSON.parse(text) as Record<string, unknown[]>;
  } catch {
    throw new Error('Invalid backup file. Could not parse JSON.');
  }

  // WHY: Validate that at least the core stores are present
  if (!data.users || !data.walks) {
    throw new Error('Invalid backup file. Missing required data stores.');
  }

  // WHY: Clear all stores then write in a single multi-store transaction for atomicity
  const tx = await openTransaction([...ALL_STORES], 'readwrite');
  const done = txDone(tx);

  for (const store of ALL_STORES) {
    tx.objectStore(store).clear();
    const records = data[store] ?? [];
    for (const record of records) {
      tx.objectStore(store).put(record);
    }
  }

  await done;
  console.log('[DB] Imported database from file');
}

// ============================================
// Data Reset Operations (TICKET-016)
// ============================================

/**
 * Clear all user data while preserving authentication.
 * WHY: Users need a way to reset when experiencing data issues.
 * Clears walks, analyses, deviations, completions, achievements
 * but keeps the user record (tokens intact).
 */
export async function clearUserData(userId: number): Promise<void> {
  // WHY: Use a multi-store transaction for atomicity
  const tx = await openTransaction(
    ['walks', 'walkStreams', 'walkAnalyses', 'deviations', 'areaCompletions', 'userAchievements', 'users'],
    'readwrite',
  );
  const done = txDone(tx);

  // WHY: Get all walks for this user first so we can delete related records
  const walks = await txGetAllFromIndex<WalkRecord>(tx, 'walks', 'userId', userId);
  const walkIdList = walks.map((w) => w.stravaActivityId);
  const walkIdSet = new Set(walkIdList);

  // Delete walk streams for this user's walks
  for (let i = 0; i < walkIdList.length; i++) {
    tx.objectStore('walkStreams').delete(walkIdList[i]);
  }

  // WHY: walkAnalyses doesn't have a userId index, so we read all and filter
  // by walkId. For small datasets (<1000 analyses) this is fast enough.
  const analysesStore = tx.objectStore('walkAnalyses');
  const allAnalysesRequest = analysesStore.getAll();
  const analyses: WalkAnalysisRecord[] = await new Promise((resolve, reject) => {
    allAnalysesRequest.onsuccess = () => resolve(allAnalysesRequest.result);
    allAnalysesRequest.onerror = () => reject(allAnalysesRequest.error);
  });

  const userAnalysisIds: number[] = [];
  const userAnalysisIdSet = new Set<number>();
  for (const a of analyses) {
    if (walkIdSet.has(a.walkId)) {
      userAnalysisIds.push(a.id!);
      userAnalysisIdSet.add(a.id!);
      analysesStore.delete(a.id!);
    }
  }

  // Delete deviations for this user's analyses
  const deviationsStore = tx.objectStore('deviations');
  const allDeviationsRequest = deviationsStore.getAll();
  const deviations: DeviationRecord[] = await new Promise((resolve, reject) => {
    allDeviationsRequest.onsuccess = () => resolve(allDeviationsRequest.result);
    allDeviationsRequest.onerror = () => reject(allDeviationsRequest.error);
  });

  for (const d of deviations) {
    if (userAnalysisIdSet.has(d.walkAnalysisId)) {
      deviationsStore.delete(d.id!);
    }
  }

  // Delete area completions for this user
  const completions = await txGetAllFromIndex<AreaCompletionRecord>(tx, 'areaCompletions', 'userId', userId);
  for (const c of completions) {
    tx.objectStore('areaCompletions').delete(c.areaFid);
  }

  // Delete achievements for this user
  const achievements = await txGetAllFromIndex<UserAchievementRecord>(tx, 'userAchievements', 'userId', userId);
  for (const a of achievements) {
    tx.objectStore('userAchievements').delete([a.userId, a.achievementId]);
  }

  // Delete walks for this user
  for (let i = 0; i < walkIdList.length; i++) {
    tx.objectStore('walks').delete(walkIdList[i]);
  }

  // Reset sync timestamp
  const user = await txGet<UserRecord>(tx, 'users', userId);
  if (user) {
    user.lastActivitySyncAt = null;
    user.lastSyncedActivityId = null;
    tx.objectStore('users').put(user);
  }

  await done;
  console.log(`[DB] Cleared all data for user ${userId}`);
}

// ============================================
// Re-exported idb helpers for direct use
// ============================================

// WHY: Re-export so analysis-persistence.ts and exemptions.ts can import from
// '@/lib/db' without coupling directly to the idb module.
export {
  get,
  put,
  getAll,
  getAllFromIndex,
  del,
  clear,
  openTransaction,
  txGet,
  txGetAllFromIndex,
  txPut,
  txDelete,
  txDone,
};

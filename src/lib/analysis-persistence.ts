/**
 * Analysis Persistence Module (IndexedDB)
 *
 * Async persistence layer for walk analysis results. Replaces the synchronous
 * sql.js implementation which froze iPhones during loadCachedAnalyses().
 * See ADR 026 for the migration decision.
 *
 * WHY: All functions are now async. The critical loadCachedAnalyses() does a
 * single index scan on the denormalized areaCompletions store -- no joins.
 *
 * @module analysis-persistence
 */

import type { FullAnalysisResult, StravaMetadata } from '@/lib/analysis';
import { analyzeWalk } from '@/lib/analysis';
import { assignTier, TIER_THRESHOLDS } from '@/lib/tiers';
import type { TierDistribution } from '@/lib/distance-tiers';
import type { StravaActivity } from '@/hooks/useStrava';
import type { Position, Feature, Polygon, MultiPolygon } from 'geojson';
import type { CachedStreams } from '@/lib/types/strava-streams';
import * as turf from '@turf/turf';
import mapboxPolyline from '@mapbox/polyline';
import {
  get,
  put,
  getAll,
  getAllFromIndex,
  openTransaction,
  txGet,
  txGetAllFromIndex,
  txPut,
  txDelete,
  txDone,
  getWalkStreams,
  saveWalkStreams,
  type WalkRecord,
  type WalkAnalysisRecord,
  type DeviationRecord,
  type AreaCompletionRecord,
  type UserRecord,
  type WalkStreamsRecord,
  type CachedWalkInfo,
} from '@/lib/db';

// Re-export types that callers import from this module
export type { CachedWalkInfo };
// WHY: Import for local use + re-export for callers that import from this module
import type { ReAnalysisMode, ReAnalysisProgress, ReAnalysisResult } from '@/lib/db';
export type { ReAnalysisMode, ReAnalysisProgress, ReAnalysisResult };

// ============================================
// Types
// ============================================

/**
 * Cached metrics type returned by loadCachedAnalyses.
 * WHY: Export type for use in Map.tsx to convert to full AnalysisMetrics.
 */
export interface CachedMetrics {
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

/**
 * Cached analysis result type returned by loadCachedAnalyses.
 */
export interface CachedAnalysis {
  areaId: number;
  analysisId: number;
  metrics: CachedMetrics;
  activityIds: number[];
  // WHY: Include polylines for share feature (ADR 023)
  activityPolylines: Map<number, string>;
}

/**
 * Activity metadata from Strava for accurate loop detection during re-analysis.
 */
export interface ActivityMetadata {
  startLatLng: [number, number];
  endLatLng?: [number, number];
  distance?: number;
}

// ============================================
// Core persistence functions
// ============================================

/**
 * Get or create user ID from Strava ID.
 * WHY: In IndexedDB the user key IS the stravaId. No auto-increment ID mapping.
 */
export async function getOrCreateUserId(stravaId: number): Promise<number> {
  let user = await get<UserRecord>('users', stravaId);
  if (!user) {
    user = {
      stravaId,
      username: null,
      accessToken: null,
      refreshToken: null,
      tokenExpiresAt: null,
      firstname: null,
      lastname: null,
      profile: null,
      lastActivitySyncAt: null,
      lastSyncedActivityId: null,
      createdAt: new Date().toISOString(),
    };
    await put('users', user);
  }
  return user.stravaId;
}

/**
 * Load cached analysis results for a user.
 * WHY: THE critical fix. One index scan on the denormalized areaCompletions
 * store. No joins. Fully async. <50ms for 136 areas on iPhone.
 */
export async function loadCachedAnalyses(userId: number): Promise<Map<number, CachedAnalysis>> {
  const completions = await getAllFromIndex<AreaCompletionRecord>('areaCompletions', 'userId', userId);
  const cached = new Map<number, CachedAnalysis>();

  for (const comp of completions) {
    // WHY: Recalculate tier from adjusted score for consistency (TICKET-016 fix)
    const calculatedTier = assignTier(comp.bestQualityScore);
    if (comp.tier !== calculatedTier) {
      console.warn(
        `[loadCachedAnalyses] Area ${comp.areaFid}: Tier mismatch! Stored: ${comp.tier}, Calculated: ${calculatedTier}, Score: ${comp.bestQualityScore.toFixed(3)}`
      );
    }

    // WHY: activityPolylines is stored as Record<number, string> but we return Map
    const activityPolylines = new Map<number, string>();
    if (comp.activityPolylines) {
      for (const [k, v] of Object.entries(comp.activityPolylines)) {
        const id = Number(k);
        if (!isNaN(id) && v) {
          activityPolylines.set(id, v);
        }
      }
    }

    const metrics: CachedMetrics = {
      ...comp.cachedMetrics,
      // WHY: Override tier with recalculated value for display consistency
      tier: calculatedTier,
    };

    cached.set(comp.areaFid, {
      areaId: comp.areaFid,
      analysisId: comp.bestWalkAnalysisId,
      metrics,
      activityIds: comp.activityIds,
      activityPolylines,
    });
  }

  return cached;
}

/**
 * Save a walk analysis result to IndexedDB.
 * WHY: Uses a multi-store transaction for atomicity across walks,
 * walkAnalyses, deviations, and areaCompletions stores.
 */
export async function saveWalkAnalysis(
  userId: number,
  stravaActivity: StravaActivity,
  areaFid: number,
  analysisResult: FullAnalysisResult,
  isPrimaryMatch: boolean,
): Promise<number> {
  const metrics = analysisResult.metrics;
  const walkId = stravaActivity.id; // WHY: In IndexedDB, walkId IS stravaActivityId

  const tx = await openTransaction(
    ['walks', 'walkAnalyses', 'deviations', 'areaCompletions'],
    'readwrite',
  );
  const done = txDone(tx);

  // 1. Upsert walk record
  const existingWalk = await txGet<WalkRecord>(tx, 'walks', walkId);
  const walkRecord: WalkRecord = {
    stravaActivityId: walkId,
    userId,
    name: stravaActivity.name || null,
    totalDistanceMeters: stravaActivity.distance ?? null,
    polyline: stravaActivity.map?.summary_polyline || '',
    startLat: stravaActivity.start_latlng?.[0] ?? existingWalk?.startLat ?? null,
    startLng: stravaActivity.start_latlng?.[1] ?? existingWalk?.startLng ?? null,
    endLat: stravaActivity.end_latlng?.[0] ?? existingWalk?.endLat ?? null,
    endLng: stravaActivity.end_latlng?.[1] ?? existingWalk?.endLng ?? null,
    startedAt: existingWalk?.startedAt ?? null,
    syncedAt: existingWalk?.syncedAt ?? new Date().toISOString(),
  };
  await txPut(tx, 'walks', walkRecord);

  // 2. Check for existing analysis for this walk+area pair
  const existingAnalyses = await txGetAllFromIndex<WalkAnalysisRecord>(
    tx, 'walkAnalyses', 'walkId_areaFid', [walkId, areaFid],
  );
  // WHY: Delete old analysis and its deviations so we can insert fresh ones
  for (const old of existingAnalyses) {
    if (old.id != null) {
      // Delete deviations for this analysis
      const oldDeviations = await txGetAllFromIndex<DeviationRecord>(
        tx, 'deviations', 'walkAnalysisId', old.id,
      );
      for (const d of oldDeviations) {
        if (d.id != null) await txDelete(tx, 'deviations', d.id);
      }
      await txDelete(tx, 'walkAnalyses', old.id);
    }
  }

  // 3. Insert new walkAnalysis record
  const analysisRecord: Omit<WalkAnalysisRecord, 'id'> = {
    walkId,
    areaFid,
    perimeterCoveragePercent: metrics.perimeterCoveragePercent,
    coveredDistanceMeters: metrics.coveredDistanceMeters,
    rmseMeters: metrics.rmseMeters,
    maxDeviationMeters: metrics.maxDeviationMeters,
    p90DeviationMeters: metrics.p90DeviationMeters,
    efficiency: metrics.efficiency,
    areaCoveragePercent: metrics.areaCoveragePercent,
    enclosedAreaSqm: metrics.enclosedAreaSqm,
    isClosedLoop: metrics.isClosedLoop,
    loopGapMeters: metrics.loopGapMeters,
    rawQualityScore: metrics.rawQualityScore,
    qualityScore: metrics.rawQualityScore, // WHY: Same initially; adjusted if exemptions exist
    tier: metrics.tier || null,
    tieredBorderScore: metrics.tieredBorderScore,
    tierDistribution: metrics.tierDistribution ?? null,
    isPrimaryMatch,
    analyzedAt: new Date().toISOString(),
  };
  const analysisKey = await txPut(tx, 'walkAnalyses', analysisRecord);
  const analysisId = analysisKey as number;

  // 4. Insert deviations
  for (const deviation of analysisResult.deviations) {
    const devRecord: Omit<DeviationRecord, 'id'> = {
      walkAnalysisId: analysisId,
      startPointIndex: deviation.startPointIndex,
      endPointIndex: deviation.endPointIndex,
      startLat: deviation.startLat,
      startLng: deviation.startLng,
      endLat: deviation.endLat,
      endLng: deviation.endLng,
      startBorderLat: deviation.startBorderLat,
      startBorderLng: deviation.startBorderLng,
      endBorderLat: deviation.endBorderLat,
      endBorderLng: deviation.endBorderLng,
      borderGapMeters: deviation.borderGapMeters,
      detourDistanceMeters: deviation.detourDistanceMeters,
      maxDeviationMeters: deviation.maxDeviationMeters,
      returnAccuracyMeters: deviation.returnAccuracyMeters,
      detourRatio: deviation.detourRatio,
      classification: deviation.classification,
      isExempt: false,
      exemptionReason: null,
      exemptedAt: null,
    };
    await txPut(tx, 'deviations', devRecord);
  }

  // 5. Update areaCompletions (denormalized for fast loadCachedAnalyses)
  // WHY: Find the best analysis across all walks for this area+user
  const allAreaAnalyses = await txGetAllFromIndex<WalkAnalysisRecord>(
    tx, 'walkAnalyses', 'areaFid', areaFid,
  );
  // WHY: Filter to only this user's walks
  const userWalks = await txGetAllFromIndex<WalkRecord>(tx, 'walks', 'userId', userId);
  const userWalkIds = new Set(userWalks.map(w => w.stravaActivityId));
  const userAreaAnalyses = allAreaAnalyses.filter(a => userWalkIds.has(a.walkId));

  if (userAreaAnalyses.length > 0) {
    // WHY: Pick best by quality_score (adjusted) falling back to rawQualityScore
    const best = userAreaAnalyses.reduce((a, b) =>
      (b.qualityScore ?? b.rawQualityScore ?? 0) > (a.qualityScore ?? a.rawQualityScore ?? 0) ? b : a,
    );
    const bestScore = best.qualityScore ?? best.rawQualityScore ?? 0;
    const bestTier = assignTier(bestScore);

    // WHY: Build denormalized fields for zero-join loadCachedAnalyses
    const activityIds = [...new Set(userAreaAnalyses.map(a => a.walkId))];
    const activityPolylines: Record<number, string> = {};
    for (const aid of activityIds) {
      const walk = userWalks.find(w => w.stravaActivityId === aid);
      if (walk?.polyline) activityPolylines[aid] = walk.polyline;
    }

    const existing = await txGet<AreaCompletionRecord>(tx, 'areaCompletions', areaFid);

    const completionRecord: AreaCompletionRecord = {
      areaFid,
      userId,
      bestWalkAnalysisId: best.id!,
      bestQualityScore: bestScore,
      tier: bestTier,
      totalWalks: userAreaAnalyses.length,
      totalExemptions: existing?.totalExemptions ?? 0,
      firstCompletedAt: existing?.firstCompletedAt ?? new Date().toISOString(),
      bestCompletedAt: new Date().toISOString(),
      activityIds,
      activityPolylines,
      cachedMetrics: {
        perimeterCoveragePercent: best.perimeterCoveragePercent,
        areaCoveragePercent: best.areaCoveragePercent ?? 0,
        rawQualityScore: bestScore,
        tier: bestTier,
        isClosedLoop: best.isClosedLoop,
        coveredDistanceMeters: best.coveredDistanceMeters,
        rmseMeters: best.rmseMeters ?? 0,
        maxDeviationMeters: best.maxDeviationMeters ?? 0,
        p90DeviationMeters: best.p90DeviationMeters ?? 0,
        efficiency: best.efficiency ?? 0,
        enclosedAreaSqm: best.enclosedAreaSqm ?? 0,
        loopGapMeters: best.loopGapMeters ?? 0,
        tieredBorderScore: best.tieredBorderScore ?? 0,
        tierDistribution: (best.tierDistribution as TierDistribution) ??
          { platinum: 0, gold: 0, silver: 0, bronze: 0, potato: 0, missed: 0 },
        walkFocus: best.efficiency ?? 0, // WHY: walkFocus === efficiency per ADR 021
      },
    };
    await txPut(tx, 'areaCompletions', completionRecord);
  }

  await done;

  // WHY: Recalculate quality_score with exemptions after the main transaction commits.
  // This is a separate transaction because exemptions.ts reads from walkAnalyses.
  try {
    const { recalculateScoreWithExemptions } = await import('@/lib/exemptions');
    await recalculateScoreWithExemptions(analysisId);
  } catch (e) {
    console.warn('[saveWalkAnalysis] Could not recalculate exemptions:', e);
  }

  return analysisId;
}

/**
 * Load all activity-to-area assignments for a user.
 * WHY: Returns the primary area assignment for each activity, used for route
 * deviation coloring. Unlike loadCachedAnalyses which only returns the best
 * activity per area, this returns ALL activities with their assigned areas.
 *
 * @returns Map of Strava activity ID -> area FID
 */
export async function loadActivityAreaAssignments(userId: number): Promise<Map<number, number>> {
  // WHY: Get user's walks to filter analyses by userId
  const walks = await getAllFromIndex<WalkRecord>('walks', 'userId', userId);
  const userWalkIds = new Set(walks.map(w => w.stravaActivityId));

  const analyses = await getAll<WalkAnalysisRecord>('walkAnalyses');
  const assignments = new Map<number, number>();

  for (const a of analyses) {
    if (a.isPrimaryMatch && userWalkIds.has(a.walkId)) {
      assignments.set(a.walkId, a.areaFid);
    }
  }

  return assignments;
}

/**
 * Check which activities need analysis (not yet analyzed).
 * WHY: Only analyze new activities to save computation.
 */
export async function getActivitiesToAnalyze(
  userId: number,
  currentActivityIds: number[],
): Promise<number[]> {
  // WHY: Get walks for this user that have analyses
  const walks = await getAllFromIndex<WalkRecord>('walks', 'userId', userId);
  const userWalkIds = new Set(walks.map(w => w.stravaActivityId));

  const analyses = await getAll<WalkAnalysisRecord>('walkAnalyses');
  const analyzedWalkIds = new Set(analyses.filter(a => userWalkIds.has(a.walkId)).map(a => a.walkId));

  return currentActivityIds.filter(id => !analyzedWalkIds.has(id));
}

/**
 * Get the walk ID (stravaActivityId) for a Strava activity.
 * WHY: In IndexedDB the walk key IS the stravaActivityId. Returns it if the
 * walk exists, null otherwise. Re-exported from db.ts for callers that
 * import from this module.
 */
export async function getWalkIdByStravaActivityId(stravaActivityId: number): Promise<number | null> {
  const record = await get<WalkRecord>('walks', stravaActivityId);
  return record ? record.stravaActivityId : null;
}

// ============================================
// Walk listing
// ============================================

/**
 * List all walks for a user that have analyses.
 * WHY: Used for "re-analyze all" to find which walks need re-processing.
 */
export async function listWalksWithCache(userId: number): Promise<CachedWalkInfo[]> {
  const walks = await getAllFromIndex<WalkRecord>('walks', 'userId', userId);
  const analyses = await getAll<WalkAnalysisRecord>('walkAnalyses');
  const walkIdSet = new Set(walks.map(w => w.stravaActivityId));

  // WHY: Count how many areas each walk has been analyzed for
  const analysisCountByWalk = new Map<number, number>();
  for (const a of analyses) {
    if (walkIdSet.has(a.walkId)) {
      analysisCountByWalk.set(a.walkId, (analysisCountByWalk.get(a.walkId) ?? 0) + 1);
    }
  }

  const result: CachedWalkInfo[] = [];
  for (const w of walks) {
    const count = analysisCountByWalk.get(w.stravaActivityId);
    if (count && count > 0) {
      // WHY: Check walkStreams store (keyed by stravaActivityId) for stream presence
      const streams = await get<WalkStreamsRecord>('walkStreams', w.stravaActivityId);
      result.push({
        walkId: w.stravaActivityId, // WHY: walkId === stravaActivityId in IndexedDB
        stravaActivityId: w.stravaActivityId,
        name: w.name,
        hasStreams: !!streams && streams.pointCount > 0,
        analyzedAreaCount: count,
      });
    }
  }

  return result;
}

// ============================================
// Invalidation
// ============================================

/**
 * Invalidate cached analyses for a set of walks.
 * WHY: Clears walkAnalyses and deviations so re-analysis can write fresh results.
 */
export async function invalidateWalkAnalyses(walkIds: number[]): Promise<void> {
  if (walkIds.length === 0) return;

  const tx = await openTransaction(
    ['walkAnalyses', 'deviations', 'areaCompletions'],
    'readwrite',
  );
  const done = txDone(tx);

  const walkIdSet = new Set(walkIds);

  // WHY: Collect all analyses for these walks, then delete deviations + analyses
  const allAnalyses = await txGetAllFromIndex<WalkAnalysisRecord>(
    tx, 'walkAnalyses', 'walkId', walkIds[0],
  );
  // WHY: walkId index only supports a single key, so gather for all walkIds
  const toDelete: WalkAnalysisRecord[] = [];
  if (walkIds.length === 1) {
    toDelete.push(...allAnalyses);
  } else {
    // WHY: For multiple walks, scan all analyses and filter
    const store = tx.objectStore('walkAnalyses');
    const allReq = store.getAll();
    const all: WalkAnalysisRecord[] = await new Promise((resolve, reject) => {
      allReq.onsuccess = () => resolve(allReq.result);
      allReq.onerror = () => reject(allReq.error);
    });
    toDelete.push(...all.filter(a => walkIdSet.has(a.walkId)));
  }

  const deletedAnalysisIds = new Set<number>();
  const affectedAreaFids = new Set<number>();

  for (const analysis of toDelete) {
    if (analysis.id != null) {
      deletedAnalysisIds.add(analysis.id);
      affectedAreaFids.add(analysis.areaFid);

      // Delete deviations for this analysis
      const devs = await txGetAllFromIndex<DeviationRecord>(
        tx, 'deviations', 'walkAnalysisId', analysis.id,
      );
      for (const d of devs) {
        if (d.id != null) await txDelete(tx, 'deviations', d.id);
      }

      await txDelete(tx, 'walkAnalyses', analysis.id);
    }
  }

  // WHY: Clean up areaCompletions that reference deleted analyses
  for (const areaFid of affectedAreaFids) {
    const comp = await txGet<AreaCompletionRecord>(tx, 'areaCompletions', areaFid);
    if (comp && deletedAnalysisIds.has(comp.bestWalkAnalysisId)) {
      await txDelete(tx, 'areaCompletions', areaFid);
    }
  }

  await done;
}

// ============================================
// Re-Analysis (ADR 011)
// ============================================

/**
 * Get walk details needed for re-analysis.
 * WHY: Returns polyline, original start/end coordinates needed to run analyzeWalk().
 */
async function getWalkForReAnalysis(walkId: number): Promise<{
  stravaActivityId: number;
  name: string | null;
  polyline: string;
  userId: number;
  distance: number | null;
  startLatLng: [number, number] | null;
  endLatLng: [number, number] | null;
} | null> {
  const walk = await get<WalkRecord>('walks', walkId);
  if (!walk) return null;

  return {
    stravaActivityId: walk.stravaActivityId,
    name: walk.name,
    polyline: walk.polyline,
    userId: walk.userId,
    distance: walk.totalDistanceMeters,
    // WHY: Return null if any coordinate is missing
    startLatLng: walk.startLat != null && walk.startLng != null
      ? [walk.startLat, walk.startLng] : null,
    endLatLng: walk.endLat != null && walk.endLng != null
      ? [walk.endLat, walk.endLng] : null,
  };
}

/**
 * Re-analyze a single walk against all provided areas.
 * WHY: Core re-analysis logic shared by both single-walk and batch re-analysis.
 *
 * @param walkId - stravaActivityId (walk key in IndexedDB)
 * @param mode - 'rescore' uses cached streams, 'full' re-fetches from API
 * @param fetchStreams - Function to fetch fresh streams (for 'full' mode)
 * @param activityMetadata - Original Strava activity coordinates for loop detection
 * @param areas - GeoJSON area features to analyze against (caller provides)
 */
export async function reAnalyzeWalk(
  walkId: number,
  mode: ReAnalysisMode,
  fetchStreams?: (activityId: number) => Promise<CachedStreams | null>,
  activityMetadata?: ActivityMetadata | null,
  areas?: Array<{ fid: number; feature: Feature<Polygon | MultiPolygon>; perimeterMeters: number; areaSqm: number }>,
): Promise<{ areasMatched: number; bestScore: number }> {
  const walkData = await getWalkForReAnalysis(walkId);
  if (!walkData) {
    throw new Error(`Walk ${walkId} not found`);
  }

  // Get cached or fresh streams based on mode
  let cachedStreams: CachedStreams | null = null;

  if (mode === 'full' && fetchStreams) {
    cachedStreams = await fetchStreams(walkData.stravaActivityId);
    if (cachedStreams && cachedStreams.latlng.length > 0) {
      await saveWalkStreams(walkData.stravaActivityId, cachedStreams);
    }
  } else {
    // WHY: getWalkStreams is keyed by stravaActivityId in IndexedDB
    const streams = await getWalkStreams(walkData.stravaActivityId);
    if (streams) {
      cachedStreams = {
        latlng: streams.latlng,
        time: streams.time,
        distance: streams.distance,
        fetchedAt: streams.fetchedAt,
        pointCount: streams.pointCount,
      };
    }
  }

  // Decode polyline to coordinates
  let coordinates: Position[];
  try {
    const decoded = mapboxPolyline.decode(walkData.polyline);
    // WHY: mapbox polyline returns [lat, lng], turf needs [lng, lat]
    coordinates = decoded.map(pt => [pt[1], pt[0]]);
  } catch {
    throw new Error(`Failed to decode polyline for walk ${walkId}`);
  }

  const streamCoordinates: Position[] | undefined = cachedStreams?.latlng?.length
    ? cachedStreams.latlng.map(([lat, lng]) => [lng, lat])
    : undefined;

  // WHY: For accurate loop detection during re-analysis, prioritize:
  // 1. Original Strava activity coordinates (passed from page) - MOST RELIABLE
  // 2. Stored coordinates in walks record
  // 3. Stream coordinates (LEAST RELIABLE - can be truncated by privacy zones)
  let stravaMetadata: StravaMetadata | undefined = undefined;

  if (activityMetadata?.startLatLng && activityMetadata?.endLatLng) {
    stravaMetadata = {
      startLatLng: activityMetadata.startLatLng,
      endLatLng: activityMetadata.endLatLng,
      distance: activityMetadata.distance,
    };
  } else if (walkData.startLatLng && walkData.endLatLng) {
    stravaMetadata = {
      startLatLng: walkData.startLatLng,
      endLatLng: walkData.endLatLng,
      distance: walkData.distance ?? undefined,
    };
  }

  // WHY: If caller didn't provide areas, we can't analyze. The old sql.js version
  // read areas from the DB, but areas now come from GeoJSON at runtime.
  // Callers (page.tsx) must pass areas or we throw.
  if (!areas || areas.length === 0) {
    throw new Error('No areas provided for re-analysis. Caller must supply GeoJSON area features.');
  }

  // WHY: Clear existing analyses for this walk before re-computing
  await invalidateWalkAnalyses([walkId]);

  const walkLine = turf.lineString(
    streamCoordinates && streamCoordinates.length > 0 ? streamCoordinates : coordinates,
  );

  let bestAreaId: number | null = null;
  let bestScore = 0;
  let bestResult: FullAnalysisResult | null = null;

  for (const area of areas) {
    try {
      if (!turf.booleanIntersects(walkLine, area.feature)) {
        continue;
      }

      const result = analyzeWalk(
        coordinates,
        area.feature,
        area.perimeterMeters,
        area.areaSqm,
        stravaMetadata,
        streamCoordinates,
      );

      // WHY: Only consider if meets minimum threshold (Bronze = 50%)
      if (result.metrics.rawQualityScore >= TIER_THRESHOLDS.bronze) {
        if (result.metrics.rawQualityScore > bestScore) {
          bestScore = result.metrics.rawQualityScore;
          bestAreaId = area.fid;
          bestResult = result;
        }
      }
    } catch (e) {
      console.warn(`[reAnalyzeWalk] Error analyzing walk ${walkId} for area ${area.fid}:`, e);
    }
  }

  if (bestAreaId !== null && bestResult !== null) {
    // WHY: Create a minimal StravaActivity object for saveWalkAnalysis
    const activity: StravaActivity = {
      id: walkData.stravaActivityId,
      name: walkData.name ?? 'Unnamed Walk',
      map: { summary_polyline: walkData.polyline },
      start_latlng: walkData.startLatLng ?? [0, 0],
      end_latlng: walkData.endLatLng ?? undefined,
      distance: walkData.distance ?? undefined,
    };

    await saveWalkAnalysis(walkData.userId, activity, bestAreaId, bestResult, true);
    return { areasMatched: 1, bestScore };
  }

  return { areasMatched: 0, bestScore: 0 };
}

/**
 * Re-analyze multiple walks with progress tracking.
 * WHY: Batch re-analysis for "re-analyze all" with progress feedback.
 *
 * @param userId - Strava user ID (acts as userId in IndexedDB)
 * @param mode - 'rescore' uses cached streams, 'full' re-fetches from API
 * @param walkIds - Optional specific walk IDs; if omitted, re-analyzes all cached walks
 * @param onProgress - Optional callback for progress updates
 * @param fetchStreams - Function to fetch fresh streams (for 'full' mode)
 * @param getActivityMetadata - Function to get original Strava activity coordinates
 * @param areas - GeoJSON area features to analyze against
 */
export async function reAnalyzeWalks(
  userId: number,
  mode: ReAnalysisMode,
  walkIds?: number[],
  onProgress?: (progress: ReAnalysisProgress) => void,
  fetchStreams?: (activityId: number) => Promise<CachedStreams | null>,
  getActivityMetadata?: (activityId: number) => ActivityMetadata | null,
  areas?: Array<{ fid: number; feature: Feature<Polygon | MultiPolygon>; perimeterMeters: number; areaSqm: number }>,
): Promise<ReAnalysisResult> {
  const walksToProcess = walkIds
    ? walkIds
    : (await listWalksWithCache(userId)).map(w => w.walkId);

  if (walksToProcess.length === 0) {
    return { success: true, walksProcessed: 0, errors: [] };
  }

  const errors: ReAnalysisResult['errors'] = [];
  let processed = 0;

  // WHY: Process sequentially to avoid overwhelming Strava API (full mode)
  for (const wId of walksToProcess) {
    const walkData = await getWalkForReAnalysis(wId);
    const walkName = walkData?.name ?? `Walk ${wId}`;

    onProgress?.({
      current: processed + 1,
      total: walksToProcess.length,
      currentWalkName: walkName,
      status: 'running',
    });

    try {
      const activityMeta = walkData && getActivityMetadata
        ? getActivityMetadata(walkData.stravaActivityId)
        : null;
      await reAnalyzeWalk(wId, mode, fetchStreams, activityMeta, areas);
      processed++;
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown error';
      errors.push({
        walkId: wId,
        activityId: walkData?.stravaActivityId ?? 0,
        error: errorMessage,
      });
      console.error(`[reAnalyzeWalks] Error re-analyzing walk ${wId}:`, e);
    }

    // WHY: Small delay between walks in full mode to avoid Strava rate limits
    if (mode === 'full' && fetchStreams) {
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }

  onProgress?.({
    current: walksToProcess.length,
    total: walksToProcess.length,
    currentWalkName: '',
    status: errors.length > 0 ? 'error' : 'complete',
    error: errors.length > 0 ? `${errors.length} walks failed to re-analyze` : undefined,
  });

  return {
    success: errors.length === 0,
    walksProcessed: processed,
    errors,
  };
}

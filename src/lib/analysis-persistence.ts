/**
 * Analysis Persistence Module
 * 
 * Functions for saving and loading analysis results to/from the database.
 * WHY: Persists analysis results across sessions to avoid re-computation.
 * See ADR 004 for storage architecture.
 * 
 * @module analysis-persistence
 */

import { getDatabase, executeWrite, getWalkStreams, saveWalkStreams } from './db';
import type { FullAnalysisResult, StravaMetadata } from './analysis';
import { analyzeWalk } from './analysis';
import { assignTier, TIER_THRESHOLDS } from './tiers';
import type { StravaActivity } from '@/hooks/useStrava';
import type { Position, Feature, Polygon, MultiPolygon } from 'geojson';
import type { CachedStreams } from '@/lib/types/strava-streams';
import * as turf from '@turf/turf';
import mapboxPolyline from '@mapbox/polyline';

/**
 * Save a walk analysis result to the database.
 * WHY: Persists analysis so it doesn't need to be recalculated on every page load.
 */
export async function saveWalkAnalysis(
  userId: number,
  stravaActivity: StravaActivity,
  areaFid: number, // WHY: This is the FID from GeoJSON, not the database ID
  analysisResult: FullAnalysisResult,
  isPrimaryMatch: boolean
): Promise<number> {
  const db = getDatabase();

  // WHY: Convert GeoJSON FID to database area.id
  // The areas table has fid (GeoJSON FID) and id (primary key)
  // walk_analyses.area_id references areas.id, not areas.fid
  const areaLookup = db.exec('SELECT id FROM areas WHERE fid = ?', [areaFid]);
  if (areaLookup.length === 0 || areaLookup[0].values.length === 0) {
    console.error(`[saveWalkAnalysis] Area with FID ${areaFid} not found in database. Make sure areas are seeded.`);
    throw new Error(`Area with FID ${areaFid} not found in database. Areas may not be seeded yet.`);
  }
  const areaId = areaLookup[0].values[0][0] as number;

  // 1. Ensure walk exists in walks table
  let walkId: number;
  const walkCheck = db.exec(
    'SELECT id FROM walks WHERE strava_activity_id = ?',
    [stravaActivity.id]
  );

  if (walkCheck.length > 0 && walkCheck[0].values.length > 0) {
    walkId = walkCheck[0].values[0][0] as number;
    // WHY: Update start/end coordinates if not already set
    // These are critical for accurate loop detection during re-analysis
    const hasCoords = db.exec(
      'SELECT start_lat FROM walks WHERE id = ? AND start_lat IS NOT NULL',
      [walkId]
    );
    if (hasCoords.length === 0 || hasCoords[0].values.length === 0) {
      await executeWrite(
        `UPDATE walks SET start_lat = ?, start_lng = ?, end_lat = ?, end_lng = ?, total_distance_meters = ? WHERE id = ?`,
        [
          stravaActivity.start_latlng?.[0] ?? null,
          stravaActivity.start_latlng?.[1] ?? null,
          stravaActivity.end_latlng?.[0] ?? null,
          stravaActivity.end_latlng?.[1] ?? null,
          stravaActivity.distance ?? null,
          walkId,
        ]
      );
    }
  } else {
    // Insert new walk with start/end coordinates
    // WHY: Store start_latlng/end_latlng from Strava activity for accurate loop detection
    // during re-analysis. Streams can be truncated by privacy zones, but activity start/end are not.
    await executeWrite(
      `INSERT INTO walks (strava_activity_id, user_id, name, total_distance_meters, polyline, start_lat, start_lng, end_lat, end_lng, started_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        stravaActivity.id,
        userId,
        stravaActivity.name || null,
        stravaActivity.distance ?? null,
        stravaActivity.map?.summary_polyline || '',
        stravaActivity.start_latlng?.[0] ?? null,
        stravaActivity.start_latlng?.[1] ?? null,
        stravaActivity.end_latlng?.[0] ?? null,
        stravaActivity.end_latlng?.[1] ?? null,
        null, // started_at - could parse from activity
      ]
    );
    const newWalk = db.exec('SELECT id FROM walks WHERE strava_activity_id = ?', [stravaActivity.id]);
    walkId = newWalk[0].values[0][0] as number;
  }

  // 2. Save walk_analysis
  const metrics = analysisResult.metrics;
  await executeWrite(
    `INSERT OR REPLACE INTO walk_analyses (
      walk_id, area_id,
      perimeter_coverage_percent, covered_distance_meters,
      rmse_meters, max_deviation_meters, p90_deviation_meters, efficiency,
      area_coverage_percent, enclosed_area_sqm, is_closed_loop, loop_gap_meters,
      raw_quality_score, quality_score, tier, is_primary_match
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      walkId,
      areaId,
      metrics.perimeterCoveragePercent,
      metrics.coveredDistanceMeters,
      metrics.rmseMeters,
      metrics.maxDeviationMeters,
      metrics.p90DeviationMeters,
      metrics.efficiency,
      metrics.areaCoveragePercent,
      metrics.enclosedAreaSqm,
      metrics.isClosedLoop ? 1 : 0,
      metrics.loopGapMeters,
      metrics.rawQualityScore,
      metrics.rawQualityScore, // quality_score same as raw initially; recalculated if exemptions exist
      metrics.tier || null,
      isPrimaryMatch ? 1 : 0,
    ]
  );

  // Get the analysis ID
  const analysisCheck = db.exec(
    'SELECT id FROM walk_analyses WHERE walk_id = ? AND area_id = ?',
    [walkId, areaId]
  );
  const analysisId = analysisCheck[0].values[0][0] as number;

  // 3. Save deviations
  // Delete existing deviations for this analysis
  await executeWrite(
    'DELETE FROM deviations WHERE walk_analysis_id = ?',
    [analysisId]
  );

  for (const deviation of analysisResult.deviations) {
    await executeWrite(
      `INSERT INTO deviations (
        walk_analysis_id,
        start_point_index, end_point_index,
        start_lat, start_lng, end_lat, end_lng,
        start_border_lat, start_border_lng, end_border_lat, end_border_lng,
        border_gap_meters, detour_distance_meters, max_deviation_meters,
        return_accuracy_meters, detour_ratio, classification
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        analysisId,
        deviation.startPointIndex,
        deviation.endPointIndex,
        deviation.startLat,
        deviation.startLng,
        deviation.endLat,
        deviation.endLng,
        deviation.startBorderLat,
        deviation.startBorderLng,
        deviation.endBorderLat,
        deviation.endBorderLng,
        deviation.borderGapMeters,
        deviation.detourDistanceMeters,
        deviation.maxDeviationMeters,
        deviation.returnAccuracyMeters,
        deviation.detourRatio,
        deviation.classification,
      ]
    );
  }

  // WHY: After saving deviations, recalculate quality_score if any exemptions exist
  // This ensures quality_score reflects exemption adjustments even after re-analysis
  // Note: During re-analysis, exemptions are deleted, so this will just set quality_score = raw_quality_score
  const { recalculateScoreWithExemptions } = await import('./exemptions');
  await recalculateScoreWithExemptions(analysisId);

  // 4. Update area_completions (denormalized for fast queries)
  // WHY: Use COALESCE to prefer quality_score (adjusted with exemptions) over raw_quality_score
  // This ensures the best walk is selected based on adjusted scores, not raw scores
  const bestAnalysis = db.exec(
    `SELECT wa.id, COALESCE(wa.quality_score, wa.raw_quality_score) as quality_score
     FROM walk_analyses wa
     JOIN walks w ON wa.walk_id = w.id
     WHERE wa.area_id = ? AND w.user_id = ?
     ORDER BY COALESCE(wa.quality_score, wa.raw_quality_score) DESC LIMIT 1`,
    [areaId, userId]
  );

  if (bestAnalysis.length > 0 && bestAnalysis[0].values.length > 0) {
    const bestId = bestAnalysis[0].values[0][0] as number;
    const bestScore = bestAnalysis[0].values[0][1] as number;
    
    // WHY: Use centralized assignTier() to ensure consistency
    // Don't use stored tier as it might be from raw_quality_score
    // FIX: This previously missed potato tier assignment (TICKET-016)
    const bestTier = assignTier(bestScore);

    const walkCount = db.exec(
      `SELECT COUNT(*) FROM walk_analyses wa
       JOIN walks w ON wa.walk_id = w.id
       WHERE wa.area_id = ? AND w.user_id = ?`,
      [areaId, userId]
    );
    const totalWalks = walkCount[0].values[0][0] as number;

    await executeWrite(
      `INSERT OR REPLACE INTO area_completions (
        user_id, area_id, best_walk_analysis_id, best_quality_score, tier,
        total_walks, first_completed_at, best_completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [userId, areaId, bestId, bestScore, bestTier, totalWalks]
    );
  }

  return analysisId;
}

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
  // Additional fields from DB for full AnalysisMetrics reconstruction
  coveredDistanceMeters: number;
  rmseMeters: number;
  maxDeviationMeters: number;
  p90DeviationMeters: number;
  efficiency: number;
  enclosedAreaSqm: number;
  loopGapMeters: number;
}

/**
 * Cached analysis result type returned by loadCachedAnalyses.
 */
export interface CachedAnalysis {
  areaId: number;
  analysisId: number;
  metrics: CachedMetrics;
  activityIds: number[];
}

/**
 * Load cached analysis results for a user's activities.
 * WHY: Returns cached results to avoid re-computation on page load.
 * See ADR 004 Cache Loading Strategy for the intended flow.
 */
export function loadCachedAnalyses(userId: number): Map<number, CachedAnalysis> {
  const db = getDatabase();

  // Get all area completions for this user
  // WHY: Join with areas table to get FID (GeoJSON identifier) instead of database id
  // WHY: Select all metrics fields needed to reconstruct AnalysisMetrics for UI display
  // WHY: Use COALESCE to prefer quality_score (adjusted with exemptions) over raw_quality_score
  // This ensures displayed scores match the tier that was calculated with exemptions applied
  // WHY: Calculate tier from the adjusted score to ensure consistency
  const result = db.exec(
    `SELECT 
      a.fid as area_fid,
      ac.best_walk_analysis_id,
      wa.perimeter_coverage_percent,
      wa.area_coverage_percent,
      COALESCE(wa.quality_score, wa.raw_quality_score) as quality_score,
      COALESCE(wa.quality_score, wa.raw_quality_score) as score_for_tier,
      wa.tier as stored_tier,
      wa.is_closed_loop,
      wa.covered_distance_meters,
      wa.rmse_meters,
      wa.max_deviation_meters,
      wa.p90_deviation_meters,
      wa.efficiency,
      wa.enclosed_area_sqm,
      wa.loop_gap_meters,
      GROUP_CONCAT(DISTINCT w.strava_activity_id) as activity_ids
    FROM area_completions ac
    JOIN areas a ON ac.area_id = a.id
    JOIN walk_analyses wa ON ac.best_walk_analysis_id = wa.id
    JOIN walks w ON wa.walk_id = w.id
    WHERE ac.user_id = ?
    GROUP BY a.fid`,
    [userId]
  );

  const cached = new Map<number, CachedAnalysis>();

  if (result.length > 0) {
    for (const row of result[0].values) {
      const areaId = row[0] as number;
      const analysisId = row[1] as number;
      const adjustedScore = row[4] as number; // COALESCE(quality_score, raw_quality_score)
      const storedTier = row[6] as string | null;
      // WHY: activity_ids is now at index 15 after adding score_for_tier column
      const activityIdsStr = row[15] as string;
      const activityIds = activityIdsStr ? activityIdsStr.split(',').map(Number) : [];

      // WHY: Use centralized assignTier() to ensure consistency
      // The stored tier might be from raw_quality_score, but we're displaying adjusted score
      // FIX: This previously missed potato tier assignment (TICKET-016)
      const calculatedTier = assignTier(adjustedScore);
      
      // WHY: Debug logging to help diagnose score instability
      // Log if stored tier doesn't match calculated tier (indicates mismatch)
      if (storedTier !== calculatedTier) {
        console.warn(`[loadCachedAnalyses] Area ${areaId}: Tier mismatch! Stored: ${storedTier}, Calculated: ${calculatedTier}, Score: ${adjustedScore.toFixed(3)}`);
      }

      cached.set(areaId, {
        areaId,
        analysisId,
        metrics: {
          perimeterCoveragePercent: row[2] as number,
          areaCoveragePercent: row[3] as number,
          rawQualityScore: adjustedScore, // This is the adjusted score (COALESCE result)
          tier: calculatedTier, // Recalculated from adjusted score for consistency
          isClosedLoop: (row[7] as number) === 1,
          coveredDistanceMeters: row[8] as number,
          rmseMeters: row[9] as number,
          maxDeviationMeters: row[10] as number,
          p90DeviationMeters: row[11] as number,
          efficiency: row[12] as number,
          enclosedAreaSqm: row[13] as number,
          loopGapMeters: row[14] as number,
        },
        activityIds,
      });
    }
  }

  return cached;
}

/**
 * Load all activity-to-area assignments for a user.
 * WHY: Returns the primary area assignment for each activity, used for route
 * deviation coloring. Unlike loadCachedAnalyses which only returns the best
 * activity per area, this returns ALL activities with their assigned areas.
 * 
 * @returns Map of Strava activity ID → area FID (GeoJSON identifier)
 */
export function loadActivityAreaAssignments(userId: number): Map<number, number> {
  const db = getDatabase();
  
  // WHY: Get the primary area assignment for each activity
  // Each activity can match multiple areas, but only one is marked as is_primary_match
  const result = db.exec(
    `SELECT w.strava_activity_id, a.fid
     FROM walks w
     JOIN walk_analyses wa ON w.id = wa.walk_id
     JOIN areas a ON wa.area_id = a.id
     WHERE w.user_id = ? AND wa.is_primary_match = 1`,
    [userId]
  );
  
  const assignments = new Map<number, number>();
  
  if (result.length > 0) {
    for (const row of result[0].values) {
      const activityId = row[0] as number;
      const areaFid = row[1] as number;
      assignments.set(activityId, areaFid);
    }
  }
  
  return assignments;
}

/**
 * Check which activities need analysis (not yet analyzed or updated).
 * WHY: Only analyze new or changed activities to save computation.
 */
export function getActivitiesToAnalyze(
  userId: number,
  currentActivityIds: number[]
): number[] {
  const db = getDatabase();

  // Get all activity IDs that have been analyzed
  const analyzed = db.exec(
    `SELECT DISTINCT w.strava_activity_id
     FROM walks w
     JOIN walk_analyses wa ON w.id = wa.walk_id
     WHERE w.user_id = ?`,
    [userId]
  );

  const analyzedIds = new Set<number>();
  if (analyzed.length > 0) {
    for (const row of analyzed[0].values) {
      analyzedIds.add(row[0] as number);
    }
  }

  // Return activities that haven't been analyzed yet
  return currentActivityIds.filter(id => !analyzedIds.has(id));
}

/**
 * Get or create user ID from Strava ID.
 * WHY: Maps Strava user ID to internal user ID for database relationships.
 */
export function getOrCreateUserId(stravaId: number, username?: string): number {
  const db = getDatabase();

  // Check if user exists
  const existing = db.exec('SELECT id FROM users WHERE strava_id = ?', [stravaId]);

  if (existing.length > 0 && existing[0].values.length > 0) {
    return existing[0].values[0][0] as number;
  }

  // Create new user
  db.run('INSERT INTO users (strava_id, username) VALUES (?, ?)', [stravaId, username || null]);
  const newUser = db.exec('SELECT id FROM users WHERE strava_id = ?', [stravaId]);
  return newUser[0].values[0][0] as number;
}

// ============================================
// Re-Analysis Functions (ADR 011)
// ============================================

/**
 * Re-analysis mode types.
 * WHY: "re-score" uses cached GPS data; "full" re-fetches from Strava API.
 * See ADR 011 for when to use each mode.
 */
export type ReAnalysisMode = 'rescore' | 'full';

/**
 * Progress callback for re-analysis operations.
 */
export interface ReAnalysisProgress {
  current: number;
  total: number;
  currentWalkName: string;
  status: 'running' | 'complete' | 'error';
  error?: string;
}

/**
 * Result of a re-analysis operation.
 */
export interface ReAnalysisResult {
  success: boolean;
  walksProcessed: number;
  errors: Array<{ walkId: number; activityId: number; error: string }>;
}

/**
 * Walk info returned by listWalksWithCache.
 */
export interface CachedWalkInfo {
  walkId: number;
  stravaActivityId: number;
  name: string | null;
  hasStreams: boolean;
  analyzedAreaCount: number;
}

/**
 * Get the database walk ID for a Strava activity ID.
 * WHY: Maps Strava activity ID to internal walk ID for re-analysis.
 */
export function getWalkIdByStravaActivityId(stravaActivityId: number): number | null {
  const db = getDatabase();
  const result = db.exec(
    'SELECT id FROM walks WHERE strava_activity_id = ? LIMIT 1',
    [stravaActivityId]
  );

  if (result.length === 0 || result[0].values.length === 0) {
    return null;
  }

  return result[0].values[0][0] as number;
}

/**
 * List all walks for a user that have cached analyses.
 * WHY: Used for "re-analyze all" to find which walks need re-processing.
 * See ADR 011 for re-analysis entry points.
 */
export function listWalksWithCache(userId: number): CachedWalkInfo[] {
  const db = getDatabase();

  // WHY: Join walks with walk_analyses to find walks that have been analyzed
  // GROUP BY to get count of areas each walk has been analyzed for
  const result = db.exec(
    `SELECT 
      w.id as walk_id,
      w.strava_activity_id,
      w.name,
      CASE WHEN w.streams_json IS NOT NULL AND w.streams_json != '' THEN 1 ELSE 0 END as has_streams,
      COUNT(wa.id) as analyzed_area_count
    FROM walks w
    JOIN walk_analyses wa ON w.id = wa.walk_id
    WHERE w.user_id = ?
    GROUP BY w.id
    ORDER BY w.synced_at DESC`,
    [userId]
  );

  if (result.length === 0) {
    return [];
  }

  return result[0].values.map(row => ({
    walkId: row[0] as number,
    stravaActivityId: row[1] as number,
    name: row[2] as string | null,
    hasStreams: (row[3] as number) === 1,
    analyzedAreaCount: row[4] as number,
  }));
}

/**
 * Invalidate cached analysis for a set of walks.
 * WHY: Clears walk_analyses and deviations so re-analysis can write fresh results.
 * See ADR 011 for invalidation strategy.
 */
export async function invalidateWalkAnalyses(walkIds: number[]): Promise<void> {
  if (walkIds.length === 0) return;

  const db = getDatabase();
  const placeholders = walkIds.map(() => '?').join(',');

  // WHY: Delete deviations first due to foreign key constraint
  // walk_analyses.id is referenced by deviations.walk_analysis_id
  const analysisIds = db.exec(
    `SELECT id FROM walk_analyses WHERE walk_id IN (${placeholders})`,
    walkIds
  );

  if (analysisIds.length > 0 && analysisIds[0].values.length > 0) {
    const ids = analysisIds[0].values.map(row => row[0] as number);
    const deviationPlaceholders = ids.map(() => '?').join(',');
    await executeWrite(
      `DELETE FROM deviations WHERE walk_analysis_id IN (${deviationPlaceholders})`,
      ids
    );
  }

  // Delete the walk analyses
  await executeWrite(
    `DELETE FROM walk_analyses WHERE walk_id IN (${placeholders})`,
    walkIds
  );

  // WHY: area_completions will be refreshed by saveWalkAnalysis() after re-analysis
  // We need to clear affected area_completions that reference deleted analyses
  // Get the user_id from one of the walks
  const userResult = db.exec(
    `SELECT user_id FROM walks WHERE id IN (${placeholders}) LIMIT 1`,
    walkIds
  );

  if (userResult.length > 0 && userResult[0].values.length > 0) {
    const userId = userResult[0].values[0][0] as number;
    // Delete area_completions that no longer have valid analyses
    await executeWrite(
      `DELETE FROM area_completions 
       WHERE user_id = ? 
       AND best_walk_analysis_id NOT IN (SELECT id FROM walk_analyses)`,
      [userId]
    );
  }
}

/**
 * Get walk details needed for re-analysis.
 * WHY: Returns polyline, streams data, and original start/end coordinates
 * needed to run analyzeWalk(). The start/end coordinates are stored from
 * the original Strava activity and are critical for accurate loop detection
 * since streams can be truncated by privacy zones.
 */
function getWalkForReAnalysis(walkId: number): {
  stravaActivityId: number;
  name: string | null;
  polyline: string;
  userId: number;
  distance: number | null;
  startLatLng: [number, number] | null;
  endLatLng: [number, number] | null;
} | null {
  const db = getDatabase();

  // WHY: Include start/end coordinates for accurate loop detection during re-analysis
  // These are stored from the original Strava activity and are not truncated by privacy zones
  const result = db.exec(
    `SELECT strava_activity_id, name, polyline, user_id, total_distance_meters, start_lat, start_lng, end_lat, end_lng
     FROM walks WHERE id = ?`,
    [walkId]
  );

  if (result.length === 0 || result[0].values.length === 0) {
    return null;
  }

  const row = result[0].values[0];
  const startLat = row[5] as number | null;
  const startLng = row[6] as number | null;
  const endLat = row[7] as number | null;
  const endLng = row[8] as number | null;

  return {
    stravaActivityId: row[0] as number,
    name: row[1] as string | null,
    polyline: row[2] as string,
    userId: row[3] as number,
    distance: row[4] as number | null,
    // WHY: Return null if any coordinate is missing - indicates walk was saved before schema v3
    startLatLng: startLat !== null && startLng !== null ? [startLat, startLng] : null,
    endLatLng: endLat !== null && endLng !== null ? [endLat, endLng] : null,
  };
}

/**
 * Get all areas with their geometry for re-analysis.
 * WHY: Needed to run analyzeWalk() against each area.
 */
function getAreasForAnalysis(): Array<{
  fid: number;
  feature: Feature<Polygon | MultiPolygon>;
  perimeterMeters: number;
  areaSqm: number;
}> {
  const db = getDatabase();

  const result = db.exec(
    `SELECT fid, geometry_json, perimeter_meters, area_sqm FROM areas`
  );

  if (result.length === 0) {
    return [];
  }

  return result[0].values.map(row => {
    const geometry = JSON.parse(row[1] as string);
    return {
      fid: row[0] as number,
      feature: {
        type: 'Feature' as const,
        properties: {},
        geometry,
      },
      perimeterMeters: row[2] as number,
      areaSqm: row[3] as number,
    };
  });
}

/**
 * Re-analyze a single walk.
 * WHY: Core re-analysis logic shared by both single-walk and batch re-analysis.
 * See ADR 011 for re-analysis modes and flow.
 * 
 * @param walkId - Database walk ID
 * @param mode - 're-score' uses cached streams, 'full' re-fetches from API
 * @param fetchStreams - Optional function to fetch fresh streams (for 'full' mode)
 * @param activityMetadata - Optional original Strava activity coordinates for accurate loop detection
 * @returns True if successful, throws on error
 */
export async function reAnalyzeWalk(
  walkId: number,
  mode: ReAnalysisMode,
  fetchStreams?: (activityId: number) => Promise<CachedStreams | null>,
  activityMetadata?: ActivityMetadata | null
): Promise<{ areasMatched: number; bestScore: number }> {
  const walkData = getWalkForReAnalysis(walkId);
  if (!walkData) {
    throw new Error(`Walk ${walkId} not found`);
  }

  // Get cached or fresh streams based on mode
  let cachedStreams: CachedStreams | null = null;

  if (mode === 'full' && fetchStreams) {
    // WHY: Full mode re-fetches from Strava API for fresh GPS data
    cachedStreams = await fetchStreams(walkData.stravaActivityId);
    if (cachedStreams && cachedStreams.latlng.length > 0) {
      // Save the fresh streams
      await saveWalkStreams(walkId, cachedStreams);
    }
  } else {
    // WHY: Re-score mode uses existing cached streams
    cachedStreams = getWalkStreams(walkData.stravaActivityId);
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

  // Get stream coordinates if available
  const streamCoordinates: Position[] | undefined = cachedStreams?.latlng?.length
    ? cachedStreams.latlng.map(([lat, lng]) => [lng, lat])
    : undefined;

  // WHY: For accurate loop detection during re-analysis, we prioritize:
  // 1. Original Strava activity coordinates (passed from page) - MOST RELIABLE
  // 2. Stored coordinates in walks table (for new walks after schema v3)
  // 3. Previous analysis result (may be corrupted from earlier re-analysis)
  // 4. Stream coordinates (LEAST RELIABLE - can be truncated by privacy zones)
  let stravaMetadata: StravaMetadata | undefined = undefined;
  
  // Priority 1: Use activity metadata from Strava API (passed from page.tsx)
  if (activityMetadata?.startLatLng && activityMetadata?.endLatLng) {
    stravaMetadata = {
      startLatLng: activityMetadata.startLatLng,
      endLatLng: activityMetadata.endLatLng,
      distance: activityMetadata.distance,
    };
    console.log(`[reAnalyzeWalk] Walk ${walkId}: using original Strava activity coordinates for loop detection`);
  }
  // Priority 2: Use stored coordinates from walks table
  else if (walkData.startLatLng && walkData.endLatLng) {
    stravaMetadata = {
      startLatLng: walkData.startLatLng,
      endLatLng: walkData.endLatLng,
      distance: walkData.distance ?? undefined,
    };
    console.log(`[reAnalyzeWalk] Walk ${walkId}: using stored coordinates from database`);
  }
  // Priority 3: No reliable coordinates available - will fall back to streams in analyzeWalk
  else {
    console.warn(`[reAnalyzeWalk] Walk ${walkId}: no reliable coordinates available - loop detection may be inaccurate`);
  }

  // Get all areas for analysis
  const areas = getAreasForAnalysis();
  if (areas.length === 0) {
    throw new Error('No areas found in database');
  }

  // WHY: Clear existing analyses for this walk before re-computing
  await invalidateWalkAnalyses([walkId]);

  // Analyze walk against all areas and find best match
  const walkLine = turf.lineString(streamCoordinates && streamCoordinates.length > 0 
    ? streamCoordinates 
    : coordinates);
  
  let bestAreaId: number | null = null;
  let bestScore = 0;
  let bestResult: FullAnalysisResult | null = null;

  // WHY: TIER_THRESHOLDS imported at module level from ./tiers

  for (const area of areas) {
    try {
      // Quick intersection check
      if (!turf.booleanIntersects(walkLine, area.feature)) {
        continue;
      }

      // WHY: Use stravaMetadata for accurate loop detection (from original Strava activity)
      const result = analyzeWalk(
        coordinates,
        area.feature,
        area.perimeterMeters,
        area.areaSqm,
        stravaMetadata,  // Original Strava coordinates for loop detection
        streamCoordinates
        // No loopStatusOverride - we use stravaMetadata instead
      );
      console.log(`[reAnalyzeWalk] Result for area ${area.fid}: isClosedLoop=${result.metrics.isClosedLoop}, areaCoverage=${result.metrics.areaCoveragePercent}`);

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

  // Save the best match if found
  if (bestAreaId !== null && bestResult !== null) {
    // WHY: Create a minimal StravaActivity object for saveWalkAnalysis
    // Use stored coordinates if available, otherwise use [0,0] as placeholder
    // (saveWalkAnalysis will preserve existing coordinates if they're already stored)
    const activity: StravaActivity = {
      id: walkData.stravaActivityId,
      name: walkData.name ?? 'Unnamed Walk',
      map: { summary_polyline: walkData.polyline },
      start_latlng: walkData.startLatLng ?? [0, 0],
      end_latlng: walkData.endLatLng ?? undefined,
      distance: walkData.distance ?? undefined,
    };

    const analysisId =     await saveWalkAnalysis(
      walkData.userId,
      activity,
      bestAreaId,
      bestResult,
      true // isPrimaryMatch
    );

    return { areasMatched: 1, bestScore };
  }

  return { areasMatched: 0, bestScore: 0 };
}

/**
 * Activity metadata from Strava for accurate loop detection.
 */
export interface ActivityMetadata {
  startLatLng: [number, number];
  endLatLng?: [number, number];
  distance?: number;
}

/**
 * Re-analyze multiple walks with progress tracking.
 * WHY: Batch re-analysis for "re-analyze all" with progress feedback.
 * See ADR 011 for rate limiting considerations.
 * 
 * @param userId - Database user ID
 * @param mode - 're-score' uses cached streams, 'full' re-fetches from API
 * @param walkIds - Optional specific walk IDs; if omitted, re-analyzes all cached walks
 * @param onProgress - Optional callback for progress updates
 * @param fetchStreams - Optional function to fetch fresh streams (for 'full' mode)
 * @param getActivityMetadata - Optional function to get original Strava activity coordinates
 * @returns Summary of re-analysis results
 */
export async function reAnalyzeWalks(
  userId: number,
  mode: ReAnalysisMode,
  walkIds?: number[],
  onProgress?: (progress: ReAnalysisProgress) => void,
  fetchStreams?: (activityId: number) => Promise<CachedStreams | null>,
  getActivityMetadata?: (activityId: number) => ActivityMetadata | null
): Promise<ReAnalysisResult> {
  // Get walks to re-analyze
  const walksToProcess = walkIds
    ? walkIds
    : listWalksWithCache(userId).map(w => w.walkId);

  if (walksToProcess.length === 0) {
    return { success: true, walksProcessed: 0, errors: [] };
  }

  const errors: ReAnalysisResult['errors'] = [];
  let processed = 0;

  // WHY: Process walks sequentially to avoid overwhelming Strava API (full mode)
  // and to provide accurate progress tracking
  for (const walkId of walksToProcess) {
    const walkData = getWalkForReAnalysis(walkId);
    const walkName = walkData?.name ?? `Walk ${walkId}`;

    onProgress?.({
      current: processed + 1,
      total: walksToProcess.length,
      currentWalkName: walkName,
      status: 'running',
    });

    try {
      // WHY: Pass activity metadata to get correct start/end coordinates from Strava
      const activityMeta = walkData && getActivityMetadata 
        ? getActivityMetadata(walkData.stravaActivityId)
        : null;
      await reAnalyzeWalk(walkId, mode, fetchStreams, activityMeta);
      processed++;
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown error';
      errors.push({
        walkId,
        activityId: walkData?.stravaActivityId ?? 0,
        error: errorMessage,
      });
      console.error(`[reAnalyzeWalks] Error re-analyzing walk ${walkId}:`, e);
    }

    // WHY: Small delay between walks in full mode to avoid rate limits
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

/**
 * Analysis Persistence Module
 * 
 * Functions for saving and loading analysis results to/from the database.
 * WHY: Persists analysis results across sessions to avoid re-computation.
 * See ADR 004 for storage architecture.
 * 
 * @module analysis-persistence
 */

import { getDatabase, executeWrite } from './db';
import type { FullAnalysisResult } from './analysis';
import type { StravaActivity } from '@/hooks/useStrava';
import type { Position } from 'geojson';

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
  } else {
    // Insert new walk
    await executeWrite(
      `INSERT INTO walks (strava_activity_id, user_id, name, total_distance_meters, polyline, started_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        stravaActivity.id,
        userId,
        stravaActivity.name || null,
        null, // total_distance_meters - could be calculated from coordinates
        stravaActivity.map?.summary_polyline || '',
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
      metrics.rawQualityScore, // quality_score same as raw for now
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

  // 4. Update area_completions (denormalized for fast queries)
  const bestAnalysis = db.exec(
    `SELECT wa.id, wa.raw_quality_score, wa.tier FROM walk_analyses wa
     JOIN walks w ON wa.walk_id = w.id
     WHERE wa.area_id = ? AND w.user_id = ?
     ORDER BY wa.raw_quality_score DESC LIMIT 1`,
    [areaId, userId]
  );

  if (bestAnalysis.length > 0 && bestAnalysis[0].values.length > 0) {
    const bestId = bestAnalysis[0].values[0][0] as number;
    const bestScore = bestAnalysis[0].values[0][1] as number;
    const bestTier = bestAnalysis[0].values[0][2] as string | null;

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
  const result = db.exec(
    `SELECT 
      a.fid as area_fid,
      ac.best_walk_analysis_id,
      wa.perimeter_coverage_percent,
      wa.area_coverage_percent,
      wa.raw_quality_score,
      wa.tier,
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
      // WHY: activity_ids is now at index 14 after adding more columns
      const activityIdsStr = row[14] as string;
      const activityIds = activityIdsStr ? activityIdsStr.split(',').map(Number) : [];

      cached.set(areaId, {
        areaId,
        analysisId,
        metrics: {
          perimeterCoveragePercent: row[2] as number,
          areaCoveragePercent: row[3] as number,
          rawQualityScore: row[4] as number,
          tier: row[5] as string | null,
          isClosedLoop: (row[6] as number) === 1,
          coveredDistanceMeters: row[7] as number,
          rmseMeters: row[8] as number,
          maxDeviationMeters: row[9] as number,
          p90DeviationMeters: row[10] as number,
          efficiency: row[11] as number,
          enclosedAreaSqm: row[12] as number,
          loopGapMeters: row[13] as number,
        },
        activityIds,
      });
    }
  }

  return cached;
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

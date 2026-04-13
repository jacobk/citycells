/**
 * Achievement Service
 *
 * Orchestrates achievement checking, evaluation, and persistence.
 * This is the main entry point for the achievement system.
 *
 * See ADR 019 for achievement system design.
 * See TICKET-023 for implementation requirements.
 *
 * @module achievement-service
 */

import { ACHIEVEMENTS, type Achievement } from './achievements';
import type { UserState, EvaluationContext } from './achievement-conditions';
import { evaluateCondition } from './achievement-conditions';
import {
  getUserAchievements,
  unlockAchievement,
  getUserProgress,
  getActualWalkedDistance,
  getCompletedAreasWithPerimeter,
  type AreaRow,
} from './db';
import {
  getAdjacencyGraph,
  getVertexMap,
} from './adjacency';
import type { TierCounts } from './types/tiers';
import * as turf from '@turf/turf';

// ============================================
// Types
// ============================================

/**
 * Context needed by the achievement service that comes from GeoJSON at runtime.
 * WHY: Areas no longer live in the database — they come from GeoJSON features.
 * Callers must provide this data.
 */
export interface AchievementAreaContext {
  /** All areas in AreaRow format (for adjacency graph building) */
  allAreas: AreaRow[];
  /** Map of areaFid -> perimeter in meters */
  perimeterLookup: Map<number, number>;
  /** FID of the smallest area (by perimeter) */
  smallestAreaFid: number | null;
}

/**
 * Result of checking achievements.
 */
export interface CheckAchievementsResult {
  /** Achievements that were newly unlocked */
  newlyUnlocked: Achievement[];
  /** All achievements the user has (including existing) */
  allUnlocked: Map<string, { unlockedAt: string }>;
  /** Total achievements available */
  totalCount: number;
}

// ============================================
// Constants
// ============================================

// Malmö center coordinates for "The Centered" achievement
const MALMO_CENTER_LNG = 13.0038;
const MALMO_CENTER_LAT = 55.6050;

// Cache for center area FID
let cachedCenterAreaFid: number | null = null;

// ============================================
// User State Building
// ============================================

/**
 * Build the user state for achievement evaluation.
 * WHY: Pre-aggregates all data needed to evaluate achievements in a single pass.
 */
export async function buildUserState(
  userId: number,
  areaCtx: AchievementAreaContext,
): Promise<UserState> {
  const { allAreas, perimeterLookup, smallestAreaFid } = areaCtx;

  // Get user progress for tier counts
  const progress = await getUserProgress(userId, allAreas.length);

  // Get completed areas with their perimeters
  const completedAreasMap = await getCompletedAreasWithPerimeter(userId, perimeterLookup);
  const completedAreaFids = new Set(completedAreasMap.keys());

  const allAreaFids = new Set(allAreas.map(a => a.fid));

  // Get center area FID (computed once and cached)
  const centerAreaFid = getCenterAreaFid(allAreas);

  // Get total walked distance
  const totalWalkedDistanceMeters = await getActualWalkedDistance(userId);

  // Build tier counts with defaults
  const tierCounts: TierCounts = {
    platinum: progress?.platinum_count ?? 0,
    gold: progress?.gold_count ?? 0,
    silver: progress?.silver_count ?? 0,
    bronze: progress?.bronze_count ?? 0,
    potato: progress?.potato_count ?? 0,
  };

  return {
    completedAreaCount: progress?.completed_areas ?? 0,
    tierCounts,
    completedAreaFids,
    completedAreaPerimeters: completedAreasMap,
    totalWalkedDistanceMeters,
    smallestAreaFid,
    centerAreaFid,
    allAreaFids,
    currentTime: new Date(),
  };
}

/**
 * Get the FID of the area containing Malmö's geographic center.
 * WHY: Uses Turf.js for accurate point-in-polygon check.
 */
function getCenterAreaFid(areas: AreaRow[]): number | null {
  // Return cached value if available
  if (cachedCenterAreaFid !== null) {
    return cachedCenterAreaFid;
  }

  const centerPoint = turf.point([MALMO_CENTER_LNG, MALMO_CENTER_LAT]);

  for (const area of areas) {
    try {
      const geometry = JSON.parse(area.geometry_json);
      const feature = turf.feature(geometry);

      // Check if center point is inside this area
      // WHY: Cast to any since turf types can be complex with GeoJSON geometries
      if (turf.booleanPointInPolygon(centerPoint, feature as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>)) {
        cachedCenterAreaFid = area.fid;
        console.log(`[AchievementService] Center area found: FID ${area.fid} (${area.name})`);
        return area.fid;
      }
    } catch {
      // Skip invalid geometry
    }
  }

  console.warn('[AchievementService] No area contains Malmö center point');
  return null;
}

// ============================================
// Achievement Checking
// ============================================

/**
 * Check all achievements for a user and unlock any newly earned.
 * WHY: Main entry point for achievement evaluation.
 *
 * @param userId - Database user ID
 * @param areaCtx - Area context from GeoJSON (areas, perimeters, smallest FID)
 * @returns Result containing newly unlocked achievements
 */
export async function checkAchievements(
  userId: number,
  areaCtx: AchievementAreaContext,
): Promise<CheckAchievementsResult> {
  console.log(`[AchievementService] Checking achievements for user ${userId}`);

  // Get current user state
  const state = await buildUserState(userId, areaCtx);

  // Get already unlocked achievements
  const existingUnlocks = await getUserAchievements(userId);

  // Build evaluation context with cached graph data
  const ctx: EvaluationContext = {
    state,
    adjacencyGraph: getAdjacencyGraph(areaCtx.allAreas),
    vertexMap: getVertexMap(areaCtx.allAreas),
  };

  // Track newly unlocked achievements
  const newlyUnlocked: Achievement[] = [];

  // Evaluate each achievement
  for (const achievement of ACHIEVEMENTS) {
    // Skip already unlocked
    if (existingUnlocks.has(achievement.id)) {
      continue;
    }

    // Evaluate condition
    const isEarned = evaluateCondition(
      ctx,
      achievement.conditionType,
      achievement.conditionValue
    );

    if (isEarned) {
      // Unlock the achievement
      await unlockAchievement(userId, achievement.id);
      newlyUnlocked.push(achievement);

      console.log(`[AchievementService] Unlocked: ${achievement.name} (${achievement.id})`);
    }
  }

  // Refresh unlocked achievements after any new unlocks
  const allUnlocked = await getUserAchievements(userId);

  console.log(`[AchievementService] Check complete. New unlocks: ${newlyUnlocked.length}, Total: ${allUnlocked.size}/${ACHIEVEMENTS.length}`);

  return {
    newlyUnlocked,
    allUnlocked,
    totalCount: ACHIEVEMENTS.length,
  };
}

/**
 * Get all achievements with unlock status for a user.
 * WHY: Used by achievement browser to display all achievements.
 */
export async function getAllAchievementsWithStatus(userId: number): Promise<Array<{
  achievement: Achievement;
  isUnlocked: boolean;
  unlockedAt: string | null;
}>> {
  const unlocks = await getUserAchievements(userId);

  return ACHIEVEMENTS.map(achievement => {
    const unlock = unlocks.get(achievement.id);
    return {
      achievement,
      isUnlocked: !!unlock,
      unlockedAt: unlock?.unlockedAt ?? null,
    };
  });
}

/**
 * Get achievement statistics for a user.
 * WHY: Used for header display (e.g., "12 / 40 unlocked").
 */
export async function getAchievementStats(userId: number): Promise<{
  unlockedCount: number;
  totalCount: number;
  percentage: number;
}> {
  const unlocks = await getUserAchievements(userId);
  const unlockedCount = unlocks.size;
  const totalCount = ACHIEVEMENTS.length;
  const percentage = totalCount > 0 ? (unlockedCount / totalCount) * 100 : 0;

  return {
    unlockedCount,
    totalCount,
    percentage,
  };
}

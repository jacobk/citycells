/**
 * Achievement Condition Evaluators
 * 
 * Modular functions for evaluating each type of achievement condition.
 * Each function is pure and independently testable.
 * 
 * See ADR 019 for condition type definitions.
 * See TICKET-023 for implementation requirements.
 * 
 * @module achievement-conditions
 */

import type { TierCounts } from './types/tiers';
import type { AdjacencyGraph, VertexMap } from './adjacency';
import {
  findLargestConnectedCluster,
  hasAreasShareVertex,
  hasLinearChain,
  hasEncirclement,
} from './adjacency';

// ============================================
// Types
// ============================================

/**
 * User state for achievement evaluation.
 * WHY: Pre-aggregated data to evaluate all achievements in single pass.
 */
export interface UserState {
  /** Total count of completed areas */
  completedAreaCount: number;
  /** Tier counts from user progress */
  tierCounts: TierCounts;
  /** Set of completed area FIDs */
  completedAreaFids: Set<number>;
  /** Map of completed area FID -> perimeter in meters */
  completedAreaPerimeters: Map<number, number>;
  /** Total walked distance in meters */
  totalWalkedDistanceMeters: number;
  /** FID of the smallest area (by perimeter) */
  smallestAreaFid: number | null;
  /** FID of the area containing Malmö's center */
  centerAreaFid: number | null;
  /** Set of all area FIDs */
  allAreaFids: Set<number>;
  /** Current time (for time-based achievements) */
  currentTime: Date;
}

/**
 * Context for evaluation that includes cached graph data.
 */
export interface EvaluationContext {
  state: UserState;
  adjacencyGraph: AdjacencyGraph;
  vertexMap: VertexMap;
}

// ============================================
// Area Count Evaluators
// ============================================

/**
 * Evaluate area_count condition.
 * WHY: Simple count check for milestone achievements.
 */
export function evaluateAreaCount(
  state: UserState,
  condition: { count: number }
): boolean {
  return state.completedAreaCount >= condition.count;
}

/**
 * Evaluate hidden_exact_count condition (The Answer).
 * WHY: Must be EXACTLY the target count (42).
 */
export function evaluateExactCount(
  state: UserState,
  condition: { count: number }
): boolean {
  return state.completedAreaCount === condition.count;
}

// ============================================
// Tier Evaluators
// ============================================

/**
 * Evaluate tier_first condition.
 * WHY: Check if user has at least one of a specific tier.
 */
export function evaluateTierFirst(
  state: UserState,
  condition: { tier: string }
): boolean {
  const tier = condition.tier as keyof TierCounts;
  return (state.tierCounts[tier] ?? 0) >= 1;
}

/**
 * Evaluate tier_count condition.
 * WHY: Check if user has N of a specific tier (or better for gold_or_better).
 */
export function evaluateTierCount(
  state: UserState,
  condition: { tier: string; count: number }
): boolean {
  if (condition.tier === 'gold_or_better') {
    // WHY: Gold or better = gold + platinum
    const goldOrBetter = state.tierCounts.gold + state.tierCounts.platinum;
    return goldOrBetter >= condition.count;
  }
  
  const tier = condition.tier as keyof TierCounts;
  return (state.tierCounts[tier] ?? 0) >= condition.count;
}

// ============================================
// Adjacent Area Evaluators
// ============================================

/**
 * Evaluate adjacent_count condition.
 * WHY: Find largest connected cluster of completed areas.
 */
export function evaluateAdjacentCount(
  ctx: EvaluationContext,
  condition: { count: number }
): boolean {
  const clusterSize = findLargestConnectedCluster(
    ctx.adjacencyGraph,
    ctx.state.completedAreaFids
  );
  return clusterSize >= condition.count;
}

// ============================================
// Configuration Evaluators
// ============================================

/**
 * Evaluate configuration condition.
 * WHY: Check for special geometric patterns.
 */
export function evaluateConfiguration(
  ctx: EvaluationContext,
  condition: { type: string }
): boolean {
  switch (condition.type) {
    case 'triple_point':
      // 3 areas sharing a single vertex
      return hasAreasShareVertex(ctx.vertexMap, ctx.state.completedAreaFids, 3);
    
    case 'crossroads':
      // 4 areas sharing a single vertex
      return hasAreasShareVertex(ctx.vertexMap, ctx.state.completedAreaFids, 4);
    
    case 'chain':
      // 5 areas in a linear chain
      return hasLinearChain(ctx.adjacencyGraph, ctx.state.completedAreaFids, 5);
    
    case 'encirclement':
      // Completed areas surrounding an incomplete area
      return hasEncirclement(
        ctx.adjacencyGraph,
        ctx.state.completedAreaFids,
        ctx.state.allAreaFids
      );
    
    default:
      return false;
  }
}

// ============================================
// Perimeter/Size Evaluators
// ============================================

/**
 * Evaluate perimeter_smallest condition (Bite Sized).
 * WHY: Check if user completed the smallest area.
 */
export function evaluatePerimeterSmallest(state: UserState): boolean {
  if (!state.smallestAreaFid) return false;
  return state.completedAreaFids.has(state.smallestAreaFid);
}

/**
 * Evaluate perimeter_single condition.
 * WHY: Check if user completed an area within perimeter range.
 */
export function evaluatePerimeterSingle(
  state: UserState,
  condition: { min_km?: number; max_km?: number }
): boolean {
  const minMeters = (condition.min_km ?? 0) * 1000;
  const maxMeters = (condition.max_km ?? Infinity) * 1000;
  
  for (const [, perimeter] of state.completedAreaPerimeters) {
    if (perimeter >= minMeters && perimeter <= maxMeters) {
      return true;
    }
  }
  
  return false;
}

/**
 * Evaluate perimeter_count condition.
 * WHY: Check if user completed N areas within perimeter range.
 */
export function evaluatePerimeterCount(
  state: UserState,
  condition: { min_km?: number; max_km?: number; count: number }
): boolean {
  const minMeters = (condition.min_km ?? 0) * 1000;
  const maxMeters = (condition.max_km ?? Infinity) * 1000;
  
  let matchCount = 0;
  for (const [, perimeter] of state.completedAreaPerimeters) {
    if (perimeter >= minMeters && perimeter <= maxMeters) {
      matchCount++;
      if (matchCount >= condition.count) {
        return true;
      }
    }
  }
  
  return false;
}

// ============================================
// Distance Evaluators
// ============================================

/**
 * Evaluate distance_total condition.
 * WHY: Check total walked distance.
 */
export function evaluateDistanceTotal(
  state: UserState,
  condition: { km: number }
): boolean {
  const targetMeters = condition.km * 1000;
  return state.totalWalkedDistanceMeters >= targetMeters;
}

// ============================================
// Hidden Achievement Evaluators
// ============================================

/**
 * Evaluate hidden_friday_13 condition (Triskaidekaphile).
 * WHY: User's 13th area completion must be happening on a Friday.
 */
export function evaluateFriday13(state: UserState): boolean {
  // Only triggers when completing the 13th area RIGHT NOW on a Friday
  if (state.completedAreaCount !== 13) {
    return false;
  }
  
  // Check if today is Friday (5 = Friday in JavaScript)
  return state.currentTime.getDay() === 5;
}

/**
 * Evaluate hidden_night_owl condition.
 * WHY: Analysis happening between 2-4 AM.
 */
export function evaluateNightOwl(state: UserState): boolean {
  const hour = state.currentTime.getHours();
  return hour >= 2 && hour < 4;
}

/**
 * Evaluate hidden_potato_pride condition.
 * WHY: User has 5+ potato tier completions.
 */
export function evaluatePotatoPride(
  state: UserState,
  condition: { count: number }
): boolean {
  return state.tierCounts.potato >= condition.count;
}

/**
 * Evaluate hidden_center_area condition (The Centered).
 * WHY: User completed the area containing Malmö's center.
 */
export function evaluateCenterArea(state: UserState): boolean {
  if (!state.centerAreaFid) return false;
  return state.completedAreaFids.has(state.centerAreaFid);
}

// ============================================
// Main Evaluation Function
// ============================================

/**
 * Evaluate a single achievement condition.
 * WHY: Dispatches to the appropriate evaluator based on condition type.
 */
export function evaluateCondition(
  ctx: EvaluationContext,
  conditionType: string,
  conditionValue: Record<string, unknown>
): boolean {
  switch (conditionType) {
    case 'area_count':
      return evaluateAreaCount(ctx.state, conditionValue as { count: number });
    
    case 'tier_first':
      return evaluateTierFirst(ctx.state, conditionValue as { tier: string });
    
    case 'tier_count':
      return evaluateTierCount(ctx.state, conditionValue as { tier: string; count: number });
    
    case 'adjacent_count':
      return evaluateAdjacentCount(ctx, conditionValue as { count: number });
    
    case 'configuration':
      return evaluateConfiguration(ctx, conditionValue as { type: string });
    
    case 'perimeter_smallest':
      return evaluatePerimeterSmallest(ctx.state);
    
    case 'perimeter_single':
      return evaluatePerimeterSingle(ctx.state, conditionValue as { min_km?: number; max_km?: number });
    
    case 'perimeter_count':
      return evaluatePerimeterCount(ctx.state, conditionValue as { min_km?: number; max_km?: number; count: number });
    
    case 'distance_total':
      return evaluateDistanceTotal(ctx.state, conditionValue as { km: number });
    
    case 'hidden_exact_count':
      return evaluateExactCount(ctx.state, conditionValue as { count: number });
    
    case 'hidden_friday_13':
      return evaluateFriday13(ctx.state);
    
    case 'hidden_night_owl':
      return evaluateNightOwl(ctx.state);
    
    case 'hidden_potato_pride':
      return evaluatePotatoPride(ctx.state, conditionValue as { count: number });
    
    case 'hidden_center_area':
      return evaluateCenterArea(ctx.state);
    
    default:
      console.warn(`[AchievementConditions] Unknown condition type: ${conditionType}`);
      return false;
  }
}

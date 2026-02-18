/**
 * Tiered Distance-Based Boundary Scoring
 * 
 * WHY: The binary 25m threshold (ADR 003) doesn't reward precision.
 * This module implements a 6-tier distance classification that:
 * - Rewards walks closer to the boundary with higher scores
 * - Provides graduated feedback via tier colors
 * - Uses segment-length weighting for fair scoring
 * 
 * @see docs/ADR/021-tiered-distance-scoring.md - Full specification
 * @see docs/ADR/003-multi-metric-completion-scoring.md - Original scoring system
 * 
 * @module distance-tiers
 */

import * as turf from '@turf/turf';
import type { Feature, LineString, Position } from 'geojson';
import { distanceToPerimeterLines } from './geo-distance';

// =============================================================================
// Constants - See ADR 021 Section 1 for rationale
// =============================================================================

/**
 * Distance thresholds for each tier in meters.
 * 
 * WHY: These thresholds balance GPS accuracy (5-15m typical) with
 * rewarding precise walking. The graduated tiers create an S-curve
 * distribution that rewards precision without over-penalizing GPS drift.
 */
export const DISTANCE_TIER_THRESHOLDS = {
  platinum: 10,  // meters - GPS-perfect tracking
  gold: 20,      // meters - Excellent precision
  silver: 30,    // meters - Good precision
  bronze: 40,    // meters - Acceptable
  potato: 50,    // meters - Minimal credit
  // missed: > 50 meters - Too far to count
} as const;

/**
 * Point values for each tier.
 * 
 * WHY: Non-linear scoring creates an S-curve that:
 * - Platinum→Gold (-0.20): Small penalty; both excellent
 * - Gold→Silver (-0.25): Moderate; crossing excellence threshold
 * - Silver→Bronze (-0.25): Moderate; from good to marginal
 * - Bronze→Potato (-0.20): Small; both marginal
 * - Potato→Missed (-0.10): Full elimination
 * 
 * See ADR 021 Section 1 for detailed rationale.
 */
export const TIER_POINTS = {
  platinum: 1.0,
  gold: 0.80,
  silver: 0.55,
  bronze: 0.30,
  potato: 0.10,
  missed: 0,
} as const;

// =============================================================================
// Types
// =============================================================================

/**
 * Distance tier classification.
 * WHY: 6 tiers provide graduated feedback vs binary pass/fail.
 */
export type DistanceTier = 'platinum' | 'gold' | 'silver' | 'bronze' | 'potato' | 'missed';

/**
 * Distribution of walk distance across tiers.
 * WHY: Shows user exactly where quality was gained/lost.
 * Values represent percentage of total walk length in each tier (sum to 1.0).
 */
export type TierDistribution = Record<DistanceTier, number>;

/**
 * A classified walk segment with its tier assignment.
 * WHY: Enables per-segment route coloring in Phase 3.
 */
export interface TieredSegment {
  startIndex: number;
  endIndex: number;
  tier: DistanceTier;
  distanceMeters: number;        // Distance from segment midpoint to boundary
  segmentLengthMeters: number;   // Length of this segment (for weighting)
}

/**
 * Result of tiered border score calculation.
 */
export interface TieredBorderScoreResult {
  score: number;                   // 0-1, weighted aggregate
  tierDistribution: TierDistribution;  // % of walk in each tier
  segments: TieredSegment[];       // Per-segment classification for visualization
}

// =============================================================================
// Functions
// =============================================================================

/**
 * Assign a distance tier and point value based on distance from boundary.
 * 
 * WHY: Simple threshold check using the graduated tier system from ADR 021.
 * This replaces the binary 25m threshold with 6 graduated tiers.
 * 
 * @param distanceMeters - Distance from walk point to boundary in meters
 * @returns Object with tier name and point value
 * 
 * @example
 * assignDistanceTier(8)   // { tier: 'platinum', points: 1.0 }
 * assignDistanceTier(25)  // { tier: 'silver', points: 0.55 }
 * assignDistanceTier(60)  // { tier: 'missed', points: 0 }
 */
export function assignDistanceTier(distanceMeters: number): { tier: DistanceTier; points: number } {
  // WHY: Check thresholds from tightest to loosest
  // Each tier has inclusive upper bound (≤ threshold)
  if (distanceMeters <= DISTANCE_TIER_THRESHOLDS.platinum) {
    return { tier: 'platinum', points: TIER_POINTS.platinum };
  }
  if (distanceMeters <= DISTANCE_TIER_THRESHOLDS.gold) {
    return { tier: 'gold', points: TIER_POINTS.gold };
  }
  if (distanceMeters <= DISTANCE_TIER_THRESHOLDS.silver) {
    return { tier: 'silver', points: TIER_POINTS.silver };
  }
  if (distanceMeters <= DISTANCE_TIER_THRESHOLDS.bronze) {
    return { tier: 'bronze', points: TIER_POINTS.bronze };
  }
  if (distanceMeters <= DISTANCE_TIER_THRESHOLDS.potato) {
    return { tier: 'potato', points: TIER_POINTS.potato };
  }
  // > 50m = missed
  return { tier: 'missed', points: TIER_POINTS.missed };
}

/**
 * Calculate the tiered border score for a walk against boundary lines.
 * 
 * WHY: Implements the segment-length-weighted mean from ADR 021 Section 2-3.
 * This provides fair scoring where 100m of Gold counts more than 10m of Gold.
 * 
 * Algorithm:
 * 1. For each walk segment, calculate midpoint
 * 2. Find minimum distance from midpoint to any boundary line
 * 3. Assign tier based on distance
 * 4. Weight by segment length using Haversine distance
 * 5. Aggregate: score = sum(tier_points × segment_length) / sum(segment_length)
 * 
 * @param walkCoordinates - Array of [lng, lat] positions from GPS
 * @param boundaryLines - Array of LineString features representing area perimeter
 * @returns Score (0-1), tier distribution (percentages), and per-segment data
 * 
 * @see ADR 021 Section 2 for per-segment calculation details
 * @see ADR 021 Section 3 for aggregation method rationale
 */
export function calculateTieredBorderScore(
  walkCoordinates: Position[],
  boundaryLines: Feature<LineString>[]
): TieredBorderScoreResult {
  // Handle edge cases
  if (walkCoordinates.length < 2 || boundaryLines.length === 0) {
    return {
      score: 0,
      tierDistribution: {
        platinum: 0,
        gold: 0,
        silver: 0,
        bronze: 0,
        potato: 0,
        missed: 1, // All distance counted as missed
      },
      segments: [],
    };
  }

  const segments: TieredSegment[] = [];
  let totalLength = 0;
  let weightedPointsSum = 0;
  
  // WHY: Track length in each tier for distribution calculation
  const tierLengths: Record<DistanceTier, number> = {
    platinum: 0,
    gold: 0,
    silver: 0,
    bronze: 0,
    potato: 0,
    missed: 0,
  };

  // Process each walk segment
  for (let i = 0; i < walkCoordinates.length - 1; i++) {
    const startCoord = walkCoordinates[i];
    const endCoord = walkCoordinates[i + 1];
    
    // WHY: Use midpoint for tier assignment per ADR 021 Section 2
    // This is more stable than using start/end points which may straddle tier boundaries
    const midpoint = turf.midpoint(
      turf.point(startCoord),
      turf.point(endCoord)
    );
    const midpointCoords = midpoint.geometry.coordinates;
    
    // Find minimum distance from midpoint to any boundary line
    const distance = distanceToPerimeterLines(midpointCoords, boundaryLines);
    
    // Assign tier based on distance
    const { tier, points } = assignDistanceTier(distance);
    
    // WHY: Use Haversine distance for segment length (meters)
    // This accounts for Earth's curvature and provides accurate weighting
    const segmentLength = turf.distance(
      turf.point(startCoord),
      turf.point(endCoord),
      { units: 'meters' }
    );
    
    // Accumulate for weighted mean calculation
    totalLength += segmentLength;
    weightedPointsSum += points * segmentLength;
    tierLengths[tier] += segmentLength;
    
    // Store segment data for visualization (Phase 3)
    segments.push({
      startIndex: i,
      endIndex: i + 1,
      tier,
      distanceMeters: distance,
      segmentLengthMeters: segmentLength,
    });
  }

  // WHY: Calculate weighted mean score per ADR 021 Section 3
  // score = Σ(tier_points × segment_length) / Σ(segment_length)
  const score = totalLength > 0 ? weightedPointsSum / totalLength : 0;
  
  // WHY: Convert tier lengths to percentages for UI display
  // Percentages should sum to 1.0 (within floating point tolerance)
  const tierDistribution: TierDistribution = {
    platinum: totalLength > 0 ? tierLengths.platinum / totalLength : 0,
    gold: totalLength > 0 ? tierLengths.gold / totalLength : 0,
    silver: totalLength > 0 ? tierLengths.silver / totalLength : 0,
    bronze: totalLength > 0 ? tierLengths.bronze / totalLength : 0,
    potato: totalLength > 0 ? tierLengths.potato / totalLength : 0,
    missed: totalLength > 0 ? tierLengths.missed / totalLength : 0,
  };

  return {
    score,
    tierDistribution,
    segments,
  };
}

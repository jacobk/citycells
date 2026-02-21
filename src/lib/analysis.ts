/**
 * CityCells Analysis Engine
 * 
 * Multi-metric scoring system for walk analysis.
 * See ADR 003 for algorithm details and rationale.
 * 
 * @module analysis
 */

import * as turf from '@turf/turf';
import type { Feature, Polygon, MultiPolygon, LineString, Position } from 'geojson';

// WHY: Re-export tier types and constants from centralized ./tiers module
// This maintains backwards compatibility for existing imports from ./analysis
// See TICKET-016 for the potato tier bug that led to this centralization
export { assignTier, TIER_THRESHOLDS, type Tier } from './tiers';
import { assignTier, type Tier } from './tiers';

// WHY: Import consolidated distance utilities from geo-distance.ts
// Eliminates duplication - see TICKET-018 for consolidation rationale
import {
  distanceToLine,
  nearestPointOnLine,
  polygonToPerimeterLines,
  PERIMETER_BUFFER_METERS,
} from './geo-distance';

// WHY: Import tiered distance scoring from new module per ADR 021
// This replaces the binary 25m threshold with 6-tier graduated scoring
import {
  calculateTieredBorderScore,
  type TierDistribution,
  type TieredSegment,
} from './distance-tiers';

// Re-export for convenience
export type { TierDistribution, TieredSegment } from './distance-tiers';
export { DISTANCE_TIER_THRESHOLDS, TIER_POINTS, assignDistanceTier } from './distance-tiers';

// Re-export for backwards compatibility
export { PERIMETER_BUFFER_METERS } from './geo-distance';

// WHY: 100m threshold for considering a walk "closed" - allows for
// imprecise GPS at start/end points while still requiring reasonable closure
export const LOOP_CLOSURE_THRESHOLD_METERS = 100;

// WHY: 50m normalization for RMSE converts raw meters to 0-1 score
// A walk averaging 50m from border gets alignment_score = 0
export const RMSE_NORMALIZATION_METERS = 50;

// WHY: 30m deviation threshold triggers deviation detection
// Balances catching real detours vs GPS noise
export const DEVIATION_THRESHOLD_METERS = 30;

// WHY: Quality score weights from ADR 003 (legacy - kept for backward compatibility)
// Perimeter coverage is primary goal (40%), area coverage rewards closure (25%),
// alignment rewards precision (20%), efficiency penalizes detours (15%)
export const SCORE_WEIGHTS = {
  perimeterCoverage: 0.40,
  areaCoverage: 0.25,
  alignment: 0.20,
  efficiency: 0.15,
} as const;

// WHY: New weights per ADR 021 - tiered border score absorbs alignment
// The tiered border score captures both coverage AND precision, so alignment
// is removed as a separate component. Walk focus (efficiency) gets increased
// weight to provide stronger penalty for detours.
// See ADR 021 Section 4 for rationale.
export const TIERED_SCORE_WEIGHTS = {
  tieredBorder: 0.45,   // Captures both coverage AND precision
  areaCoverage: 0.25,   // Unchanged - rewards closing the loop
  walkFocus: 0.30,      // Renamed from efficiency, increased weight
} as const;

// ============================================
// Types
// ============================================

export interface AnalysisMetrics {
  // Perimeter metrics
  perimeterCoveragePercent: number;
  coveredDistanceMeters: number;
  
  // Area metrics
  areaCoveragePercent: number;
  enclosedAreaSqm: number;
  isClosedLoop: boolean;
  loopGapMeters: number;
  
  // Alignment metrics (legacy - kept for backward compatibility)
  rmseMeters: number;
  maxDeviationMeters: number;
  p90DeviationMeters: number;
  alignmentScore: number; // 0-1 normalized
  
  // Efficiency metric (legacy field name kept for backward compatibility)
  efficiency: number; // 0-1
  borderAlignedLengthMeters: number;
  totalWalkLengthMeters: number;
  
  // NEW: Tiered scoring (ADR 021)
  // WHY: Replaces binary 25m threshold with 6-tier graduated scoring
  tieredBorderScore: number;           // 0-1, weighted aggregate
  tierDistribution: TierDistribution;  // % of walk in each tier (sum to 1.0)
  tieredSegments: TieredSegment[];     // Per-segment classification for visualization
  
  // WHY: Renamed for clarity per ADR 021 Section 5 - same value as efficiency
  // "Walk Focus" better describes what it measures: % of walk on the edge
  walkFocus: number;  // Same as efficiency, renamed per ADR 021
  
  // Composite score
  rawQualityScore: number;
  tier: Tier;
}

export interface DeviationSegment {
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
  classification: 'obstacle_avoidance' | 'shortcut' | 'drift';
}

export interface FullAnalysisResult {
  metrics: AnalysisMetrics;
  deviations: DeviationSegment[];
}

// ============================================
// Helper Functions
// ============================================

// WHY: distanceToLine, nearestPointOnLine, and polygonToPerimeterLines are now
// imported from geo-distance.ts to avoid duplication. See TICKET-018.

/**
 * Calculate the 90th percentile of an array of numbers.
 */
function percentile90(values: number[]): number {
  if (values.length === 0) return 0;
  
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.floor(sorted.length * 0.9);
  return sorted[Math.min(index, sorted.length - 1)];
}

// ============================================
// Metric Calculations
// ============================================

/**
 * Calculate perimeter coverage.
 * 
 * WHY: Measures what percentage of the area's border was walked.
 * Uses a 25m buffer to account for GPS accuracy and sidewalk offsets.
 * See ADR 002 and ADR 003 for rationale.
 */
export function calculatePerimeterCoverage(
  walkLine: Feature<LineString>,
  areaPolygon: Feature<Polygon | MultiPolygon>,
  perimeterLengthMeters: number
): { coveragePercent: number; coveredMeters: number } {
  // WHY: polygonToPerimeterLines always returns array - handles MultiPolygon case
  const lines = polygonToPerimeterLines(areaPolygon);
  let totalCoveredMeters = 0;
  
  for (const line of lines) {
    // WHY: 25m buffer - see PERIMETER_BUFFER_METERS constant
    const bufferedPerimeter = turf.buffer(line, PERIMETER_BUFFER_METERS / 1000, { units: 'kilometers' });
    
    if (!bufferedPerimeter) continue;
    
    // Find intersection of walk with buffered perimeter
    try {
      // WHY: Use turf.lineIntersect for line-polygon intersection
      // turf.intersect is typed for polygon-polygon only
      // WHY: We calculate intersections but only use the count for validation
      // The actual coverage is computed by checking if segment midpoints are in buffer
      turf.lineIntersect(walkLine, bufferedPerimeter);
      
      // For coverage, we need the actual line segments within the buffer
      // Use booleanWithin to check which segments of the walk are inside the buffer
      const walkCoords = walkLine.geometry.coordinates;
      for (let j = 0; j < walkCoords.length - 1; j++) {
        const segment = turf.lineString([walkCoords[j], walkCoords[j + 1]]);
        const midpoint = turf.midpoint(turf.point(walkCoords[j]), turf.point(walkCoords[j + 1]));
        
        if (turf.booleanPointInPolygon(midpoint, bufferedPerimeter)) {
          totalCoveredMeters += turf.length(segment, { units: 'meters' });
        }
      }
    } catch {
      // Intersection failed, continue
    }
  }
  
  const coveragePercent = Math.min(totalCoveredMeters / perimeterLengthMeters, 1.0);
  
  return {
    coveragePercent,
    coveredMeters: totalCoveredMeters,
  };
}

/**
 * Strava metadata for more accurate loop detection.
 * WHY: The summary_polyline from Strava is often truncated at start/end,
 * causing false negatives in loop detection. Strava's start_latlng/end_latlng
 * are more reliable as they come from the full GPS stream.
 */
export interface StravaMetadata {
  startLatLng?: [number, number]; // [lat, lng] format from Strava API
  endLatLng?: [number, number];   // [lat, lng] format from Strava API
  distance?: number; // Actual distance in meters from Strava API
  streamTime?: number[]; // Optional stream time indices for future use
  streamDistance?: number[]; // Optional stream distance indices for future use
}

/**
 * Detect if walk forms a closed loop.
 * 
 * WHY: 100m threshold allows for GPS imprecision at start/end
 * while still requiring the walker to return near their starting point.
 * See ADR 003 for rationale.
 * 
 * NOTE: Strava's summary_polyline is often truncated, losing GPS points at
 * the start and end. When stravaMetadata is provided, we use Strava's
 * start_latlng/end_latlng which are more accurate.
 */
export function detectLoop(
  walkCoordinates: Position[],
  stravaMetadata?: StravaMetadata
): { isClosedLoop: boolean; gapMeters: number } {
  // WHY: Prefer Strava metadata when available - summary polyline is often truncated
  // The metadata comes from Strava's full GPS stream and is more reliable
  if (stravaMetadata?.startLatLng && stravaMetadata?.endLatLng) {
    // Convert from Strava [lat, lng] to GeoJSON [lng, lat]
    const start: Position = [stravaMetadata.startLatLng[1], stravaMetadata.startLatLng[0]];
    const end: Position = [stravaMetadata.endLatLng[1], stravaMetadata.endLatLng[0]];

    const gapMeters = turf.distance(turf.point(start), turf.point(end), { units: 'meters' });
    const isClosedLoop = gapMeters <= LOOP_CLOSURE_THRESHOLD_METERS;
    
    return { isClosedLoop, gapMeters };
  }
  
  // Fallback to coordinates array if no metadata
  if (walkCoordinates.length < 2) {
    return { isClosedLoop: false, gapMeters: Infinity };
  }
  
  const start = walkCoordinates[0];
  const end = walkCoordinates[walkCoordinates.length - 1];
  
  const gapMeters = turf.distance(turf.point(start), turf.point(end), { units: 'meters' });
  
  // WHY: 100m threshold - see LOOP_CLOSURE_THRESHOLD_METERS constant
  const isClosedLoop = gapMeters <= LOOP_CLOSURE_THRESHOLD_METERS;
  
  return { isClosedLoop, gapMeters };
}

/**
 * Calculate area coverage (how much of the sub-area is enclosed by the walk).
 * 
 * WHY: Rewards walks that actually encircle the area, not just trace part of the border.
 * Only applies to closed loops. See ADR 003 for rationale.
 */
export function calculateAreaCoverage(
  walkCoordinates: Position[],
  areaPolygon: Feature<Polygon | MultiPolygon>,
  areaSqm: number,
  isClosedLoop: boolean
): { coveragePercent: number; enclosedSqm: number } {
  // WHY: Open paths cannot enclose area - see ADR 003
  if (!isClosedLoop || walkCoordinates.length < 4) {
    return { coveragePercent: 0, enclosedSqm: 0 };
  }
  
  try {
    // Close the walk path by connecting end to start
    const closedCoords = [...walkCoordinates];
    if (closedCoords[0][0] !== closedCoords[closedCoords.length - 1][0] ||
        closedCoords[0][1] !== closedCoords[closedCoords.length - 1][1]) {
      closedCoords.push(closedCoords[0]);
    }
    
    // Create polygon from walk path
    const walkPolygon = turf.polygon([closedCoords]);
    
    // Calculate intersection with area polygon
    const intersection = turf.intersect(
      turf.featureCollection([walkPolygon, areaPolygon])
    );
    
    if (!intersection) {
      return { coveragePercent: 0, enclosedSqm: 0 };
    }
    
    const enclosedSqm = turf.area(intersection);
    const coveragePercent = Math.min(enclosedSqm / areaSqm, 1.0);
    
    return { coveragePercent, enclosedSqm };
  } catch {
    // Invalid polygon (self-intersecting, etc.)
    return { coveragePercent: 0, enclosedSqm: 0 };
  }
}

/**
 * Calculate alignment error metrics (RMSE, max, P90).
 * 
 * WHY: RMSE penalizes large deviations more than small ones,
 * encouraging walkers to stay consistently close to the border.
 * Normalized to 0-1 where 0 = perfect, 1 = 50m+ average error.
 * See ADR 003 for rationale.
 */
export function calculateAlignmentError(
  walkCoordinates: Position[],
  areaPolygon: Feature<Polygon | MultiPolygon>
): { rmseMeters: number; maxMeters: number; p90Meters: number; alignmentScore: number } {
  // WHY: polygonToPerimeterLines always returns array - handles MultiPolygon case
  const lines = polygonToPerimeterLines(areaPolygon);
  const distances: number[] = [];
  
  for (const coord of walkCoordinates) {
    // Find minimum distance to any perimeter line
    let minDist = Infinity;
    for (const line of lines) {
      const dist = distanceToLine(coord, line);
      if (dist < minDist) {
        minDist = dist;
      }
    }
    distances.push(minDist);
  }
  
  if (distances.length === 0) {
    return { rmseMeters: 0, maxMeters: 0, p90Meters: 0, alignmentScore: 1 };
  }
  
  // Calculate RMSE
  const sumSquared = distances.reduce((sum, d) => sum + d * d, 0);
  const rmseMeters = Math.sqrt(sumSquared / distances.length);
  
  // Max deviation
  const maxMeters = Math.max(...distances);
  
  // 90th percentile (more robust than max)
  const p90Meters = percentile90(distances);
  
  // WHY: Normalize to 0-1 using 50m reference - see ADR 003
  const alignmentScore = Math.max(0, 1 - rmseMeters / RMSE_NORMALIZATION_METERS);
  
  return { rmseMeters, maxMeters, p90Meters, alignmentScore };
}

/**
 * Calculate efficiency (precision).
 * 
 * WHY: Penalizes unnecessary detours - a walk that covers the border
 * efficiently should score higher than one with lots of backtracking.
 * See ADR 003 for rationale.
 */
export function calculateEfficiency(
  walkLine: Feature<LineString>,
  areaPolygon: Feature<Polygon | MultiPolygon>,
  stravaDistance?: number
): { efficiency: number; borderAlignedMeters: number; totalWalkMeters: number } {
  // WHY: Strava summary_polyline can be truncated by privacy zones; prefer full distance.
  const totalWalkMeters = typeof stravaDistance === 'number'
    ? stravaDistance
    : turf.length(walkLine, { units: 'meters' });
  
  if (totalWalkMeters === 0) {
    return { efficiency: 0, borderAlignedMeters: 0, totalWalkMeters: 0 };
  }
  
  // WHY: polygonToPerimeterLines always returns array - handles MultiPolygon case
  const lines = polygonToPerimeterLines(areaPolygon);
  
  // Create buffer around perimeter and find intersection
  let borderAlignedMeters = 0;
  
  for (const line of lines) {
    const bufferedPerimeter = turf.buffer(line, PERIMETER_BUFFER_METERS / 1000, { units: 'kilometers' });
    
    if (!bufferedPerimeter) continue;
    
    try {
      // WHY: Check each segment's midpoint to determine if it's within the buffer
      // This is more reliable than trying to intersect LineString with Polygon
      const walkCoords = walkLine.geometry.coordinates;
      for (let j = 0; j < walkCoords.length - 1; j++) {
        const segment = turf.lineString([walkCoords[j], walkCoords[j + 1]]);
        const midpoint = turf.midpoint(turf.point(walkCoords[j]), turf.point(walkCoords[j + 1]));
        
        if (turf.booleanPointInPolygon(midpoint, bufferedPerimeter)) {
          borderAlignedMeters += turf.length(segment, { units: 'meters' });
        }
      }
    } catch {
      // Intersection failed
    }
  }
  
  const efficiency = Math.min(borderAlignedMeters / totalWalkMeters, 1.0);
  
  return { efficiency, borderAlignedMeters, totalWalkMeters };
}

/**
 * Calculate composite quality score and assign tier (legacy formula).
 * 
 * WHY: Weighted combination from ADR 003:
 * - 40% perimeter coverage (primary goal)
 * - 25% area coverage (rewards closure)
 * - 20% alignment (rewards precision)
 * - 15% efficiency (penalizes detours)
 * 
 * @deprecated Use calculateTieredQualityScore for new code (ADR 021)
 */
export function calculateQualityScore(
  perimeterCoverage: number,
  areaCoverage: number,
  alignmentScore: number,
  efficiency: number
): { score: number; tier: Tier } {
  const score = 
    SCORE_WEIGHTS.perimeterCoverage * perimeterCoverage +
    SCORE_WEIGHTS.areaCoverage * areaCoverage +
    SCORE_WEIGHTS.alignment * alignmentScore +
    SCORE_WEIGHTS.efficiency * efficiency;
  
  // WHY: Use centralized assignTier() for consistent tier assignment
  // See TICKET-016 for why this was centralized (potato tier bug)
  const tier = assignTier(score);
  
  return { score, tier };
}

/**
 * Calculate composite quality score using tiered border scoring (ADR 021).
 * 
 * WHY: New scoring formula per ADR 021 Section 4:
 * - 45% tiered border score (captures both coverage AND precision)
 * - 25% area coverage (unchanged - rewards closing the loop)
 * - 30% walk focus (renamed from efficiency, increased weight)
 * 
 * This replaces the legacy formula that had separate alignment scoring.
 * The tiered border score inherently captures precision, so alignment
 * is no longer needed as a separate component.
 */
export function calculateTieredQualityScore(
  tieredBorderScore: number,
  areaCoverage: number,
  walkFocus: number
): { score: number; tier: Tier } {
  const score = 
    TIERED_SCORE_WEIGHTS.tieredBorder * tieredBorderScore +
    TIERED_SCORE_WEIGHTS.areaCoverage * areaCoverage +
    TIERED_SCORE_WEIGHTS.walkFocus * walkFocus;
  
  // WHY: Use centralized assignTier() for consistent tier assignment
  // See TICKET-016 for why this was centralized (potato tier bug)
  const tier = assignTier(score);
  
  return { score, tier };
}

/**
 * Detect deviation segments where walker left the border.
 * 
 * WHY: Identifies "peninsula-shaped" detours where walker avoided an obstacle.
 * Uses 30m threshold to distinguish real detours from GPS noise.
 * See ADR 003 for algorithm and classification heuristics.
 */
export function detectDeviations(
  walkCoordinates: Position[],
  areaPolygon: Feature<Polygon | MultiPolygon>
): DeviationSegment[] {
  const deviations: DeviationSegment[] = [];
  
  if (walkCoordinates.length < 3) {
    return deviations;
  }
  
  // WHY: polygonToPerimeterLines always returns array - handles MultiPolygon case
  const lines = polygonToPerimeterLines(areaPolygon);
  const primaryLine = lines[0]; // Use primary perimeter for border distance
  
  let inDeviation = false;
  let deviationStartIndex = 0;
  let deviationStartBorderPoint: Position = [0, 0];
  let maxDeviationInSegment = 0;
  
  for (let i = 0; i < walkCoordinates.length; i++) {
    const coord = walkCoordinates[i];
    
    // Find minimum distance to border
    let minDist = Infinity;
    for (const line of lines) {
      const dist = distanceToLine(coord, line);
      if (dist < minDist) {
        minDist = dist;
      }
    }
    
    // WHY: 30m threshold - see DEVIATION_THRESHOLD_METERS constant
    if (!inDeviation && minDist > DEVIATION_THRESHOLD_METERS) {
      // Start of deviation
      inDeviation = true;
      deviationStartIndex = Math.max(0, i - 1);
      deviationStartBorderPoint = nearestPointOnLine(
        walkCoordinates[deviationStartIndex], 
        primaryLine
      );
      maxDeviationInSegment = minDist;
    } else if (inDeviation) {
      maxDeviationInSegment = Math.max(maxDeviationInSegment, minDist);
      
      if (minDist <= DEVIATION_THRESHOLD_METERS) {
        // End of deviation
        inDeviation = false;
        
        const endBorderPoint = nearestPointOnLine(coord, primaryLine);
        
        // Calculate deviation metrics
        const startCoord = walkCoordinates[deviationStartIndex];
        const endCoord = coord;
        
        // Border gap: distance along border between start and end
        const borderGapMeters = turf.distance(
          turf.point(deviationStartBorderPoint),
          turf.point(endBorderPoint),
          { units: 'meters' }
        );
        
        // Detour distance: actual path length during deviation
        let detourDistanceMeters = 0;
        for (let j = deviationStartIndex; j < i; j++) {
          detourDistanceMeters += turf.distance(
            turf.point(walkCoordinates[j]),
            turf.point(walkCoordinates[j + 1]),
            { units: 'meters' }
          );
        }
        
        // Return accuracy: how close end is to where we left
        const returnAccuracyMeters = turf.distance(
          turf.point(endBorderPoint),
          turf.point(deviationStartBorderPoint),
          { units: 'meters' }
        );
        
        const detourRatio = borderGapMeters > 0 ? detourDistanceMeters / borderGapMeters : 0;
        
        // WHY: Classification heuristic from ADR 003
        let classification: DeviationSegment['classification'];
        if (detourRatio >= 2.0 && returnAccuracyMeters < 50) {
          classification = 'obstacle_avoidance';
        } else if (detourRatio < 1.5) {
          classification = 'shortcut';
        } else {
          classification = 'drift';
        }
        
        deviations.push({
          startPointIndex: deviationStartIndex,
          endPointIndex: i,
          startLat: startCoord[1],
          startLng: startCoord[0],
          endLat: endCoord[1],
          endLng: endCoord[0],
          startBorderLat: deviationStartBorderPoint[1],
          startBorderLng: deviationStartBorderPoint[0],
          endBorderLat: endBorderPoint[1],
          endBorderLng: endBorderPoint[0],
          borderGapMeters,
          detourDistanceMeters,
          maxDeviationMeters: maxDeviationInSegment,
          returnAccuracyMeters,
          detourRatio,
          classification,
        });
      }
    }
  }
  
  return deviations;
}

// ============================================
// Main Analysis Function
// ============================================

/**
 * Perform full analysis of a walk against a sub-area.
 * 
 * @param walkCoordinates - Array of [lng, lat] positions from GPS
 * @param areaPolygon - The sub-area polygon feature
 * @param perimeterLengthMeters - Pre-calculated perimeter length
 * @param areaSqm - Pre-calculated area in square meters
 * @param stravaMetadata - Optional Strava metadata for better loop detection
 * @param streamCoordinates - Optional high-fidelity stream coordinates
 * @param loopStatusOverride - Optional override for loop detection (used during re-analysis without streams)
 * @returns Full analysis results including all metrics and deviations
 */
export function analyzeWalk(
  walkCoordinates: Position[],
  areaPolygon: Feature<Polygon | MultiPolygon>,
  perimeterLengthMeters: number,
  areaSqm: number,
  stravaMetadata?: StravaMetadata,
  streamCoordinates?: Position[],
  loopStatusOverride?: { isClosedLoop: boolean; gapMeters: number }
): FullAnalysisResult {
  const analysisCoordinates = streamCoordinates && streamCoordinates.length > 0
    ? streamCoordinates
    : walkCoordinates;

  // Convert coordinates to LineString
  const walkLine = turf.lineString(analysisCoordinates);
  
  // Get boundary lines for distance calculations (used by multiple metrics)
  // WHY: Pre-compute once and reuse - avoids redundant polygon-to-line conversion
  const boundaryLines = polygonToPerimeterLines(areaPolygon);
  
  // 1. Loop detection (uses override if provided, otherwise Strava metadata, otherwise coordinates)
  // WHY: During re-analysis without streams, the polyline is too compressed for accurate loop detection.
  // We use the previous loop status from the database instead.
  const loopResult = loopStatusOverride ?? detectLoop(analysisCoordinates, stravaMetadata);

  // 2. Perimeter coverage (legacy metric)
  const perimeterResult = calculatePerimeterCoverage(walkLine, areaPolygon, perimeterLengthMeters);
  
  // 3. Area coverage
  const areaResult = calculateAreaCoverage(analysisCoordinates, areaPolygon, areaSqm, loopResult.isClosedLoop);

  // 4. Alignment error (legacy metric - kept for backward compatibility)
  const alignmentResult = calculateAlignmentError(analysisCoordinates, areaPolygon);
  
  // 5. Efficiency (also used as walkFocus per ADR 021)
  const efficiencyResult = calculateEfficiency(walkLine, areaPolygon, stravaMetadata?.distance);
  
  // 6. NEW: Tiered border score (ADR 021)
  // WHY: Replaces binary 25m threshold with 6-tier graduated scoring
  // This captures both coverage AND precision in a single metric
  const tieredResult = calculateTieredBorderScore(analysisCoordinates, boundaryLines);
  
  // 7. Quality score and tier using NEW tiered formula (ADR 021)
  // WHY: Uses tiered border score instead of separate perimeter coverage + alignment
  const scoreResult = calculateTieredQualityScore(
    tieredResult.score,
    areaResult.coveragePercent,
    efficiencyResult.efficiency  // walkFocus = efficiency
  );
  
  // 8. Deviation detection
  const deviations = detectDeviations(analysisCoordinates, areaPolygon);
  
  return {
    metrics: {
      // Legacy perimeter metrics (kept for backward compatibility)
      perimeterCoveragePercent: perimeterResult.coveragePercent,
      coveredDistanceMeters: perimeterResult.coveredMeters,
      
      // Area metrics
      areaCoveragePercent: areaResult.coveragePercent,
      enclosedAreaSqm: areaResult.enclosedSqm,
      isClosedLoop: loopResult.isClosedLoop,
      loopGapMeters: loopResult.gapMeters,
      
      // Legacy alignment metrics (kept for backward compatibility)
      rmseMeters: alignmentResult.rmseMeters,
      maxDeviationMeters: alignmentResult.maxMeters,
      p90DeviationMeters: alignmentResult.p90Meters,
      alignmentScore: alignmentResult.alignmentScore,
      
      // Legacy efficiency (kept for backward compatibility)
      efficiency: efficiencyResult.efficiency,
      borderAlignedLengthMeters: efficiencyResult.borderAlignedMeters,
      totalWalkLengthMeters: efficiencyResult.totalWalkMeters,
      
      // NEW: Tiered scoring (ADR 021)
      tieredBorderScore: tieredResult.score,
      tierDistribution: tieredResult.tierDistribution,
      tieredSegments: tieredResult.segments,
      
      // WHY: walkFocus is same value as efficiency, renamed for clarity per ADR 021
      walkFocus: efficiencyResult.efficiency,
      
      // Composite score (now uses tiered formula)
      rawQualityScore: scoreResult.score,
      tier: scoreResult.tier,
    },
    deviations,
  };
}

/**
 * Get tier color for visualization.
 * See PRD 001 section 3.4 for color scheme.
 */
export function getTierColor(tier: Tier): string {
  switch (tier) {
    case 'platinum': return '#a855f7'; // Purple
    case 'gold': return '#eab308';     // Gold
    case 'silver': return '#9ca3af';   // Gray
    case 'bronze': return '#cd7f32';   // Bronze
    case 'potato': return '#b8936d';   // Brown (potato color) per ADR 003
    default: return '#6b7280';         // Default gray
  }
}

/**
 * Get tier display name.
 */
export function getTierDisplayName(tier: Tier): string {
  if (!tier) return 'Not Completed';
  if (tier === 'potato') return 'Potato';
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

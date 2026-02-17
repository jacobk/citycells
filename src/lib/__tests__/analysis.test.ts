/**
 * Unit Tests for Analysis Functions
 * 
 * Tests for the core analysis calculation functions in src/lib/analysis.ts.
 * These are unit tests with synthetic data - for integration tests with 
 * real Strava activities, see src/__tests__/analysis/real-activity.test.ts.
 * 
 * WHY: The ticket (TICKET-025) requires unit tests for:
 * - calculatePerimeterCoverage() - edge cases
 * - calculateAlignmentError() - RMSE scoring
 * - calculateEfficiency() - efficiency calculation
 * - calculateQualityScore() - weighted combination
 * 
 * See ADR 020 for testing strategy rationale.
 * 
 * @module lib/__tests__/analysis.test
 */

import { describe, it, expect } from 'vitest';
import * as turf from '@turf/turf';
import type { Feature, Polygon, Position } from 'geojson';
import {
  calculatePerimeterCoverage,
  calculateAlignmentError,
  calculateEfficiency,
  calculateQualityScore,
  SCORE_WEIGHTS,
  RMSE_NORMALIZATION_METERS,
} from '../analysis';

// ============================================
// Test Fixtures
// ============================================

// WHY: Simple 1km x 1km square for predictable geometry calculations
const testArea: Feature<Polygon> = {
  type: 'Feature',
  properties: { name: 'Test Area' },
  geometry: {
    type: 'Polygon',
    coordinates: [[
      [13.0, 55.6],      // SW corner
      [13.01, 55.6],     // SE corner
      [13.01, 55.61],    // NE corner
      [13.0, 55.61],     // NW corner
      [13.0, 55.6],      // Close polygon
    ]],
  },
};

const testPerimeterMeters = turf.length(turf.polygonToLine(testArea), { units: 'meters' });

// ============================================
// calculatePerimeterCoverage Tests
// ============================================

describe('calculatePerimeterCoverage', () => {
  it('should return 0% coverage for empty walk', () => {
    // WHY: Edge case - walk with only 2 points (minimum for a line)
    const emptyWalk = turf.lineString([
      [13.005, 55.605],
      [13.005, 55.605],
    ]);
    
    const result = calculatePerimeterCoverage(emptyWalk, testArea, testPerimeterMeters);
    
    expect(result.coveragePercent).toBe(0);
    expect(result.coveredMeters).toBe(0);
  });

  it('should return 100% coverage for walk tracing entire perimeter', () => {
    // WHY: Perfect walk exactly on the boundary
    const perfectWalk = turf.lineString([
      [13.0, 55.6],
      [13.01, 55.6],
      [13.01, 55.61],
      [13.0, 55.61],
      [13.0, 55.6],
    ]);
    
    const result = calculatePerimeterCoverage(perfectWalk, testArea, testPerimeterMeters);
    
    expect(result.coveragePercent).toBeGreaterThan(0.99);
  });

  it('should return ~50% coverage for walk tracing half the perimeter', () => {
    // WHY: Walk covers south and east edges only (2 of 4 edges)
    const halfWalk = turf.lineString([
      [13.0, 55.6],
      [13.01, 55.6],
      [13.01, 55.61],
    ]);
    
    const result = calculatePerimeterCoverage(halfWalk, testArea, testPerimeterMeters);
    
    // Should be approximately 50% (2 edges of 4)
    expect(result.coveragePercent).toBeGreaterThan(0.4);
    expect(result.coveragePercent).toBeLessThan(0.6);
  });

  it('should count coverage for walk within 25m buffer of perimeter', () => {
    // WHY: Walk slightly inside the boundary but within 25m buffer
    // 0.0002 degrees ≈ 20m at this latitude
    const offsetWalk = turf.lineString([
      [13.0002, 55.6002],
      [13.0098, 55.6002],
      [13.0098, 55.6098],
      [13.0002, 55.6098],
      [13.0002, 55.6002],
    ]);
    
    const result = calculatePerimeterCoverage(offsetWalk, testArea, testPerimeterMeters);
    
    // Should still get high coverage since within buffer
    expect(result.coveragePercent).toBeGreaterThan(0.8);
  });

  it('should return 0% for walk completely outside perimeter buffer', () => {
    // WHY: Walk is far from the area boundary
    const farWalk = turf.lineString([
      [13.1, 55.7],
      [13.11, 55.7],
      [13.11, 55.71],
    ]);
    
    const result = calculatePerimeterCoverage(farWalk, testArea, testPerimeterMeters);
    
    expect(result.coveragePercent).toBe(0);
    expect(result.coveredMeters).toBe(0);
  });
});

// ============================================
// calculateAlignmentError Tests
// ============================================

describe('calculateAlignmentError', () => {
  it('should return perfect alignment (score=1) for walk exactly on perimeter', () => {
    // WHY: Walk directly on the boundary should have 0 RMSE
    const perfectCoords: Position[] = [
      [13.0, 55.6],
      [13.005, 55.6],
      [13.01, 55.6],
    ];
    
    const result = calculateAlignmentError(perfectCoords, testArea);
    
    expect(result.rmseMeters).toBeLessThan(1);
    expect(result.alignmentScore).toBeGreaterThan(0.98);
  });

  it('should return moderate alignment for walk ~25m from perimeter', () => {
    // WHY: 25m is the buffer threshold - should get partial score
    // 0.00025 degrees ≈ 25m at this latitude
    const moderateCoords: Position[] = [
      [13.00025, 55.60025],
      [13.00525, 55.60025],
      [13.00975, 55.60025],
    ];
    
    const result = calculateAlignmentError(moderateCoords, testArea);
    
    // RMSE should be around 25m, alignment score around 0.5
    expect(result.rmseMeters).toBeGreaterThan(15);
    expect(result.rmseMeters).toBeLessThan(40);
    expect(result.alignmentScore).toBeGreaterThan(0.2);
    expect(result.alignmentScore).toBeLessThan(0.8);
  });

  it('should return 0 alignment for walk >50m from perimeter', () => {
    // WHY: RMSE_NORMALIZATION_METERS is 50m, so >=50m error = 0 score
    // 0.001 degrees latitude ≈ 111m at this latitude
    const farCoords: Position[] = [
      [13.005, 55.601],  // ~111m north of south perimeter
      [13.005, 55.601],
      [13.005, 55.601],
    ];
    
    const result = calculateAlignmentError(farCoords, testArea);
    
    // Points are ~111m from perimeter, well above 50m threshold
    expect(result.rmseMeters).toBeGreaterThan(RMSE_NORMALIZATION_METERS);
    expect(result.alignmentScore).toBe(0);
  });

  it('should handle empty coordinates', () => {
    const result = calculateAlignmentError([], testArea);
    
    expect(result.rmseMeters).toBe(0);
    expect(result.maxMeters).toBe(0);
    expect(result.alignmentScore).toBe(1);
  });

  it('should calculate max deviation correctly', () => {
    // WHY: Mix of close and far points
    const mixedCoords: Position[] = [
      [13.0, 55.6],        // On perimeter
      [13.005, 55.605],    // ~500m inside (far)
      [13.01, 55.6],       // On perimeter
    ];
    
    const result = calculateAlignmentError(mixedCoords, testArea);
    
    // Max should be significantly higher than RMSE
    expect(result.maxMeters).toBeGreaterThan(result.rmseMeters);
    expect(result.maxMeters).toBeGreaterThan(100); // The middle point is far
  });
});

// ============================================
// calculateEfficiency Tests
// ============================================

describe('calculateEfficiency', () => {
  it('should return 100% efficiency for walk entirely on perimeter', () => {
    // WHY: No detours = 100% of walk is border-aligned
    const efficientWalk = turf.lineString([
      [13.0, 55.6],
      [13.01, 55.6],
      [13.01, 55.61],
    ]);
    
    const result = calculateEfficiency(efficientWalk, testArea);
    
    expect(result.efficiency).toBeGreaterThan(0.99);
    expect(result.borderAlignedMeters).toBeCloseTo(result.totalWalkMeters, -1);
  });

  it('should return ~50% efficiency for walk with large detour', () => {
    // WHY: Walk goes along perimeter then detours far inside
    const inefficientWalk = turf.lineString([
      [13.0, 55.6],       // Start on perimeter
      [13.005, 55.6],     // Along perimeter
      [13.005, 55.605],   // Detour inside
      [13.005, 55.61],    // Detour continues
      [13.01, 55.61],     // Back to perimeter
    ]);
    
    const result = calculateEfficiency(inefficientWalk, testArea);
    
    // Should be less than perfect due to detour
    expect(result.efficiency).toBeLessThan(0.8);
    expect(result.efficiency).toBeGreaterThan(0.3);
  });

  it('should use Strava distance when provided', () => {
    // WHY: Strava distance is ground truth; polyline may be truncated
    const walk = turf.lineString([
      [13.0, 55.6],
      [13.01, 55.6],
    ]);
    
    const stravaDistance = 5000; // 5km (much longer than polyline)
    const result = calculateEfficiency(walk, testArea, stravaDistance);
    
    expect(result.totalWalkMeters).toBe(stravaDistance);
    // Efficiency will be low since border-aligned << total distance
    expect(result.efficiency).toBeLessThan(0.3);
  });

  it('should return 0 efficiency for empty walk', () => {
    const emptyWalk = turf.lineString([
      [13.0, 55.6],
      [13.0, 55.6],
    ]);
    
    // With 0 total distance, efficiency should be 0
    const result = calculateEfficiency(emptyWalk, testArea, 0);
    
    expect(result.efficiency).toBe(0);
    expect(result.totalWalkMeters).toBe(0);
  });

  it('should return 0% efficiency for walk completely outside area', () => {
    // WHY: Walk far from the area has no border-aligned distance
    const outsideWalk = turf.lineString([
      [13.1, 55.7],
      [13.11, 55.7],
      [13.11, 55.71],
    ]);
    
    const result = calculateEfficiency(outsideWalk, testArea);
    
    expect(result.efficiency).toBe(0);
    expect(result.borderAlignedMeters).toBe(0);
  });
});

// ============================================
// calculateQualityScore Tests
// ============================================

describe('calculateQualityScore', () => {
  it('should return platinum tier for perfect scores', () => {
    const result = calculateQualityScore(1.0, 1.0, 1.0, 1.0);
    
    expect(result.score).toBe(1.0);
    expect(result.tier).toBe('platinum');
  });

  it('should return potato tier for low scores', () => {
    const result = calculateQualityScore(0.3, 0.2, 0.1, 0.3);
    
    expect(result.score).toBeLessThan(0.5);
    expect(result.tier).toBe('potato');
  });

  it('should return null tier for zero score', () => {
    const result = calculateQualityScore(0, 0, 0, 0);
    
    expect(result.score).toBe(0);
    expect(result.tier).toBeNull();
  });

  it('should correctly apply score weights', () => {
    // WHY: Verify the weighted formula from ADR 003
    // 40% perimeter, 25% area, 20% alignment, 15% efficiency
    const perimeterCoverage = 1.0;
    const areaCoverage = 0.0;
    const alignment = 0.0;
    const efficiency = 0.0;
    
    const result = calculateQualityScore(perimeterCoverage, areaCoverage, alignment, efficiency);
    
    // With only perimeter = 1.0, score should be exactly 0.40
    expect(result.score).toBeCloseTo(SCORE_WEIGHTS.perimeterCoverage, 5);
  });

  it('should assign gold tier at boundary (0.85)', () => {
    // WHY: Test exact tier boundary
    const result = calculateQualityScore(0.85, 0.85, 0.85, 0.85);
    
    // WHY: Use toBeCloseTo to handle floating point precision
    expect(result.score).toBeCloseTo(0.85, 10);
    expect(result.tier).toBe('gold');
  });

  it('should assign silver tier just below gold boundary', () => {
    const result = calculateQualityScore(0.84, 0.84, 0.84, 0.84);
    
    // WHY: Use toBeCloseTo to handle floating point precision
    expect(result.score).toBeCloseTo(0.84, 10);
    expect(result.tier).toBe('silver');
  });

  it('should assign bronze tier at boundary (0.50)', () => {
    const result = calculateQualityScore(0.5, 0.5, 0.5, 0.5);
    
    expect(result.score).toBe(0.5);
    expect(result.tier).toBe('bronze');
  });
});

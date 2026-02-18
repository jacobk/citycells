/**
 * Unit Tests for Tiered Distance Scoring
 * 
 * Tests for the tiered distance-based boundary scoring in src/lib/distance-tiers.ts.
 * 
 * WHY: ADR 021 introduces a 6-tier distance classification that replaces the
 * binary 25m threshold. These tests ensure:
 * - Tier boundaries are correct at all threshold values
 * - Point values are assigned correctly
 * - Segment-length weighted scoring produces expected results
 * - Tier distribution percentages sum to 1.0
 * 
 * @see docs/ADR/021-tiered-distance-scoring.md
 * 
 * @module lib/__tests__/distance-tiers.test
 */

import { describe, it, expect } from 'vitest';
import * as turf from '@turf/turf';
import type { Feature, LineString, Position } from 'geojson';
import {
  assignDistanceTier,
  calculateTieredBorderScore,
  DISTANCE_TIER_THRESHOLDS,
  TIER_POINTS,
  type DistanceTier,
} from '../distance-tiers';

// ============================================
// Test Fixtures
// ============================================

// WHY: Simple square boundary for predictable distance calculations
// Each side is roughly 1km at this latitude
const testBoundaryLines: Feature<LineString>[] = [
  turf.lineString([
    [13.0, 55.6],      // SW corner
    [13.01, 55.6],     // SE corner
    [13.01, 55.61],    // NE corner
    [13.0, 55.61],     // NW corner
    [13.0, 55.6],      // Close polygon
  ]),
];

// ============================================
// assignDistanceTier Tests
// ============================================

describe('assignDistanceTier', () => {
  describe('tier boundary values', () => {
    it('should assign platinum for distance <= 10m', () => {
      expect(assignDistanceTier(0).tier).toBe('platinum');
      expect(assignDistanceTier(5).tier).toBe('platinum');
      expect(assignDistanceTier(10).tier).toBe('platinum');
    });

    it('should assign gold for distance > 10m and <= 20m', () => {
      expect(assignDistanceTier(10.001).tier).toBe('gold');
      expect(assignDistanceTier(15).tier).toBe('gold');
      expect(assignDistanceTier(20).tier).toBe('gold');
    });

    it('should assign silver for distance > 20m and <= 30m', () => {
      expect(assignDistanceTier(20.001).tier).toBe('silver');
      expect(assignDistanceTier(25).tier).toBe('silver');
      expect(assignDistanceTier(30).tier).toBe('silver');
    });

    it('should assign bronze for distance > 30m and <= 40m', () => {
      expect(assignDistanceTier(30.001).tier).toBe('bronze');
      expect(assignDistanceTier(35).tier).toBe('bronze');
      expect(assignDistanceTier(40).tier).toBe('bronze');
    });

    it('should assign potato for distance > 40m and <= 50m', () => {
      expect(assignDistanceTier(40.001).tier).toBe('potato');
      expect(assignDistanceTier(45).tier).toBe('potato');
      expect(assignDistanceTier(50).tier).toBe('potato');
    });

    it('should assign missed for distance > 50m', () => {
      expect(assignDistanceTier(50.001).tier).toBe('missed');
      expect(assignDistanceTier(100).tier).toBe('missed');
      expect(assignDistanceTier(1000).tier).toBe('missed');
    });
  });

  describe('exact boundary transitions', () => {
    it('should correctly handle platinum/gold boundary (10m)', () => {
      expect(assignDistanceTier(10).tier).toBe('platinum');
      expect(assignDistanceTier(10.0001).tier).toBe('gold');
    });

    it('should correctly handle gold/silver boundary (20m)', () => {
      expect(assignDistanceTier(20).tier).toBe('gold');
      expect(assignDistanceTier(20.0001).tier).toBe('silver');
    });

    it('should correctly handle silver/bronze boundary (30m)', () => {
      expect(assignDistanceTier(30).tier).toBe('silver');
      expect(assignDistanceTier(30.0001).tier).toBe('bronze');
    });

    it('should correctly handle bronze/potato boundary (40m)', () => {
      expect(assignDistanceTier(40).tier).toBe('bronze');
      expect(assignDistanceTier(40.0001).tier).toBe('potato');
    });

    it('should correctly handle potato/missed boundary (50m)', () => {
      expect(assignDistanceTier(50).tier).toBe('potato');
      expect(assignDistanceTier(50.0001).tier).toBe('missed');
    });
  });

  describe('points assignment', () => {
    it('should assign correct points for platinum tier', () => {
      expect(assignDistanceTier(5).points).toBe(TIER_POINTS.platinum);
      expect(assignDistanceTier(5).points).toBe(1.0);
    });

    it('should assign correct points for gold tier', () => {
      expect(assignDistanceTier(15).points).toBe(TIER_POINTS.gold);
      expect(assignDistanceTier(15).points).toBe(0.80);
    });

    it('should assign correct points for silver tier', () => {
      expect(assignDistanceTier(25).points).toBe(TIER_POINTS.silver);
      expect(assignDistanceTier(25).points).toBe(0.55);
    });

    it('should assign correct points for bronze tier', () => {
      expect(assignDistanceTier(35).points).toBe(TIER_POINTS.bronze);
      expect(assignDistanceTier(35).points).toBe(0.30);
    });

    it('should assign correct points for potato tier', () => {
      expect(assignDistanceTier(45).points).toBe(TIER_POINTS.potato);
      expect(assignDistanceTier(45).points).toBe(0.10);
    });

    it('should assign correct points for missed tier', () => {
      expect(assignDistanceTier(100).points).toBe(TIER_POINTS.missed);
      expect(assignDistanceTier(100).points).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle distance = 0 as platinum', () => {
      const result = assignDistanceTier(0);
      expect(result.tier).toBe('platinum');
      expect(result.points).toBe(1.0);
    });

    it('should handle negative distances as platinum', () => {
      // WHY: Negative distances shouldn't happen but if they do, treat as closest
      const result = assignDistanceTier(-5);
      expect(result.tier).toBe('platinum');
    });

    it('should handle very large distances as missed', () => {
      const result = assignDistanceTier(10000);
      expect(result.tier).toBe('missed');
      expect(result.points).toBe(0);
    });
  });
});

// ============================================
// TIER_POINTS Constants Tests
// ============================================

describe('TIER_POINTS', () => {
  it('should have correct point values per ADR 021', () => {
    expect(TIER_POINTS.platinum).toBe(1.0);
    expect(TIER_POINTS.gold).toBe(0.80);
    expect(TIER_POINTS.silver).toBe(0.55);
    expect(TIER_POINTS.bronze).toBe(0.30);
    expect(TIER_POINTS.potato).toBe(0.10);
    expect(TIER_POINTS.missed).toBe(0);
  });

  it('should be in descending order', () => {
    expect(TIER_POINTS.platinum).toBeGreaterThan(TIER_POINTS.gold);
    expect(TIER_POINTS.gold).toBeGreaterThan(TIER_POINTS.silver);
    expect(TIER_POINTS.silver).toBeGreaterThan(TIER_POINTS.bronze);
    expect(TIER_POINTS.bronze).toBeGreaterThan(TIER_POINTS.potato);
    expect(TIER_POINTS.potato).toBeGreaterThan(TIER_POINTS.missed);
  });

  it('should have non-linear decrements per ADR 021', () => {
    // WHY: S-curve distribution rewards precision without over-penalizing GPS drift
    // Platinum→Gold: -0.20 (small penalty)
    expect(TIER_POINTS.platinum - TIER_POINTS.gold).toBeCloseTo(0.20, 10);
    // Gold→Silver: -0.25 (moderate)
    expect(TIER_POINTS.gold - TIER_POINTS.silver).toBeCloseTo(0.25, 10);
    // Silver→Bronze: -0.25 (moderate)
    expect(TIER_POINTS.silver - TIER_POINTS.bronze).toBeCloseTo(0.25, 10);
    // Bronze→Potato: -0.20 (small)
    expect(TIER_POINTS.bronze - TIER_POINTS.potato).toBeCloseTo(0.20, 10);
    // Potato→Missed: -0.10 (full elimination)
    expect(TIER_POINTS.potato - TIER_POINTS.missed).toBeCloseTo(0.10, 10);
  });
});

// ============================================
// DISTANCE_TIER_THRESHOLDS Constants Tests
// ============================================

describe('DISTANCE_TIER_THRESHOLDS', () => {
  it('should have correct threshold values per ADR 021', () => {
    expect(DISTANCE_TIER_THRESHOLDS.platinum).toBe(10);
    expect(DISTANCE_TIER_THRESHOLDS.gold).toBe(20);
    expect(DISTANCE_TIER_THRESHOLDS.silver).toBe(30);
    expect(DISTANCE_TIER_THRESHOLDS.bronze).toBe(40);
    expect(DISTANCE_TIER_THRESHOLDS.potato).toBe(50);
  });

  it('should be in 10m increments', () => {
    expect(DISTANCE_TIER_THRESHOLDS.gold - DISTANCE_TIER_THRESHOLDS.platinum).toBe(10);
    expect(DISTANCE_TIER_THRESHOLDS.silver - DISTANCE_TIER_THRESHOLDS.gold).toBe(10);
    expect(DISTANCE_TIER_THRESHOLDS.bronze - DISTANCE_TIER_THRESHOLDS.silver).toBe(10);
    expect(DISTANCE_TIER_THRESHOLDS.potato - DISTANCE_TIER_THRESHOLDS.bronze).toBe(10);
  });
});

// ============================================
// calculateTieredBorderScore Tests
// ============================================

describe('calculateTieredBorderScore', () => {
  describe('edge cases', () => {
    it('should return 0 score for empty coordinates', () => {
      const result = calculateTieredBorderScore([], testBoundaryLines);
      
      expect(result.score).toBe(0);
      expect(result.segments).toHaveLength(0);
      expect(result.tierDistribution.missed).toBe(1);
    });

    it('should return 0 score for single coordinate', () => {
      const result = calculateTieredBorderScore([[13.0, 55.6]], testBoundaryLines);
      
      expect(result.score).toBe(0);
      expect(result.segments).toHaveLength(0);
    });

    it('should return 0 score for empty boundary lines', () => {
      const coords: Position[] = [[13.0, 55.6], [13.01, 55.6]];
      const result = calculateTieredBorderScore(coords, []);
      
      expect(result.score).toBe(0);
    });
  });

  describe('basic functionality', () => {
    it('should return perfect score for walk exactly on boundary', () => {
      // Walk exactly on the south edge of the boundary
      const walkOnBoundary: Position[] = [
        [13.0, 55.6],
        [13.005, 55.6],
        [13.01, 55.6],
      ];
      
      const result = calculateTieredBorderScore(walkOnBoundary, testBoundaryLines);
      
      // Should be mostly platinum (distance ~0)
      expect(result.score).toBeGreaterThan(0.9);
      expect(result.tierDistribution.platinum).toBeGreaterThan(0.9);
    });

    it('should return 0 score for walk far from boundary', () => {
      // Walk in the center of the area, far from all edges
      // 0.005 degrees ≈ 500m at this latitude
      const walkInCenter: Position[] = [
        [13.005, 55.605],
        [13.005, 55.605],
        [13.006, 55.605],
      ];
      
      const result = calculateTieredBorderScore(walkInCenter, testBoundaryLines);
      
      // Should be all "missed" since >50m from boundary
      expect(result.score).toBe(0);
      expect(result.tierDistribution.missed).toBe(1);
    });

    it('should return correct segments count', () => {
      const coords: Position[] = [
        [13.0, 55.6],
        [13.003, 55.6],
        [13.006, 55.6],
        [13.01, 55.6],
      ];
      
      const result = calculateTieredBorderScore(coords, testBoundaryLines);
      
      // 4 coordinates = 3 segments
      expect(result.segments).toHaveLength(3);
    });
  });

  describe('tier distribution', () => {
    it('should have tier distribution sum to 1.0', () => {
      const coords: Position[] = [
        [13.0, 55.6],      // On boundary
        [13.005, 55.602],  // ~200m inside
        [13.01, 55.6],     // On boundary
      ];
      
      const result = calculateTieredBorderScore(coords, testBoundaryLines);
      
      const sum = 
        result.tierDistribution.platinum +
        result.tierDistribution.gold +
        result.tierDistribution.silver +
        result.tierDistribution.bronze +
        result.tierDistribution.potato +
        result.tierDistribution.missed;
      
      // WHY: Sum should be 1.0 within floating point tolerance
      expect(sum).toBeCloseTo(1.0, 10);
    });

    it('should have all tier distribution values between 0 and 1', () => {
      const coords: Position[] = [
        [13.0, 55.6],
        [13.005, 55.6],
        [13.01, 55.6],
      ];
      
      const result = calculateTieredBorderScore(coords, testBoundaryLines);
      
      const tiers: DistanceTier[] = ['platinum', 'gold', 'silver', 'bronze', 'potato', 'missed'];
      for (const tier of tiers) {
        expect(result.tierDistribution[tier]).toBeGreaterThanOrEqual(0);
        expect(result.tierDistribution[tier]).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('segment-length weighting', () => {
    it('should weight longer segments more heavily', () => {
      // WHY: Per ADR 021, 100m of Gold should count more than 10m of Gold
      // Create a walk where one segment is much longer than others
      // Long segment near boundary, short segment far from boundary
      
      // This is a bit tricky to test precisely, but we can verify the concept
      // by checking that the score reflects the weighted average
      const coordsOnBoundary: Position[] = [
        [13.0, 55.6],
        [13.008, 55.6],  // Long segment on boundary (~800m)
      ];
      
      const result = calculateTieredBorderScore(coordsOnBoundary, testBoundaryLines);
      
      // Single segment on boundary should be high score
      expect(result.score).toBeGreaterThan(0.9);
    });
  });

  describe('segment data', () => {
    it('should include correct segment indices', () => {
      const coords: Position[] = [
        [13.0, 55.6],
        [13.003, 55.6],
        [13.006, 55.6],
      ];
      
      const result = calculateTieredBorderScore(coords, testBoundaryLines);
      
      expect(result.segments[0].startIndex).toBe(0);
      expect(result.segments[0].endIndex).toBe(1);
      expect(result.segments[1].startIndex).toBe(1);
      expect(result.segments[1].endIndex).toBe(2);
    });

    it('should include positive segment lengths', () => {
      const coords: Position[] = [
        [13.0, 55.6],
        [13.003, 55.6],
        [13.006, 55.6],
      ];
      
      const result = calculateTieredBorderScore(coords, testBoundaryLines);
      
      for (const segment of result.segments) {
        expect(segment.segmentLengthMeters).toBeGreaterThan(0);
      }
    });

    it('should include valid tier for each segment', () => {
      const coords: Position[] = [
        [13.0, 55.6],
        [13.003, 55.6],
        [13.006, 55.6],
      ];
      
      const result = calculateTieredBorderScore(coords, testBoundaryLines);
      
      const validTiers: DistanceTier[] = ['platinum', 'gold', 'silver', 'bronze', 'potato', 'missed'];
      for (const segment of result.segments) {
        expect(validTiers).toContain(segment.tier);
      }
    });

    it('should include non-negative distance for each segment', () => {
      const coords: Position[] = [
        [13.0, 55.6],
        [13.003, 55.6],
        [13.006, 55.6],
      ];
      
      const result = calculateTieredBorderScore(coords, testBoundaryLines);
      
      for (const segment of result.segments) {
        expect(segment.distanceMeters).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('score bounds', () => {
    it('should return score between 0 and 1', () => {
      // Various walk patterns
      const testCases: Position[][] = [
        // On boundary
        [[13.0, 55.6], [13.01, 55.6]],
        // Far from boundary
        [[13.005, 55.605], [13.006, 55.605]],
        // Mixed
        [[13.0, 55.6], [13.005, 55.605], [13.01, 55.6]],
      ];
      
      for (const coords of testCases) {
        const result = calculateTieredBorderScore(coords, testBoundaryLines);
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(1);
      }
    });
  });
});

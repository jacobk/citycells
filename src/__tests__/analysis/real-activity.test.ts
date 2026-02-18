/**
 * Real Activity Tests
 *
 * Tests using actual Strava activity data to verify the analysis engine works
 * correctly against real delområde polygons. Each activity was a walk tracing
 * the border of a specific Malmö sub-area.
 *
 * Test structure:
 * 1. Polyline truncation regression tests (Johanneslust) — demonstrates why
 *    Strava metadata is needed for loop detection (see ADR 006).
 * 2. Per-activity analysis tests — verifies analyzeWalk() produces correct
 *    metrics when run against the real area polygon with stream coordinates.
 *
 * To add a new activity:
 * 1. Export the fixture: node scripts/export-all-fixtures.mjs
 * 2. Add the import and config entry to ALL_ACTIVITIES below
 * 3. Run tests to calibrate assertions
 * 4. Review SVGs in src/__tests__/output/ to validate
 */

import { describe, it, expect } from 'vitest';
import { detectLoop, analyzeWalk, type StravaMetadata, type FullAnalysisResult, type Tier } from '@/lib/analysis';
import { visualizeAreaCoverage, saveSVG } from '../utils/visualization';
import { 
  createComparison, 
  formatComparisonReport, 
  type ScoreComparison 
} from '../utils/score-comparison';
import * as turf from '@turf/turf';
import type { Feature, Polygon, Position } from 'geojson';

// ============================================
// Activity Fixtures
// ============================================
import katrinelundActivity from '../fixtures/activities/activity-17383157001.json';
import ellstorpActivity from '../fixtures/activities/activity-17382890625.json';
import videdalActivity from '../fixtures/activities/activity-17319372012.json';
import fagelbackenActivity from '../fixtures/activities/activity-17314063662.json';
import hasthagenActivity from '../fixtures/activities/activity-17313893053.json';
import kronprinsenActivity from '../fixtures/activities/activity-17313729488.json';
import radmansvangenActivity from '../fixtures/activities/activity-17308205375.json';
import malmohusActivity from '../fixtures/activities/activity-17307746665.json';
import emilstorpActivity from '../fixtures/activities/activity-17282448985.json';
import hakanstorpActivity from '../fixtures/activities/activity-17270700773.json';
import johanneslustActivity from '../fixtures/activities/activity-17259240639.json';

// ============================================
// Area Fixtures
// ============================================
import katrinelundArea from '../fixtures/areas/katrinelund.json';
import ellstorpArea from '../fixtures/areas/ellstorp.json';
import videdalArea from '../fixtures/areas/videdal.json';
import fagelbackenArea from '../fixtures/areas/fagelbacken.json';
import hasthagenArea from '../fixtures/areas/hasthagen.json';
import kronprinsenArea from '../fixtures/areas/kronprinsen.json';
import radmansvangenArea from '../fixtures/areas/radmansvangen.json';
import malmohusArea from '../fixtures/areas/malmohus.json';
import emilstorpArea from '../fixtures/areas/emilstorp.json';
import hakanstorpArea from '../fixtures/areas/hakanstorp.json';
import johanneslustArea from '../fixtures/areas/johanneslust.json';

// ============================================
// Test Configuration
// ============================================

/**
 * Expected analysis results for each activity.
 *
 * WHY: These thresholds are calibrated from actual analysis runs, rounded down
 * to account for minor floating-point variance across environments. They serve
 * as regression guards — if a code change causes scores to drop below these
 * minimums, the test fails.
 *
 * See ADR 003 for tier thresholds: platinum >= 0.95, gold >= 0.85,
 * silver >= 0.70, bronze >= 0.50.
 */
interface ActivityTestConfig {
  name: string;
  id: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  activity: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  area: any;
  expected: {
    isClosedLoop: boolean;
    maxLoopGap: number;
    minPerimeterCoverage: number;
    minAreaCoverage: number;
    minAlignment: number;
    minEfficiency: number;
    minQuality: number;
    tier: Tier;
    maxDeviations: number;
  };
}

const ALL_ACTIVITIES: ActivityTestConfig[] = [
  {
    name: 'Håkanstorp',
    id: 17270700773,
    activity: hakanstorpActivity,
    area: hakanstorpArea,
    expected: {
      isClosedLoop: true,
      maxLoopGap: 10,
      minPerimeterCoverage: 0.99,
      minAreaCoverage: 0.97,
      minAlignment: 0.85,
      minEfficiency: 0.99,
      minQuality: 0.95,
      tier: 'platinum',
      maxDeviations: 0,
    },
  },
  {
    name: 'Fågelbacken',
    id: 17314063662,
    activity: fagelbackenActivity,
    area: fagelbackenArea,
    // WHY: ADR 021 tiered scoring rewards precision more than old binary formula.
    // This walk's high precision (mostly platinum tier segments) yields platinum.
    expected: {
      isClosedLoop: true,
      maxLoopGap: 10,
      minPerimeterCoverage: 0.99,
      minAreaCoverage: 0.93,
      minAlignment: 0.79,
      minEfficiency: 0.99,
      minQuality: 0.95,
      tier: 'platinum',
      maxDeviations: 0,
    },
  },
  {
    name: 'Hästhagen',
    id: 17313893053,
    activity: hasthagenActivity,
    area: hasthagenArea,
    // WHY: ADR 021 tiered scoring produces slightly lower score (91.8%) for this
    // walk because it has more silver/bronze tier segments than platinum/gold.
    expected: {
      isClosedLoop: true,
      maxLoopGap: 10,
      minPerimeterCoverage: 0.99,
      minAreaCoverage: 0.92,
      minAlignment: 0.75,
      minEfficiency: 0.99,
      minQuality: 0.91,
      tier: 'gold',
      maxDeviations: 0,
    },
  },
  {
    name: 'Rådmansvången',
    id: 17308205375,
    activity: radmansvangenActivity,
    area: radmansvangenArea,
    // WHY: ADR 021 tiered scoring produces slightly lower score (92.8%) for this
    // walk because it has more silver/bronze tier segments than platinum/gold.
    expected: {
      isClosedLoop: true,
      maxLoopGap: 20,
      minPerimeterCoverage: 0.98,
      minAreaCoverage: 0.93,
      minAlignment: 0.74,
      minEfficiency: 0.99,
      minQuality: 0.92,
      tier: 'gold',
      maxDeviations: 0,
    },
  },
  {
    name: 'Kronprinsen',
    id: 17313729488,
    activity: kronprinsenActivity,
    area: kronprinsenArea,
    expected: {
      isClosedLoop: true,
      maxLoopGap: 10,
      minPerimeterCoverage: 0.93,
      minAreaCoverage: 0.87,
      minAlignment: 0.73,
      minEfficiency: 0.96,
      minQuality: 0.88,
      tier: 'gold',
      maxDeviations: 0,
    },
  },
  {
    name: 'Malmöhus',
    id: 17307746665,
    activity: malmohusActivity,
    area: malmohusArea,
    // WHY: ADR 021 tiered scoring produces slightly lower score (87.3%) for this
    // walk because it has more deviation from the boundary.
    expected: {
      isClosedLoop: true,
      maxLoopGap: 15,
      minPerimeterCoverage: 0.96,
      minAreaCoverage: 0.90,
      minAlignment: 0.62,
      minEfficiency: 0.95,
      minQuality: 0.87,
      tier: 'gold',
      maxDeviations: 3,
    },
  },
  {
    name: 'Katrinelund',
    id: 17383157001,
    activity: katrinelundActivity,
    area: katrinelundArea,
    expected: {
      isClosedLoop: true,
      maxLoopGap: 10,
      minPerimeterCoverage: 0.89,
      minAreaCoverage: 0.80,
      minAlignment: 0.19,
      minEfficiency: 0.80,
      minQuality: 0.72,
      tier: 'silver',
      maxDeviations: 2,
    },
  },
  {
    name: 'Johanneslust',
    id: 17259240639,
    activity: johanneslustActivity,
    area: johanneslustArea,
    expected: {
      isClosedLoop: true,
      maxLoopGap: 5,
      minPerimeterCoverage: 0.83,
      minAreaCoverage: 0.88,
      minAlignment: 0.49,
      minEfficiency: 0.82,
      minQuality: 0.77,
      tier: 'silver',
      maxDeviations: 4,
    },
  },
  {
    name: 'Emilstorp',
    id: 17282448985,
    activity: emilstorpActivity,
    area: emilstorpArea,
    // WHY: ADR 021 tiered scoring produces slightly lower score (75.4%) for this
    // walk because it has more deviation from the boundary.
    expected: {
      isClosedLoop: true,
      maxLoopGap: 30,
      minPerimeterCoverage: 0.83,
      minAreaCoverage: 0.85,
      minAlignment: 0.47,
      minEfficiency: 0.78,
      minQuality: 0.75,
      tier: 'silver',
      maxDeviations: 4,
    },
  },
  {
    name: 'Videdal',
    id: 17319372012,
    activity: videdalActivity,
    area: videdalArea,
    // WHY: ADR 021 tiered scoring rewards precision more than old binary formula.
    // This walk's high area coverage combined with tiered border scoring yields silver.
    expected: {
      isClosedLoop: true,
      maxLoopGap: 5,
      minPerimeterCoverage: 0.65,
      minAreaCoverage: 0.90,
      minAlignment: 0.38,
      minEfficiency: 0.67,
      minQuality: 0.70,
      tier: 'silver',
      maxDeviations: 4,
    },
  },
  {
    name: 'Ellstorp',
    id: 17382890625,
    activity: ellstorpActivity,
    area: ellstorpArea,
    // WHY: Ellstorp scores below bronze (37.7%). The walk only covers ~43%
    // of the perimeter and has poor alignment. This tests the Potato tier case
    // for low-quality walks that still count toward progress (ADR 003, updated 2026-02-13).
    expected: {
      isClosedLoop: true,
      maxLoopGap: 15,
      minPerimeterCoverage: 0.42,
      minAreaCoverage: 0.48,
      minAlignment: 0.0,
      minEfficiency: 0.52,
      minQuality: 0.36,
      tier: 'potato',
      maxDeviations: 2,
    },
  },
];

// ============================================
// Helper
// ============================================

function runAnalysis(config: ActivityTestConfig): {
  result: FullAnalysisResult;
  areaSqm: number;
  perimeterMeters: number;
} {
  const areaPolygon = config.area as Feature<Polygon>;
  const areaSqm = turf.area(areaPolygon);
  const perimeterLine = turf.polygonToLine(areaPolygon);
  const perimeterMeters = turf.length(perimeterLine, { units: 'meters' });

  const coordinates = config.activity.coordinates as Position[];
  const streamCoordinates = config.activity.streamCoordinates as Position[] | undefined;
  const stravaMetadata: StravaMetadata = {
    startLatLng: config.activity.start_latlng as [number, number],
    endLatLng: config.activity.end_latlng as [number, number],
    distance: config.activity.distance as number,
  };

  const result = analyzeWalk(
    coordinates,
    areaPolygon,
    perimeterMeters,
    areaSqm,
    stravaMetadata,
    streamCoordinates,
  );

  return { result, areaSqm, perimeterMeters };
}

// ============================================
// Polyline Truncation Regression Tests
// ============================================

describe('Polyline Truncation Bug (Johanneslust)', () => {
  // WHY: This tests the specific bug where summary_polyline is truncated by
  // Strava privacy zones, causing loop detection to fail. Strava metadata
  // (start_latlng/end_latlng) gives the real GPS endpoints. See ADR 005/006.

  const coordinates = johanneslustActivity.coordinates as Position[];
  const stravaMetadata: StravaMetadata = {
    startLatLng: johanneslustActivity.start_latlng as [number, number],
    endLatLng: johanneslustActivity.end_latlng as [number, number],
  };

  it('should show large gap when using coordinates only (the bug)', () => {
    const result = detectLoop(coordinates);

    // Without Strava metadata, the gap is ~338m (exceeds 100m threshold)
    expect(result.gapMeters).toBeGreaterThan(300);
    expect(result.isClosedLoop).toBe(false);
  });

  it('should show small gap when using Strava metadata (the fix)', () => {
    const result = detectLoop(coordinates, stravaMetadata);

    // With Strava metadata, the gap is ~1.8m (well within 100m threshold)
    expect(result.gapMeters).toBeLessThan(10);
    expect(result.isClosedLoop).toBe(true);
  });

  it('should correctly identify the polyline truncation', () => {
    const polylineStart = coordinates[0];
    const polylineEnd = coordinates[coordinates.length - 1];

    // Strava uses [lat, lng], we need [lng, lat] for turf
    const stravaStart: Position = [stravaMetadata.startLatLng![1], stravaMetadata.startLatLng![0]];
    const stravaEnd: Position = [stravaMetadata.endLatLng![1], stravaMetadata.endLatLng![0]];

    const startTruncation = turf.distance(
      turf.point(polylineStart),
      turf.point(stravaStart),
      { units: 'meters' },
    );

    const endTruncation = turf.distance(
      turf.point(polylineEnd),
      turf.point(stravaEnd),
      { units: 'meters' },
    );

    // Both endpoints are significantly truncated
    expect(startTruncation).toBeGreaterThan(100);
    expect(endTruncation).toBeGreaterThan(100);
  });

  it('should report 0% area coverage WITHOUT Strava metadata (demonstrating bug)', () => {
    // WHY: Using a synthetic bounding box here since this test is specifically
    // about the truncation bug, not area scoring accuracy.
    const testArea: Feature<Polygon> = {
      type: 'Feature',
      properties: { name: 'Test Area for Johanneslust Walk' },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [13.035, 55.595],
          [13.055, 55.595],
          [13.055, 55.610],
          [13.035, 55.610],
          [13.035, 55.595],
        ]],
      },
    };

    const areaSqm = turf.area(testArea);
    const perimeterLine = turf.polygonToLine(testArea);
    const perimeterMeters = turf.length(perimeterLine, { units: 'meters' });

    const result = analyzeWalk(coordinates, testArea, perimeterMeters, areaSqm);

    expect(result.metrics.isClosedLoop).toBe(false);
    expect(result.metrics.areaCoveragePercent).toBe(0);
  });
});

// ============================================
// Per-Activity Analysis Tests
// ============================================

for (const config of ALL_ACTIVITIES) {
  describe(`Real Activity: ${config.name} (${config.id})`, () => {
    // WHY: Pre-compute once per activity. analyzeWalk is deterministic so
    // running it once and asserting multiple properties is safe.
    const { result, areaSqm, perimeterMeters } = runAnalysis(config);
    const m = result.metrics;
    const e = config.expected;

    it('should detect loop status correctly', () => {
      expect(m.isClosedLoop).toBe(e.isClosedLoop);
      if (e.isClosedLoop) {
        expect(m.loopGapMeters).toBeLessThan(e.maxLoopGap);
      }
    });

    it('should use Strava distance for total walk length', () => {
      // WHY: Strava distance is the ground truth. Polyline distance is
      // truncated by privacy zones. See ADR 006.
      expect(m.totalWalkLengthMeters).toBeCloseTo(config.activity.distance, 0);
    });

    it(`should achieve >= ${(e.minPerimeterCoverage * 100).toFixed(0)}% perimeter coverage`, () => {
      expect(m.perimeterCoveragePercent).toBeGreaterThanOrEqual(e.minPerimeterCoverage);

      console.log(`${config.name} Perimeter: ${(m.perimeterCoveragePercent * 100).toFixed(1)}% ` +
        `(${m.coveredDistanceMeters.toFixed(0)}m / ${perimeterMeters.toFixed(0)}m)`);
    });

    it(`should achieve >= ${(e.minAreaCoverage * 100).toFixed(0)}% area coverage`, () => {
      expect(m.areaCoveragePercent).toBeGreaterThanOrEqual(e.minAreaCoverage);

      console.log(`${config.name} Area: ${(m.areaCoveragePercent * 100).toFixed(1)}% ` +
        `(${m.enclosedAreaSqm.toFixed(0)} / ${areaSqm.toFixed(0)} sqm)`);
    });

    it(`should achieve >= ${(e.minAlignment * 100).toFixed(0)}% alignment`, () => {
      expect(m.alignmentScore).toBeGreaterThanOrEqual(e.minAlignment);

      console.log(`${config.name} Alignment: ${(m.alignmentScore * 100).toFixed(1)}% ` +
        `(RMSE: ${m.rmseMeters.toFixed(1)}m, max: ${m.maxDeviationMeters.toFixed(1)}m)`);
    });

    it(`should achieve >= ${(e.minEfficiency * 100).toFixed(0)}% efficiency`, () => {
      expect(m.efficiency).toBeGreaterThanOrEqual(e.minEfficiency);

      console.log(`${config.name} Efficiency: ${(m.efficiency * 100).toFixed(1)}% ` +
        `(${m.borderAlignedLengthMeters.toFixed(0)}m / ${m.totalWalkLengthMeters.toFixed(0)}m)`);
    });

    it(`should achieve ${e.tier ?? 'no'} tier (quality >= ${(e.minQuality * 100).toFixed(0)}%)`, () => {
      expect(m.rawQualityScore).toBeGreaterThanOrEqual(e.minQuality);
      expect(m.tier).toBe(e.tier);

      console.log(`${config.name} Quality: ${(m.rawQualityScore * 100).toFixed(1)}% → ${m.tier}`);
    });

    it(`should have <= ${e.maxDeviations} deviation segments`, () => {
      expect(result.deviations.length).toBeLessThanOrEqual(e.maxDeviations);
    });

    it('should generate visualization', () => {
      const coords = (config.activity.streamCoordinates || config.activity.coordinates) as Position[];
      const areaPolygon = config.area as Feature<Polygon>;
      saveSVG(
        `activity-${config.id}-area.svg`,
        visualizeAreaCoverage(
          coords,
          areaPolygon,
          m.enclosedAreaSqm,
          areaSqm,
          m.isClosedLoop,
          m.loopGapMeters,
          { title: `${config.name} Walk - ${m.tier ? m.tier.charAt(0).toUpperCase() + m.tier.slice(1) : 'No Tier'} (${(m.rawQualityScore * 100).toFixed(0)}%)` },
        ),
      );
    });
  });
}

// ============================================
// Score Comparison Analysis (ADR 003 → ADR 021)
// ============================================

describe('Score Impact Analysis: ADR 003 → ADR 021', () => {
  // WHY: This test documents the impact of transitioning from the legacy
  // ADR 003 scoring formula to the new ADR 021 tiered scoring formula.
  // It runs analysis on all test activities and compares old vs new scores.
  //
  // Analysis is run once per activity and cached in `analysisCache` to avoid
  // redundant computation across multiple test blocks.

  // Cache analysis results to avoid redundant computation
  const analysisCache = new Map<number, { result: FullAnalysisResult; config: ActivityTestConfig }>();
  const comparisons: ScoreComparison[] = [];

  // Pre-compute all analyses and comparisons (runs once)
  for (const config of ALL_ACTIVITIES) {
    const { result } = runAnalysis(config);
    analysisCache.set(config.id, { result, config });
    const m = result.metrics;

    comparisons.push(createComparison(
      config.name,
      config.id,
      {
        perimeterCoverage: m.perimeterCoveragePercent,
        areaCoverage: m.areaCoveragePercent,
        alignment: m.alignmentScore,
        efficiency: m.efficiency,
        tieredBorderScore: m.tieredBorderScore,
      },
      m.rawQualityScore
    ));
  }

  it('should output comparison table for all activities', () => {
    // WHY: Output the full comparison report to console for visibility
    // This shows how each activity's score changed between formulas
    console.log(formatComparisonReport(comparisons));
    
    // Basic assertion to make the test pass
    expect(comparisons.length).toBe(ALL_ACTIVITIES.length);
  });

  it('should have reasonable score changes (no extreme swings)', () => {
    // WHY: Verify the formula change doesn't cause extreme score changes
    // that would be confusing to users
    for (const c of comparisons) {
      // No activity should swing more than 15% in either direction
      expect(Math.abs(c.delta)).toBeLessThan(0.15);
    }
  });

  it('should maintain tier distribution reasonably', () => {
    // WHY: The new formula should not drastically change the tier distribution
    // A few tier changes are expected, but mass downgrades would be problematic
    const tierChanges = comparisons.filter(c => c.tierChanged);
    
    // Log tier changes for visibility
    if (tierChanges.length > 0) {
      console.log('Tier Changes:');
      for (const c of tierChanges) {
        console.log(`  ${c.name}: ${c.oldTier} → ${c.newTier} (${(c.delta * 100).toFixed(1)}%)`);
      }
    }
    
    // Expect at most half of activities to change tiers
    expect(tierChanges.length).toBeLessThan(Math.ceil(ALL_ACTIVITIES.length / 2));
  });

  // ============================================
  // Tier Distribution Validation
  // ============================================
  // WHY: The tier distribution from calculateTieredBorderScore should
  // always sum to approximately 1.0 (100% of walk distance accounted for).
  // These tests use the cached analysis results to avoid redundant computation.

  describe('Tier Distribution', () => {
    it('should sum to ~1.0 for all activities', () => {
      const formatPercent = (v: number) => `${(v * 100).toFixed(1)}%`.padStart(6);
      
      console.log('\n--- Tier Distribution by Activity ---');
      
      for (const config of ALL_ACTIVITIES) {
        const cached = analysisCache.get(config.id);
        expect(cached).toBeDefined();
        
        const dist = cached!.result.metrics.tierDistribution;
        
        // Sum all tier percentages
        const total = dist.platinum + dist.gold + dist.silver + dist.bronze + dist.potato + dist.missed;
        
        // WHY: Floating-point tolerance of 0.001 (0.1%) for rounding errors
        expect(total).toBeCloseTo(1.0, 2);
        
        // Validate all tier values are between 0 and 1
        expect(dist.platinum).toBeGreaterThanOrEqual(0);
        expect(dist.platinum).toBeLessThanOrEqual(1);
        expect(dist.gold).toBeGreaterThanOrEqual(0);
        expect(dist.gold).toBeLessThanOrEqual(1);
        expect(dist.silver).toBeGreaterThanOrEqual(0);
        expect(dist.silver).toBeLessThanOrEqual(1);
        expect(dist.bronze).toBeGreaterThanOrEqual(0);
        expect(dist.bronze).toBeLessThanOrEqual(1);
        expect(dist.potato).toBeGreaterThanOrEqual(0);
        expect(dist.potato).toBeLessThanOrEqual(1);
        expect(dist.missed).toBeGreaterThanOrEqual(0);
        expect(dist.missed).toBeLessThanOrEqual(1);
        
        // Log distribution for visibility
        console.log(
          `${config.name.padEnd(15)} | ` +
          `Plat: ${formatPercent(dist.platinum)} | ` +
          `Gold: ${formatPercent(dist.gold)} | ` +
          `Silv: ${formatPercent(dist.silver)} | ` +
          `Brnz: ${formatPercent(dist.bronze)} | ` +
          `Pota: ${formatPercent(dist.potato)} | ` +
          `Miss: ${formatPercent(dist.missed)}`
        );
      }
    });

    it('high-quality walks should have majority in platinum/gold tiers', () => {
      // WHY: Walks that achieved platinum or gold tier should have most
      // of their distance in the top tiers (platinum + gold)
      const highQualityActivities = ALL_ACTIVITIES.filter(
        c => c.expected.tier === 'platinum' || c.expected.tier === 'gold'
      );
      
      console.log('\n--- Top Tier Distribution for High-Quality Walks ---');
      
      for (const config of highQualityActivities) {
        const cached = analysisCache.get(config.id);
        expect(cached).toBeDefined();
        
        const dist = cached!.result.metrics.tierDistribution;
        const topTierPercent = dist.platinum + dist.gold;
        
        // High-quality walks should have at least 40% in top tiers
        expect(topTierPercent).toBeGreaterThan(0.4);
        
        console.log(
          `${config.name.padEnd(15)} (${config.expected.tier}): ` +
          `Top Tiers: ${(topTierPercent * 100).toFixed(1)}%`
        );
      }
    });
  });
});

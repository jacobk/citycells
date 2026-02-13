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
    expected: {
      isClosedLoop: true,
      maxLoopGap: 10,
      minPerimeterCoverage: 0.99,
      minAreaCoverage: 0.93,
      minAlignment: 0.79,
      minEfficiency: 0.99,
      minQuality: 0.94,
      tier: 'gold',
      maxDeviations: 0,
    },
  },
  {
    name: 'Hästhagen',
    id: 17313893053,
    activity: hasthagenActivity,
    area: hasthagenArea,
    expected: {
      isClosedLoop: true,
      maxLoopGap: 10,
      minPerimeterCoverage: 0.99,
      minAreaCoverage: 0.92,
      minAlignment: 0.75,
      minEfficiency: 0.99,
      minQuality: 0.93,
      tier: 'gold',
      maxDeviations: 0,
    },
  },
  {
    name: 'Rådmansvången',
    id: 17308205375,
    activity: radmansvangenActivity,
    area: radmansvangenArea,
    expected: {
      isClosedLoop: true,
      maxLoopGap: 20,
      minPerimeterCoverage: 0.98,
      minAreaCoverage: 0.93,
      minAlignment: 0.74,
      minEfficiency: 0.99,
      minQuality: 0.93,
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
    expected: {
      isClosedLoop: true,
      maxLoopGap: 15,
      minPerimeterCoverage: 0.96,
      minAreaCoverage: 0.90,
      minAlignment: 0.62,
      minEfficiency: 0.95,
      minQuality: 0.88,
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
    expected: {
      isClosedLoop: true,
      maxLoopGap: 30,
      minPerimeterCoverage: 0.83,
      minAreaCoverage: 0.85,
      minAlignment: 0.47,
      minEfficiency: 0.78,
      minQuality: 0.76,
      tier: 'silver',
      maxDeviations: 4,
    },
  },
  {
    name: 'Videdal',
    id: 17319372012,
    activity: videdalActivity,
    area: videdalArea,
    expected: {
      isClosedLoop: true,
      maxLoopGap: 5,
      minPerimeterCoverage: 0.65,
      minAreaCoverage: 0.90,
      minAlignment: 0.38,
      minEfficiency: 0.67,
      minQuality: 0.66,
      tier: 'bronze',
      maxDeviations: 4,
    },
  },
  {
    name: 'Ellstorp',
    id: 17382890625,
    activity: ellstorpActivity,
    area: ellstorpArea,
    // WHY: Ellstorp scores below bronze (37.7%). The walk only covers ~43%
    // of the perimeter and has poor alignment. This tests the "no tier" case.
    expected: {
      isClosedLoop: true,
      maxLoopGap: 15,
      minPerimeterCoverage: 0.42,
      minAreaCoverage: 0.48,
      minAlignment: 0.0,
      minEfficiency: 0.52,
      minQuality: 0.36,
      tier: null,
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

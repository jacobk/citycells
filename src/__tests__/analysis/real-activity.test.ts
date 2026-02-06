/**
 * Real Activity Test
 * 
 * Tests using actual Strava activity data to verify analysis works correctly.
 * This specifically tests the fix for truncated polylines where Strava metadata
 * should be used for loop detection instead of the coordinates array.
 */

import { describe, it, expect } from 'vitest';
import { detectLoop, analyzeWalk, type StravaMetadata } from '@/lib/analysis';
import { visualizeAreaCoverage, saveSVG } from '../utils/visualization';
import * as turf from '@turf/turf';
import type { Feature, Polygon, Position } from 'geojson';
import activityFixture from '../fixtures/activities/activity-17259240639.json';
import truncatedFixture from '../fixtures/activities/activity-17270700773.json';
import hakanstorpFixture from '../fixtures/areas/hakanstorp.json';

describe('Real Activity: activity-17259240639 (Johanneslust)', () => {
  // Extract data from fixture
  const coordinates = activityFixture.coordinates as Position[];
  const stravaMetadata: StravaMetadata = {
    startLatLng: activityFixture.start_latlng as [number, number],
    endLatLng: activityFixture.end_latlng as [number, number],
  };

  describe('Loop Detection Issue', () => {
    it('should show large gap when using coordinates only (the bug)', () => {
      // This demonstrates the original bug - coordinates array is truncated
      const result = detectLoop(coordinates);
      
      console.log('Coordinates-only loop detection:');
      console.log(`  First coordinate: [${coordinates[0].join(', ')}]`);
      console.log(`  Last coordinate: [${coordinates[coordinates.length - 1].join(', ')}]`);
      console.log(`  Gap: ${result.gapMeters.toFixed(1)}m`);
      console.log(`  isClosedLoop: ${result.isClosedLoop}`);
      
      // Without Strava metadata, the gap is ~338m (exceeds 100m threshold)
      expect(result.gapMeters).toBeGreaterThan(300);
      expect(result.isClosedLoop).toBe(false);
    });

    it('should show small gap when using Strava metadata (the fix)', () => {
      // This demonstrates the fix - using Strava metadata
      const result = detectLoop(coordinates, stravaMetadata);
      
      console.log('Strava metadata loop detection:');
      console.log(`  start_latlng: [${stravaMetadata.startLatLng?.join(', ')}]`);
      console.log(`  end_latlng: [${stravaMetadata.endLatLng?.join(', ')}]`);
      console.log(`  Gap: ${result.gapMeters.toFixed(1)}m`);
      console.log(`  isClosedLoop: ${result.isClosedLoop}`);
      
      // With Strava metadata, the gap is ~1.79m (well within 100m threshold)
      expect(result.gapMeters).toBeLessThan(10);
      expect(result.isClosedLoop).toBe(true);
    });

    it('should correctly identify the polyline truncation', () => {
      // Calculate distance from polyline endpoints to Strava metadata endpoints
      const polylineStart = coordinates[0];
      const polylineEnd = coordinates[coordinates.length - 1];
      
      // Strava uses [lat, lng], we need [lng, lat] for turf
      const stravaStart: Position = [stravaMetadata.startLatLng![1], stravaMetadata.startLatLng![0]];
      const stravaEnd: Position = [stravaMetadata.endLatLng![1], stravaMetadata.endLatLng![0]];
      
      const startTruncation = turf.distance(
        turf.point(polylineStart),
        turf.point(stravaStart),
        { units: 'meters' }
      );
      
      const endTruncation = turf.distance(
        turf.point(polylineEnd),
        turf.point(stravaEnd),
        { units: 'meters' }
      );
      
      console.log('Polyline truncation analysis:');
      console.log(`  Start truncation: ${startTruncation.toFixed(1)}m`);
      console.log(`  End truncation: ${endTruncation.toFixed(1)}m`);
      console.log(`  Total GPS points: ${coordinates.length}`);
      
      // Both endpoints are significantly truncated
      expect(startTruncation).toBeGreaterThan(100);
      expect(endTruncation).toBeGreaterThan(100);
    });
  });

  describe('Full Analysis with Fix', () => {
    // Create a simple test area polygon around the walk
    const testArea: Feature<Polygon> = {
      type: 'Feature',
      properties: { name: 'Test Area for Johanneslust Walk' },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [13.035, 55.595],  // SW
          [13.055, 55.595],  // SE
          [13.055, 55.610],  // NE
          [13.035, 55.610],  // NW
          [13.035, 55.595],  // Close
        ]],
      },
    };
    
    const areaSqm = turf.area(testArea);
    const perimeterLine = turf.polygonToLine(testArea);
    const perimeterMeters = turf.length(perimeterLine, { units: 'meters' });

    it('should report area coverage > 0% with Strava metadata', () => {
      const result = analyzeWalk(
        coordinates,
        testArea,
        perimeterMeters,
        areaSqm,
        stravaMetadata  // THE FIX: pass Strava metadata
      );
      
      console.log('Full analysis with Strava metadata:');
      console.log(`  isClosedLoop: ${result.metrics.isClosedLoop}`);
      console.log(`  loopGapMeters: ${result.metrics.loopGapMeters.toFixed(1)}m`);
      console.log(`  areaCoverage: ${(result.metrics.areaCoveragePercent * 100).toFixed(1)}%`);
      console.log(`  perimeterCoverage: ${(result.metrics.perimeterCoveragePercent * 100).toFixed(1)}%`);
      console.log(`  qualityScore: ${(result.metrics.rawQualityScore * 100).toFixed(1)}%`);
      console.log(`  tier: ${result.metrics.tier}`);
      
      // With the fix, we should now get proper area coverage
      expect(result.metrics.isClosedLoop).toBe(true);
      expect(result.metrics.areaCoveragePercent).toBeGreaterThan(0);
      
      // Generate visualization
      saveSVG('activity-17259240639-area.svg', visualizeAreaCoverage(
        coordinates,
        testArea,
        result.metrics.enclosedAreaSqm,
        areaSqm,
        result.metrics.isClosedLoop,
        result.metrics.loopGapMeters,
        { title: 'Johanneslust Walk - Area Coverage (Fixed)' }
      ));
    });

    it('should report 0% area coverage WITHOUT Strava metadata (demonstrating bug)', () => {
      const result = analyzeWalk(
        coordinates,
        testArea,
        perimeterMeters,
        areaSqm
        // NO stravaMetadata - this demonstrates the bug
      );
      
      console.log('Full analysis WITHOUT Strava metadata (the bug):');
      console.log(`  isClosedLoop: ${result.metrics.isClosedLoop}`);
      console.log(`  areaCoverage: ${(result.metrics.areaCoveragePercent * 100).toFixed(1)}%`);
      
      // Without the fix, area coverage is 0%
      expect(result.metrics.isClosedLoop).toBe(false);
      expect(result.metrics.areaCoveragePercent).toBe(0);
    });
  });
});

describe('Real Activity: activity-17270700773 (Håkanstorp)', () => {
  // WHY: Use the actual Håkanstorp polygon from the GeoJSON data rather than a
  // synthetic bounding box. The walk traces the real Håkanstorp border, so analysis
  // must use the real polygon to produce meaningful scores.
  const hakanstorpPolygon = hakanstorpFixture as Feature<Polygon>;
  const areaSqm = turf.area(hakanstorpPolygon);
  const perimeterLine = turf.polygonToLine(hakanstorpPolygon);
  const perimeterMeters = turf.length(perimeterLine, { units: 'meters' });

  const coordinates = truncatedFixture.coordinates as Position[];
  const streamCoordinates = truncatedFixture.streamCoordinates as Position[];
  const stravaMetadata: StravaMetadata = {
    startLatLng: truncatedFixture.start_latlng as [number, number],
    endLatLng: truncatedFixture.end_latlng as [number, number],
    distance: truncatedFixture.distance as number,
  };

  // Pre-calculate full analysis result for use across tests
  const result = analyzeWalk(
    coordinates,
    hakanstorpPolygon,
    perimeterMeters,
    areaSqm,
    stravaMetadata,
    streamCoordinates
  );

  it('should use Strava distance for total walk length', () => {
    const walkLine = turf.lineString(coordinates);
    const polylineLength = turf.length(walkLine, { units: 'meters' });

    // WHY: Strava's full GPS stream records 2050m, but the summary_polyline
    // is truncated. The analysis should prefer Strava's distance metadata.
    expect(result.metrics.totalWalkLengthMeters).toBeCloseTo(truncatedFixture.distance, 1);
    expect(result.metrics.totalWalkLengthMeters).toBeGreaterThan(polylineLength);
  });

  it('should detect a closed loop via Strava metadata', () => {
    // WHY: The walk starts and ends at effectively the same point (~4m gap).
    // Strava metadata is needed because the polyline is truncated.
    expect(result.metrics.isClosedLoop).toBe(true);
    expect(result.metrics.loopGapMeters).toBeLessThan(10);
  });

  it('should score high on border traced (perimeter coverage)', () => {
    // WHY: This walk closely traces the actual Håkanstorp border.
    // With all 1173 stream GPS points within the 25m buffer, coverage should be ~100%.
    expect(result.metrics.perimeterCoveragePercent).toBeGreaterThan(0.95);
    expect(result.metrics.coveredDistanceMeters).toBeGreaterThan(perimeterMeters * 0.95);

    console.log('Håkanstorp Border Traced:');
    console.log(`  perimeterCoverage: ${(result.metrics.perimeterCoveragePercent * 100).toFixed(1)}%`);
    console.log(`  coveredDistance: ${result.metrics.coveredDistanceMeters.toFixed(0)}m / ${perimeterMeters.toFixed(0)}m perimeter`);
  });

  it('should score high on area coverage', () => {
    // WHY: The walk forms a closed loop that encloses nearly all of Håkanstorp.
    expect(result.metrics.areaCoveragePercent).toBeGreaterThan(0.90);
    expect(result.metrics.enclosedAreaSqm).toBeGreaterThan(areaSqm * 0.90);

    console.log('Håkanstorp Area Coverage:');
    console.log(`  areaCoverage: ${(result.metrics.areaCoveragePercent * 100).toFixed(1)}%`);
    console.log(`  enclosedArea: ${result.metrics.enclosedAreaSqm.toFixed(0)} / ${areaSqm.toFixed(0)} sqm`);
  });

  it('should score well on alignment', () => {
    // WHY: Average distance from walk to perimeter is ~5m (well within 25m buffer).
    // RMSE of ~7m gives alignment score of ~86%.
    expect(result.metrics.alignmentScore).toBeGreaterThan(0.80);
    expect(result.metrics.rmseMeters).toBeLessThan(15);
    expect(result.metrics.maxDeviationMeters).toBeLessThan(30);

    console.log('Håkanstorp Alignment:');
    console.log(`  alignmentScore: ${(result.metrics.alignmentScore * 100).toFixed(1)}%`);
    console.log(`  RMSE: ${result.metrics.rmseMeters.toFixed(1)}m`);
    console.log(`  maxDeviation: ${result.metrics.maxDeviationMeters.toFixed(1)}m`);
    console.log(`  P90 deviation: ${result.metrics.p90DeviationMeters.toFixed(1)}m`);
  });

  it('should score high on efficiency', () => {
    // WHY: The entire walk stays near the border with no significant detours.
    expect(result.metrics.efficiency).toBeGreaterThan(0.95);

    console.log('Håkanstorp Efficiency:');
    console.log(`  efficiency: ${(result.metrics.efficiency * 100).toFixed(1)}%`);
    console.log(`  borderAligned: ${result.metrics.borderAlignedLengthMeters.toFixed(0)}m / ${result.metrics.totalWalkLengthMeters.toFixed(0)}m total`);
  });

  it('should achieve platinum tier', () => {
    // WHY: This is a near-perfect border trace walk. All metrics are excellent,
    // so the composite quality score should comfortably exceed 95% (platinum).
    expect(result.metrics.rawQualityScore).toBeGreaterThan(0.95);
    expect(result.metrics.tier).toBe('platinum');

    console.log('Håkanstorp Overall:');
    console.log(`  qualityScore: ${(result.metrics.rawQualityScore * 100).toFixed(1)}%`);
    console.log(`  tier: ${result.metrics.tier}`);
  });

  it('should have no deviation segments', () => {
    // WHY: The walk stays consistently close to the border throughout.
    // No GPS points exceed the 30m deviation threshold.
    expect(result.deviations).toHaveLength(0);
  });

  it('should generate visualization', () => {
    saveSVG('activity-17270700773-area.svg', visualizeAreaCoverage(
      streamCoordinates,
      hakanstorpPolygon,
      result.metrics.enclosedAreaSqm,
      areaSqm,
      result.metrics.isClosedLoop,
      result.metrics.loopGapMeters,
      { title: 'Håkanstorp Walk - Area Coverage (Platinum)' }
    ));
  });
});

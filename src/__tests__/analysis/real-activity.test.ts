/**
 * Real Activity Test
 * 
 * Tests using actual Strava activity data to verify analysis works correctly.
 * This specifically tests the fix for truncated polylines where Strava metadata
 * should be used for loop detection instead of the coordinates array.
 */

import { describe, it, expect } from 'vitest';
import { detectLoop, analyzeWalk, LOOP_CLOSURE_THRESHOLD_METERS, type StravaMetadata } from '@/lib/analysis';
import { visualizeAreaCoverage, saveSVG } from '../utils/visualization';
import * as turf from '@turf/turf';
import type { Feature, Polygon, Position } from 'geojson';
import activityFixture from '../fixtures/activities/activity-17259240639.json';
import truncatedFixture from '../fixtures/activities/activity-17270700773.json';

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
  const coordinates = truncatedFixture.coordinates as Position[];
  const stravaMetadata: StravaMetadata = {
    startLatLng: truncatedFixture.start_latlng as [number, number],
    endLatLng: truncatedFixture.end_latlng as [number, number],
    distance: truncatedFixture.distance as number,
  };

  it('should use Strava distance for total walk length', () => {
    const walkLine = turf.lineString(coordinates);
    const [minX, minY, maxX, maxY] = turf.bbox(walkLine);
    const padding = 0.002;
    const areaPolygon = turf.bboxPolygon([
      minX - padding,
      minY - padding,
      maxX + padding,
      maxY + padding,
    ]) as Feature<Polygon>;
    const areaSqm = turf.area(areaPolygon);
    const perimeterLine = turf.polygonToLine(areaPolygon);
    const perimeterMeters = turf.length(perimeterLine, { units: 'meters' });

    const result = analyzeWalk(
      coordinates,
      areaPolygon,
      perimeterMeters,
      areaSqm,
      stravaMetadata
    );

    const polylineLength = turf.length(walkLine, { units: 'meters' });

    expect(result.metrics.totalWalkLengthMeters).toBeCloseTo(truncatedFixture.distance, 1);
    expect(result.metrics.totalWalkLengthMeters).toBeGreaterThan(polylineLength);
  });
});

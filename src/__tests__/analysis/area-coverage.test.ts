/**
 * Area Coverage Tests
 * 
 * Tests for the area coverage calculation that measures
 * how much of the sub-area is enclosed by the walk path.
 * 
 * WHY: Area coverage of 0% is a common issue. This test suite
 * helps identify the root cause:
 * 1. Walk is not a closed loop (gapMeters > 100m)
 * 2. Walk polygon doesn't intersect with area polygon
 * 3. Walk polygon is invalid (self-intersecting)
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { calculateAreaCoverage, detectLoop, analyzeWalk } from '@/lib/analysis';
import { visualizeAreaCoverage, saveSVG } from '../utils/visualization';
import * as turf from '@turf/turf';
import type { Feature, Polygon, Position } from 'geojson';

// Sample area polygon (simple square ~1km x 1km)
const sampleArea: Feature<Polygon> = {
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

const sampleAreaSqm = turf.area(sampleArea);

describe('calculateAreaCoverage', () => {
  describe('basic scenarios', () => {
    it('should return 0% for open (non-loop) walks', () => {
      const openWalk: Position[] = [
        [13.0, 55.6],
        [13.01, 55.6],
        [13.01, 55.61],
        // Doesn't return to start
      ];
      
      const { isClosedLoop } = detectLoop(openWalk);
      expect(isClosedLoop).toBe(false);
      
      const result = calculateAreaCoverage(openWalk, sampleArea, sampleAreaSqm, false);
      
      expect(result.coveragePercent).toBe(0);
      expect(result.enclosedSqm).toBe(0);
    });

    it('should calculate coverage for closed loops that match the area exactly', () => {
      // Walk that exactly traces the area boundary
      const perfectLoop: Position[] = [
        [13.0, 55.6],
        [13.01, 55.6],
        [13.01, 55.61],
        [13.0, 55.61],
        [13.0, 55.6],  // Close the loop
      ];
      
      const { isClosedLoop, gapMeters } = detectLoop(perfectLoop);
      expect(isClosedLoop).toBe(true);
      expect(gapMeters).toBe(0);
      
      const result = calculateAreaCoverage(perfectLoop, sampleArea, sampleAreaSqm, true);
      
      // Should be ~100% coverage
      expect(result.coveragePercent).toBeGreaterThan(0.99);
      
      // Generate visualization for review
      saveSVG('test-area-coverage-perfect.svg', visualizeAreaCoverage(
        perfectLoop,
        sampleArea,
        result.enclosedSqm,
        sampleAreaSqm,
        true,
        0,
        { title: 'Perfect Loop - 100% Coverage' }
      ));
    });

    it('should calculate coverage for loop inside the area', () => {
      // Walk that forms a smaller loop inside the area
      const insideLoop: Position[] = [
        [13.002, 55.602],  // Smaller square inside
        [13.008, 55.602],
        [13.008, 55.608],
        [13.002, 55.608],
        [13.002, 55.602],
      ];
      
      const { isClosedLoop } = detectLoop(insideLoop);
      expect(isClosedLoop).toBe(true);
      
      const result = calculateAreaCoverage(insideLoop, sampleArea, sampleAreaSqm, true);
      
      // Should be partial coverage
      expect(result.coveragePercent).toBeGreaterThan(0);
      expect(result.coveragePercent).toBeLessThan(1);
      
      console.log(`Inside loop coverage: ${(result.coveragePercent * 100).toFixed(1)}%`);
      
      saveSVG('test-area-coverage-inside.svg', visualizeAreaCoverage(
        insideLoop,
        sampleArea,
        result.enclosedSqm,
        sampleAreaSqm,
        true,
        0,
        { title: 'Inside Loop - Partial Coverage' }
      ));
    });

    it('should calculate coverage for loop that extends outside the area', () => {
      // Walk that is bigger than the area
      const outsideLoop: Position[] = [
        [12.99, 55.59],    // SW (outside)
        [13.02, 55.59],    // SE (outside)
        [13.02, 55.62],    // NE (outside)
        [12.99, 55.62],    // NW (outside)
        [12.99, 55.59],    // Close
      ];
      
      const { isClosedLoop } = detectLoop(outsideLoop);
      expect(isClosedLoop).toBe(true);
      
      const result = calculateAreaCoverage(outsideLoop, sampleArea, sampleAreaSqm, true);
      
      // Should be 100% because entire area is enclosed
      expect(result.coveragePercent).toBeGreaterThan(0.99);
      
      saveSVG('test-area-coverage-outside.svg', visualizeAreaCoverage(
        outsideLoop,
        sampleArea,
        result.enclosedSqm,
        sampleAreaSqm,
        true,
        0,
        { title: 'Outside Loop - Full Coverage' }
      ));
    });
  });

  describe('edge cases causing 0% coverage', () => {
    it('should return 0% when loop is too few points', () => {
      const tooFewPoints: Position[] = [
        [13.0, 55.6],
        [13.01, 55.6],
        [13.0, 55.6],  // Only 3 points
      ];
      
      const result = calculateAreaCoverage(tooFewPoints, sampleArea, sampleAreaSqm, true);
      
      // < 4 points cannot form a valid polygon
      expect(result.coveragePercent).toBe(0);
    });

    it('should handle walk completely outside the area', () => {
      // Walk that is outside the area entirely
      const outsideWalk: Position[] = [
        [13.1, 55.7],    // Far away
        [13.11, 55.7],
        [13.11, 55.71],
        [13.1, 55.71],
        [13.1, 55.7],
      ];
      
      const result = calculateAreaCoverage(outsideWalk, sampleArea, sampleAreaSqm, true);
      
      // No intersection with the area
      expect(result.coveragePercent).toBe(0);
    });

    it('should handle self-intersecting walk paths', () => {
      // Figure-8 pattern (self-intersecting)
      const figureEight: Position[] = [
        [13.002, 55.605],   // Center
        [13.008, 55.608],   // Upper right
        [13.008, 55.602],   // Lower right
        [13.002, 55.605],   // Cross back through center
        [13.002, 55.608],   // Upper left
        [13.002, 55.602],   // Lower left
        [13.002, 55.605],   // Return to start
      ];
      
      // Turf.js handles self-intersecting polygons but results may vary
      const result = calculateAreaCoverage(figureEight, sampleArea, sampleAreaSqm, true);
      
      // Note: turf.js may still calculate some coverage for self-intersecting paths
      // The important thing is it doesn't crash and returns a reasonable value
      expect(result.coveragePercent).toBeGreaterThanOrEqual(0);
      expect(result.coveragePercent).toBeLessThanOrEqual(1);
      console.log(`Self-intersecting walk coverage: ${(result.coveragePercent * 100).toFixed(1)}%`);
    });
  });

  describe('realistic walk scenarios', () => {
    it('should handle a realistic walk with GPS noise', () => {
      // Simulate a walk around the area with some GPS noise
      const realisticWalk: Position[] = [];
      
      // Generate points around the perimeter with some noise
      const addNoise = () => (Math.random() - 0.5) * 0.0002; // ~20m noise
      
      // South edge
      for (let lng = 13.0; lng <= 13.01; lng += 0.001) {
        realisticWalk.push([lng + addNoise(), 55.6 + addNoise()]);
      }
      // East edge
      for (let lat = 55.6; lat <= 55.61; lat += 0.001) {
        realisticWalk.push([13.01 + addNoise(), lat + addNoise()]);
      }
      // North edge (reverse)
      for (let lng = 13.01; lng >= 13.0; lng -= 0.001) {
        realisticWalk.push([lng + addNoise(), 55.61 + addNoise()]);
      }
      // West edge (reverse)
      for (let lat = 55.61; lat >= 55.6; lat -= 0.001) {
        realisticWalk.push([13.0 + addNoise(), lat + addNoise()]);
      }
      
      // Close the loop (back to near start)
      realisticWalk.push([realisticWalk[0][0] + addNoise(), realisticWalk[0][1] + addNoise()]);
      
      const { isClosedLoop, gapMeters } = detectLoop(realisticWalk);
      console.log(`Realistic walk: isClosedLoop=${isClosedLoop}, gap=${gapMeters.toFixed(1)}m, points=${realisticWalk.length}`);
      
      const result = calculateAreaCoverage(realisticWalk, sampleArea, sampleAreaSqm, isClosedLoop);
      console.log(`Realistic walk coverage: ${(result.coveragePercent * 100).toFixed(1)}%`);
      
      // With noise, the walk should still enclose most of the area
      if (isClosedLoop) {
        expect(result.coveragePercent).toBeGreaterThan(0.7);
      }
      
      saveSVG('test-area-coverage-realistic.svg', visualizeAreaCoverage(
        realisticWalk,
        sampleArea,
        result.enclosedSqm,
        sampleAreaSqm,
        isClosedLoop,
        gapMeters,
        { title: 'Realistic Walk with GPS Noise' }
      ));
    });

    it('should handle walk that covers only part of the border then cuts across', () => {
      // Walk around half the border then cuts diagonally back
      const partialWalk: Position[] = [
        [13.0, 55.6],      // Start at SW
        [13.01, 55.6],     // East along south edge
        [13.01, 55.61],    // North along east edge
        // Instead of continuing along north edge, cut diagonal
        [13.0, 55.6],      // Diagonal back to start
      ];
      
      const { isClosedLoop, gapMeters } = detectLoop(partialWalk);
      expect(isClosedLoop).toBe(true);
      
      const result = calculateAreaCoverage(partialWalk, sampleArea, sampleAreaSqm, true);
      
      // Should cover ~50% (triangular half)
      console.log(`Partial walk coverage: ${(result.coveragePercent * 100).toFixed(1)}%`);
      expect(result.coveragePercent).toBeGreaterThan(0.4);
      expect(result.coveragePercent).toBeLessThan(0.6);
      
      saveSVG('test-area-coverage-partial.svg', visualizeAreaCoverage(
        partialWalk,
        sampleArea,
        result.enclosedSqm,
        sampleAreaSqm,
        true,
        gapMeters,
        { title: 'Partial Border Walk - ~50% Coverage' }
      ));
    });
  });
});

describe('Full analysis integration', () => {
  it('should include area metrics in full analysis', () => {
    const closedWalkCoords: Position[] = [
      [13.0, 55.6],
      [13.01, 55.6],
      [13.01, 55.61],
      [13.0, 55.61],
      [13.0, 55.6],
    ];
    
    const perimeterLine = turf.polygonToLine(sampleArea);
    const perimeterMeters = perimeterLine.type === 'FeatureCollection'
      ? perimeterLine.features.reduce((sum, f) => sum + turf.length(f, { units: 'meters' }), 0)
      : turf.length(perimeterLine, { units: 'meters' });
    
    // analyzeWalk expects Position[], not LineString
    const result = analyzeWalk(closedWalkCoords, sampleArea, perimeterMeters, sampleAreaSqm);
    
    expect(result.metrics.isClosedLoop).toBe(true);
    expect(result.metrics.areaCoveragePercent).toBeGreaterThan(0.99);
    expect(result.metrics.enclosedAreaSqm).toBeGreaterThan(0);
    
    console.log('Full analysis results:', {
      isClosedLoop: result.metrics.isClosedLoop,
      loopGapMeters: result.metrics.loopGapMeters.toFixed(1),
      areaCoverage: (result.metrics.areaCoveragePercent * 100).toFixed(1) + '%',
      perimeterCoverage: (result.metrics.perimeterCoveragePercent * 100).toFixed(1) + '%',
      qualityScore: (result.metrics.rawQualityScore * 100).toFixed(1) + '%',
      tier: result.metrics.tier,
    });
  });
});

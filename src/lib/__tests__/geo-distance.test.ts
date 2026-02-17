/**
 * Unit Tests for Geo-Distance Utilities
 * 
 * Tests for the distance calculation functions in src/lib/geo-distance.ts.
 * These functions are used by the analysis engine, route visualization,
 * and live walking mode.
 * 
 * WHY: These are core distance calculations that affect scoring.
 * Consolidated in TICKET-018 to eliminate duplication.
 * 
 * @module lib/__tests__/geo-distance.test
 */

import { describe, it, expect } from 'vitest';
import type { Feature, Polygon, LineString, Position } from 'geojson';
import {
  distanceToLine,
  nearestPointOnLine,
  polygonToPerimeterLines,
  distanceToPolygonPerimeter,
  checkPerimeterProximity,
  PERIMETER_BUFFER_METERS,
} from '../geo-distance';

// ============================================
// Test Fixtures
// ============================================

// Simple horizontal line for testing
const testLine: Feature<LineString> = {
  type: 'Feature',
  properties: {},
  geometry: {
    type: 'LineString',
    coordinates: [
      [13.0, 55.6],
      [13.01, 55.6],
    ],
  },
};

// Simple square polygon
const testPolygon: Feature<Polygon> = {
  type: 'Feature',
  properties: { name: 'Test Polygon' },
  geometry: {
    type: 'Polygon',
    coordinates: [[
      [13.0, 55.6],
      [13.01, 55.6],
      [13.01, 55.61],
      [13.0, 55.61],
      [13.0, 55.6],
    ]],
  },
};

// ============================================
// distanceToLine Tests
// ============================================

describe('distanceToLine', () => {
  it('should return 0 for point on the line', () => {
    const pointOnLine: Position = [13.005, 55.6]; // Midpoint of line
    
    const distance = distanceToLine(pointOnLine, testLine);
    
    expect(distance).toBeLessThan(1); // Allow for floating point error
  });

  it('should return correct distance for point perpendicular to line', () => {
    // Point ~111m north of the line (0.001 degrees latitude ≈ 111m)
    const pointNorth: Position = [13.005, 55.601];
    
    const distance = distanceToLine(pointNorth, testLine);
    
    // Should be approximately 111m
    expect(distance).toBeGreaterThan(100);
    expect(distance).toBeLessThan(120);
  });

  it('should return distance to nearest endpoint for point past line end', () => {
    // Point west of the line start
    const pointWest: Position = [12.99, 55.6];
    
    const distance = distanceToLine(pointWest, testLine);
    
    // Distance to [13.0, 55.6] endpoint
    // 0.01 degrees longitude at 55.6° lat ≈ 630m
    expect(distance).toBeGreaterThan(600);
    expect(distance).toBeLessThan(700);
  });
});

// ============================================
// nearestPointOnLine Tests
// ============================================

describe('nearestPointOnLine', () => {
  it('should return same point for point on the line', () => {
    const pointOnLine: Position = [13.005, 55.6];
    
    const nearest = nearestPointOnLine(pointOnLine, testLine);
    
    expect(nearest[0]).toBeCloseTo(pointOnLine[0], 5);
    expect(nearest[1]).toBeCloseTo(pointOnLine[1], 5);
  });

  it('should return projection for point perpendicular to line', () => {
    const pointNorth: Position = [13.005, 55.601];
    
    const nearest = nearestPointOnLine(pointNorth, testLine);
    
    // Nearest point should have same longitude, but be on the line (lat 55.6)
    expect(nearest[0]).toBeCloseTo(13.005, 4);
    expect(nearest[1]).toBeCloseTo(55.6, 4);
  });

  it('should return endpoint for point past line end', () => {
    const pointWest: Position = [12.99, 55.6];
    
    const nearest = nearestPointOnLine(pointWest, testLine);
    
    // Should return the western endpoint
    expect(nearest[0]).toBeCloseTo(13.0, 4);
    expect(nearest[1]).toBeCloseTo(55.6, 4);
  });
});

// ============================================
// polygonToPerimeterLines Tests
// ============================================

describe('polygonToPerimeterLines', () => {
  it('should return array with single LineString for simple polygon', () => {
    const lines = polygonToPerimeterLines(testPolygon);
    
    expect(lines).toHaveLength(1);
    expect(lines[0].geometry.type).toBe('LineString');
  });

  it('should preserve polygon vertices in the line', () => {
    const lines = polygonToPerimeterLines(testPolygon);
    const coords = lines[0].geometry.coordinates;
    
    // Should have 5 coordinates (4 corners + closing point)
    expect(coords.length).toBe(5);
    expect(coords[0]).toEqual([13.0, 55.6]);
    expect(coords[4]).toEqual([13.0, 55.6]); // Closed
  });
});

// ============================================
// distanceToPolygonPerimeter Tests
// ============================================

describe('distanceToPolygonPerimeter', () => {
  it('should return 0 for point on perimeter', () => {
    const pointOnPerimeter: Position = [13.005, 55.6]; // On south edge
    
    const distance = distanceToPolygonPerimeter(pointOnPerimeter, testPolygon);
    
    expect(distance).toBeLessThan(1);
  });

  it('should return minimum distance to nearest edge', () => {
    // Point inside polygon, 50m north of south edge
    // 0.00045 degrees lat ≈ 50m
    const pointInside: Position = [13.005, 55.60045];
    
    const distance = distanceToPolygonPerimeter(pointInside, testPolygon);
    
    // Nearest edge is south edge
    expect(distance).toBeGreaterThan(40);
    expect(distance).toBeLessThan(60);
  });

  it('should work for point outside polygon', () => {
    // Point south of polygon
    const pointSouth: Position = [13.005, 55.599]; // 0.001 deg south
    
    const distance = distanceToPolygonPerimeter(pointSouth, testPolygon);
    
    expect(distance).toBeGreaterThan(100);
    expect(distance).toBeLessThan(120);
  });
});

// ============================================
// checkPerimeterProximity Tests
// ============================================

describe('checkPerimeterProximity', () => {
  it('should return withinTolerance=true for point on perimeter', () => {
    const pointOnPerimeter: Position = [13.005, 55.6];
    
    const result = checkPerimeterProximity(pointOnPerimeter, testPolygon);
    
    expect(result.withinTolerance).toBe(true);
    expect(result.distance).toBeLessThan(1);
  });

  it('should return withinTolerance=true for point within 25m buffer', () => {
    // Point 20m inside polygon (within 25m default buffer)
    // 0.00018 degrees lat ≈ 20m
    const pointNearPerimeter: Position = [13.005, 55.60018];
    
    const result = checkPerimeterProximity(pointNearPerimeter, testPolygon);
    
    expect(result.withinTolerance).toBe(true);
    expect(result.distance).toBeLessThan(PERIMETER_BUFFER_METERS);
  });

  it('should return withinTolerance=false for point outside 25m buffer', () => {
    // Point 50m from perimeter (outside 25m buffer)
    // 0.00045 degrees lat ≈ 50m
    const pointFar: Position = [13.005, 55.60045];
    
    const result = checkPerimeterProximity(pointFar, testPolygon);
    
    expect(result.withinTolerance).toBe(false);
    expect(result.distance).toBeGreaterThan(PERIMETER_BUFFER_METERS);
  });

  it('should respect custom tolerance parameter', () => {
    // Point 50m from perimeter
    const pointFar: Position = [13.005, 55.60045];
    
    // With 100m tolerance, should be within
    const result = checkPerimeterProximity(pointFar, testPolygon, 100);
    
    expect(result.withinTolerance).toBe(true);
  });
});

// ============================================
// Constants Tests
// ============================================

describe('PERIMETER_BUFFER_METERS', () => {
  it('should be 25 meters per ADR 002', () => {
    expect(PERIMETER_BUFFER_METERS).toBe(25);
  });
});

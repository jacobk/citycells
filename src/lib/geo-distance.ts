/**
 * Geo Distance Utilities
 * 
 * WHY: Consolidates distance-to-geometry calculations used across the app.
 * Eliminates duplication between analysis.ts and route-visualization.ts.
 * Single source of truth for spatial distance calculations.
 * 
 * @see docs/ADR/002-exclusive-activity-matching.md - 25m buffer definition
 * @see docs/ADR/003-multi-metric-completion-scoring.md - PERIMETER_BUFFER_METERS constant
 * @see docs/tickets/018-distance-indicator.md
 */

import * as turf from '@turf/turf';
import type { Feature, LineString, Polygon, MultiPolygon, Position } from 'geojson';

// =============================================================================
// Constants
// =============================================================================

// WHY: 25m buffer accounts for GPS accuracy (5-15m) and sidewalk offsets
// from property boundaries. Referenced in ADR 002 and ADR 003.
export const PERIMETER_BUFFER_METERS = 25;

// =============================================================================
// Core Distance Functions
// =============================================================================

/**
 * Calculate distance from a point to the nearest point on a line.
 * 
 * WHY: Fundamental building block for deviation detection and boundary proximity.
 * Used by analysis engine, route visualization, and live walking mode.
 * 
 * @param point - Point in [lng, lat] GeoJSON format
 * @param line - LineString feature to measure distance to
 * @returns Distance in meters
 */
export function distanceToLine(point: Position, line: Feature<LineString>): number {
  const pt = turf.point(point);
  const nearestPt = turf.nearestPointOnLine(line, pt);
  return turf.distance(pt, nearestPt, { units: 'meters' });
}

/**
 * Find the nearest point on a line to a given point.
 * 
 * WHY: Used by deviation detection to identify border crossing points.
 * 
 * @param point - Point in [lng, lat] GeoJSON format
 * @param line - LineString feature to project onto
 * @returns Nearest point coordinates in [lng, lat] format
 */
export function nearestPointOnLine(point: Position, line: Feature<LineString>): Position {
  const pt = turf.point(point);
  const nearestPt = turf.nearestPointOnLine(line, pt);
  return nearestPt.geometry.coordinates;
}

/**
 * Convert a polygon to its perimeter line(s).
 * 
 * WHY: Polygons need to be converted to lines for distance calculations.
 * MultiPolygons return multiple lines (one per ring).
 * 
 * @param polygon - Polygon or MultiPolygon feature
 * @returns Array of LineString features representing the perimeter
 */
export function polygonToPerimeterLines(
  polygon: Feature<Polygon | MultiPolygon>
): Feature<LineString>[] {
  const perimeterLine = turf.polygonToLine(polygon);
  
  if (perimeterLine.type === 'FeatureCollection') {
    return perimeterLine.features as Feature<LineString>[];
  }
  return [perimeterLine as Feature<LineString>];
}

/**
 * Calculate minimum distance from a point to any of the boundary lines.
 * 
 * WHY: MultiPolygons have multiple rings; we need the distance to the closest one.
 * Used by route visualization and live walking mode distance indicator.
 * 
 * @param point - Point in [lng, lat] GeoJSON format
 * @param boundaryLines - Array of LineString features
 * @returns Minimum distance in meters
 */
export function distanceToPerimeterLines(
  point: Position,
  boundaryLines: Feature<LineString>[]
): number {
  let minDistance = Infinity;
  
  for (const line of boundaryLines) {
    const distance = distanceToLine(point, line);
    if (distance < minDistance) {
      minDistance = distance;
    }
  }
  
  return minDistance;
}

/**
 * Calculate distance from a point to the perimeter of a polygon.
 * 
 * WHY: Convenience function combining polygonToPerimeterLines + distanceToPerimeterLines.
 * Used by live walking mode to show distance to boundary in real-time.
 * 
 * @param point - Point in [lng, lat] GeoJSON format
 * @param polygon - Polygon or MultiPolygon feature
 * @returns Distance in meters to nearest point on perimeter
 */
export function distanceToPolygonPerimeter(
  point: Position,
  polygon: Feature<Polygon | MultiPolygon>
): number {
  const perimeterLines = polygonToPerimeterLines(polygon);
  return distanceToPerimeterLines(point, perimeterLines);
}

/**
 * Check if a point is within tolerance of a polygon's perimeter.
 * 
 * WHY: Common operation for route deviation detection and live walking feedback.
 * Returns both the distance and boolean for flexibility.
 * 
 * @param point - Point in [lng, lat] GeoJSON format
 * @param polygon - Polygon or MultiPolygon feature
 * @param toleranceMeters - Distance threshold (default: PERIMETER_BUFFER_METERS)
 * @returns Object with distance and withinTolerance boolean
 */
export function checkPerimeterProximity(
  point: Position,
  polygon: Feature<Polygon | MultiPolygon>,
  toleranceMeters: number = PERIMETER_BUFFER_METERS
): { distance: number; withinTolerance: boolean } {
  const distance = distanceToPolygonPerimeter(point, polygon);
  return {
    distance,
    withinTolerance: distance <= toleranceMeters,
  };
}

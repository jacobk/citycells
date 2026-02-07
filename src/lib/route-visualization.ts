/**
 * Route Visualization Utilities
 * 
 * WHY: Centralizes route deviation calculation and segment coloring logic.
 * Keeps Map.tsx focused on rendering while providing testable utility functions.
 * 
 * @see docs/ADR/010-map-visual-design-system.md Section 3
 * @see docs/tickets/007-walk-route-visualization.md
 */

import type { Feature, LineString, Polygon, MultiPolygon, Position } from 'geojson';
import * as turf from '@turf/turf';
import {
  ROUTE_DEVIATION_COLORS,
  ROUTE_DEVIATION_THRESHOLD_METERS,
  ROUTE_SEGMENT_STYLE,
  getRouteSegmentColor,
} from '@/lib/design-tokens';

// =============================================================================
// Types
// =============================================================================

/**
 * A route segment with its positions and assigned color.
 * Positions are in [lat, lng] format for Leaflet rendering.
 */
export interface RouteSegment {
  positions: [number, number][];  // [lat, lng] for Leaflet
  color: string;
}

/**
 * Processed route data ready for rendering.
 */
export interface ProcessedRouteData {
  activityId: number;
  segments: RouteSegment[];
  assignedAreaId: number | null;
}

// =============================================================================
// Geometry Utilities
// =============================================================================

/**
 * Convert polygon to perimeter line(s).
 * WHY: Needed to calculate distance from route points to boundary.
 */
function polygonToLine(polygon: Feature<Polygon | MultiPolygon>): Feature<LineString>[] {
  const perimeterLine = turf.polygonToLine(polygon);
  
  if (perimeterLine.type === 'FeatureCollection') {
    return perimeterLine.features as Feature<LineString>[];
  }
  return [perimeterLine as Feature<LineString>];
}

/**
 * Calculate distance from a point to the nearest point on a line.
 * WHY: Used to determine if a route segment is within the deviation threshold.
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
 * Calculate the minimum distance from a point to any of the boundary lines.
 * WHY: MultiPolygons have multiple rings; we need the closest one.
 * 
 * @param point - Point in [lng, lat] GeoJSON format
 * @param boundaryLines - Array of LineString features
 * @returns Minimum distance in meters
 */
function distanceToBoundary(point: Position, boundaryLines: Feature<LineString>[]): number {
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
 * Calculate the midpoint of a segment.
 * 
 * @param start - Start point in [lng, lat] GeoJSON format
 * @param end - End point in [lng, lat] GeoJSON format
 * @returns Midpoint in [lng, lat] GeoJSON format
 */
function segmentMidpoint(start: Position, end: Position): Position {
  return [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
}

// =============================================================================
// Route Processing
// =============================================================================

/**
 * Prepare deviation-colored route segments for rendering.
 * 
 * WHY: Calculates distance from each segment to the boundary and assigns colors.
 * Groups consecutive same-color segments to reduce the number of Polyline elements.
 * 
 * @param coordinates - Route coordinates in [lng, lat] GeoJSON format
 * @param boundaryFeature - The area polygon to measure deviation from
 * @returns Array of RouteSegments ready for Leaflet rendering
 */
export function prepareDeviationColoredRoute(
  coordinates: Position[],
  boundaryFeature: Feature<Polygon | MultiPolygon>
): RouteSegment[] {
  if (coordinates.length < 2) {
    return [];
  }

  const boundaryLines = polygonToLine(boundaryFeature);
  const segments: RouteSegment[] = [];
  
  let currentColor: string | null = null;
  let currentPositions: [number, number][] = [];

  for (let i = 0; i < coordinates.length - 1; i++) {
    const start = coordinates[i];
    const end = coordinates[i + 1];
    
    // Calculate midpoint and distance to boundary
    const midpoint = segmentMidpoint(start, end);
    const distance = distanceToBoundary(midpoint, boundaryLines);
    const color = getRouteSegmentColor(distance);
    
    // Convert to Leaflet [lat, lng] format
    const startLatLng: [number, number] = [start[1], start[0]];
    const endLatLng: [number, number] = [end[1], end[0]];
    
    if (currentColor === null) {
      // First segment
      currentColor = color;
      currentPositions = [startLatLng, endLatLng];
    } else if (color === currentColor) {
      // Same color - extend current segment
      currentPositions.push(endLatLng);
    } else {
      // Color changed - push current segment and start new one
      segments.push({
        positions: currentPositions,
        color: currentColor,
      });
      currentColor = color;
      currentPositions = [startLatLng, endLatLng];
    }
  }
  
  // Push final segment
  if (currentPositions.length > 0 && currentColor !== null) {
    segments.push({
      positions: currentPositions,
      color: currentColor,
    });
  }
  
  return segments;
}

/**
 * Prepare route segments for an unmatched activity (no assigned area).
 * WHY: Unmatched activities still need to be rendered, but in neutral color.
 * 
 * @param coordinates - Route coordinates in [lng, lat] GeoJSON format
 * @returns Single RouteSegment in unmatched color
 */
export function prepareUnmatchedRoute(coordinates: Position[]): RouteSegment[] {
  if (coordinates.length < 2) {
    return [];
  }
  
  // Convert all coordinates to Leaflet [lat, lng] format
  const positions: [number, number][] = coordinates.map(coord => [coord[1], coord[0]]);
  
  return [{
    positions,
    color: ROUTE_DEVIATION_COLORS.unmatched,
  }];
}

/**
 * Get the Leaflet path options for a route segment.
 * WHY: Provides consistent styling for all route segments.
 */
export function getRoutePathOptions(color: string) {
  return {
    ...ROUTE_SEGMENT_STYLE,
    color,
  };
}

// =============================================================================
// Exports
// =============================================================================

export {
  ROUTE_DEVIATION_COLORS,
  ROUTE_DEVIATION_THRESHOLD_METERS,
  ROUTE_SEGMENT_STYLE,
};

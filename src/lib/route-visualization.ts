/**
 * Route Visualization Utilities
 * 
 * WHY: Centralizes route deviation calculation and segment coloring logic.
 * Keeps Map.tsx focused on rendering while providing testable utility functions.
 * 
 * @see docs/ADR/010-map-visual-design-system.md Section 3
 * @see docs/tickets/007-walk-route-visualization.md
 */

import type { Feature, Polygon, MultiPolygon, Position } from 'geojson';
import {
  DISTANCE_TIER_COLORS,
  ROUTE_DEVIATION_COLORS,
  ROUTE_DEVIATION_THRESHOLD_METERS,
  ROUTE_SEGMENT_STYLE,
  getRouteSegmentColorByTier,
  // Keep for backward compatibility
  getRouteSegmentColor,
} from '@/lib/design-tokens';
// WHY: Import consolidated distance utilities from geo-distance.ts
// Eliminates duplication - see TICKET-018 for consolidation rationale
import {
  distanceToLine,
  polygonToPerimeterLines,
  distanceToPerimeterLines,
} from '@/lib/geo-distance';

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

// WHY: distanceToLine, polygonToPerimeterLines, and distanceToPerimeterLines are now
// imported from geo-distance.ts to avoid duplication. See TICKET-018.

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

  const boundaryLines = polygonToPerimeterLines(boundaryFeature);
  const segments: RouteSegment[] = [];
  
  let currentColor: string | null = null;
  let currentPositions: [number, number][] = [];

  for (let i = 0; i < coordinates.length - 1; i++) {
    const start = coordinates[i];
    const end = coordinates[i + 1];
    
    // Calculate midpoint and distance to boundary
    // WHY: Use tiered colors (ADR 021) instead of binary green/red (ADR 010)
    const midpoint = segmentMidpoint(start, end);
    const distance = distanceToPerimeterLines(midpoint, boundaryLines);
    const color = getRouteSegmentColorByTier(distance);
    
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
  DISTANCE_TIER_COLORS,
  ROUTE_DEVIATION_COLORS,
  ROUTE_DEVIATION_THRESHOLD_METERS,
  ROUTE_SEGMENT_STYLE,
};

// WHY: Re-export distanceToLine for backwards compatibility
// Previously defined locally, now imported from geo-distance.ts
export { distanceToLine };

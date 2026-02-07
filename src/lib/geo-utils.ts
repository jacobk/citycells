/**
 * Shared Geo Utilities for CityCells
 * 
 * WHY: Centralizes geographic calculations (perimeter, walk time) to avoid
 * duplication across Map.tsx, db.ts, and other consumers. Any update to
 * the perimeter or walk-time formula only needs to happen here.
 * 
 * @see docs/ADR/012-details-panel-mini-map.md
 * @see docs/tickets/004-subarea-visual-context.md
 */

import * as turf from '@turf/turf';
import type { Feature, Polygon, MultiPolygon } from 'geojson';

// WHY: 5 km/h average walking pace = 12 minutes per km
// Intentionally simple (no terrain/elevation factors) per ADR 012
const WALK_PACE_MINUTES_PER_KM = 12;

/**
 * Calculate perimeter length of a polygon in meters.
 * Handles both Polygon (single ring) and MultiPolygon (multiple rings)
 * by summing all boundary lengths.
 * 
 * WHY: This logic was previously duplicated in Map.tsx and db.ts.
 * Consolidated here as the single source of truth.
 */
export function calculatePerimeterMeters(
  polygon: Feature<Polygon | MultiPolygon>
): number {
  const perimeterLine = turf.polygonToLine(polygon);

  if (perimeterLine.type === 'FeatureCollection') {
    // WHY: MultiPolygon returns FeatureCollection, sum all perimeters
    return perimeterLine.features.reduce(
      (sum, f) => sum + turf.length(f, { units: 'meters' }),
      0
    );
  }

  return turf.length(perimeterLine, { units: 'meters' });
}

/**
 * Calculate estimated walk time in minutes for a given perimeter.
 * Uses 5 km/h average walking pace (12 minutes per km).
 * 
 * @see ADR 012 - Walk time formula: Math.round(circumference_km * 12)
 */
export function calculateWalkTimeMinutes(perimeterMeters: number): number {
  const perimeterKm = perimeterMeters / 1000;
  return Math.round(perimeterKm * WALK_PACE_MINUTES_PER_KM);
}

/**
 * Format circumference with estimated walk time.
 * Example output: "2.3 km (~28 min)"
 * 
 * @see PRD 001 Section 3.5 - Hover tooltip format
 */
export function formatCircumferenceWithTime(perimeterMeters: number): string {
  const perimeterKm = perimeterMeters / 1000;
  const walkMinutes = calculateWalkTimeMinutes(perimeterMeters);
  return `${perimeterKm.toFixed(1)} km (~${walkMinutes} min)`;
}

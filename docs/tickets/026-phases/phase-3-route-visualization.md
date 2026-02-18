# Phase 3: Route Visualization

**Parent Ticket:** [TICKET-026](../026-tiered-distance-scoring.md)  
**Priority:** Medium  
**Estimated Complexity:** Medium

## Overview

This phase updates the route visualization from binary green/red coloring to a 6-tier color gradient matching the distance tiers. Routes will show violet (platinum) through red (missed) based on how close each segment was to the boundary.

## Context Files to Read First

1. `docs/ADR/021-tiered-distance-scoring.md` - Section 6 (Tier Visualization Colors)
2. `docs/ADR/010-map-visual-design-system.md` - Existing color system
3. `src/lib/design-tokens.ts` - Current route colors and design tokens
4. `src/lib/route-visualization.ts` - Current route segment coloring logic
5. `src/lib/distance-tiers.ts` - Tier assignment function (created in Phase 1)

## Prerequisites

- **Phase 1 must be complete** (`assignDistanceTier` function must exist)

## Tasks

### Task 3.1: Update `src/lib/design-tokens.ts`

#### Add Distance Tier Colors

Add new constant after `ROUTE_DEVIATION_COLORS`:

```typescript
// =============================================================================
// DISTANCE TIER COLORS (ADR 021)
// WHY: 6-tier gradient from violet (best) to red (missed) for route segments.
// Extends existing purple-pink gradient (ADR 010) for visual consistency.
// Colorblind accessible (uses luminance contrast, not red-green).
// =============================================================================

export const DISTANCE_TIER_COLORS = {
  platinum: '#7c3aed',  // Deep Violet - GPS-perfect tracking
  gold: '#a855f7',      // Vibrant Purple - Excellent precision
  silver: '#d946ef',    // Magenta Pink - Good precision
  bronze: '#f0abfc',    // Soft Pink - Acceptable
  potato: '#a1a1aa',    // Warm Gray - Minimal credit
  missed: '#fca5a5',    // Light Red - Too far to count (solid, dashed deferred)
} as const;

export type DistanceTierColor = keyof typeof DISTANCE_TIER_COLORS;
```

#### Add Tier Color Function

```typescript
/**
 * Get route segment color based on distance from boundary using tiered system.
 * WHY: Provides graduated visual feedback instead of binary green/red.
 * See ADR 021 Section 6 for color rationale.
 * 
 * @param distanceMeters - Distance from segment midpoint to nearest boundary
 * @returns Hex color for the segment
 */
export function getRouteSegmentColorByTier(distanceMeters: number): string {
  // Import tier assignment from distance-tiers module
  const { tier } = assignDistanceTier(distanceMeters);
  return DISTANCE_TIER_COLORS[tier];
}
```

Note: You'll need to import `assignDistanceTier` from `./distance-tiers`.

#### Keep Legacy Colors

Keep `ROUTE_DEVIATION_COLORS` and `getRouteSegmentColor()` as-is with a deprecation comment:

```typescript
/**
 * @deprecated Use getRouteSegmentColorByTier() instead (ADR 021)
 * Get route segment color based on binary 25m threshold.
 */
export function getRouteSegmentColor(distanceMeters: number): string {
  // ... existing implementation ...
}
```

### Task 3.2: Update `src/lib/route-visualization.ts`

#### Update Imports

```typescript
import {
  DISTANCE_TIER_COLORS,
  getRouteSegmentColorByTier,
  ROUTE_SEGMENT_STYLE,
  // Keep for backward compatibility
  ROUTE_DEVIATION_COLORS,
} from '@/lib/design-tokens';
```

#### Update `prepareDeviationColoredRoute()`

Modify the function to use tiered colors:

```typescript
/**
 * Prepare deviation-colored route segments for rendering.
 * 
 * WHY: Calculates distance from each segment to the boundary and assigns
 * tiered colors (ADR 021) instead of binary green/red.
 * Groups consecutive same-color segments to reduce Polyline elements.
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
    const midpoint = segmentMidpoint(start, end);
    const distance = distanceToPerimeterLines(midpoint, boundaryLines);
    
    // WHY: Use tiered colors instead of binary (ADR 021)
    const color = getRouteSegmentColorByTier(distance);
    
    // ... rest of grouping logic stays the same ...
  }
  
  // ... rest of function ...
}
```

#### Update RouteSegment Interface (Optional Enhancement)

Consider adding tier info to RouteSegment for potential future UI use:

```typescript
export interface RouteSegment {
  positions: [number, number][];  // [lat, lng] for Leaflet
  color: string;
  tier?: DistanceTier;  // Optional: track which tier this segment is
}
```

#### Update Exports

Update the re-exports at the bottom:

```typescript
export {
  DISTANCE_TIER_COLORS,
  ROUTE_DEVIATION_COLORS,  // Keep for backward compatibility
  ROUTE_SEGMENT_STYLE,
};
```

## Dashed Pattern for "Missed" Segments

**Deferred per user decision.** For now, "missed" segments use solid light red (`#fca5a5`).

Future implementation would require:
- Adding `dashArray` property to RouteSegment interface
- Passing `dashArray: '5, 10'` in Leaflet Polyline options for missed segments
- Updating `AreaMiniMap` and `Map` components to handle dashed patterns

## Acceptance Criteria

- [ ] `DISTANCE_TIER_COLORS` constant added with 6 tier colors
- [ ] `getRouteSegmentColorByTier()` function returns correct color for each tier
- [ ] `prepareDeviationColoredRoute()` uses tiered colors instead of binary
- [ ] Route segments show violet→purple→pink→gray→red gradient based on distance
- [ ] Legacy `getRouteSegmentColor()` marked as deprecated but still works
- [ ] Segments are still grouped by color for performance

## Verification

```bash
npm run lint   # Must pass
npm run build  # Must pass
npm run test   # Must pass
```

**Visual verification:**
1. Open the app with existing walk data
2. Enable "Show Routes" toggle
3. Verify routes show color gradient (not just green/red)
4. Segments close to boundary should be violet/purple
5. Segments far from boundary should be gray/red

## Dependencies

- Phase 1 must be complete (`assignDistanceTier` function)

## Notes

- The dashed pattern for "missed" segments is deferred - use solid red for now
- Color grouping logic remains the same - just the color selection changes
- Both main map and mini-map (AreaDetailsPanel) use this visualization
- No changes needed to Map.tsx or AreaMiniMap.tsx - they consume RouteSegment[]

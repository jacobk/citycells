# Distance-to-Boundary Indicator

## Overview

The Distance-to-Boundary Indicator provides real-time feedback to walkers during live walking mode, showing their current distance from the sub-area boundary line. This helps users stay on track by clearly indicating whether they are within the 25m tolerance zone that counts as "on the boundary" for scoring purposes.

The feature adds two visual elements: a numeric distance display in the bottom status bar and a color-coded position marker that turns green when within tolerance.

## User Stories

From [PRD 001](../PRD/001-mvp-mobile-walker.md) Section 2 - Live Walking Mode Stories:

- "As a user, I want to see my real-time distance from the boundary while walking, so I know how far I need to adjust my path."
- "As a user, I want a clear visual indicator when I'm within the 25m tolerance zone, so I know I'm walking correctly."
- "As a user, I want my position marker to change color based on my distance from the boundary, so I can see at a glance whether I'm on track."

## Implementation

*Implemented: 2026-02-16 per TICKET-018*

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/geo-distance.ts` | **NEW** Consolidated distance calculation utilities (extracted from analysis.ts and route-visualization.ts) |
| `src/components/WalkingMode/WalkingMode.tsx` | Main walking mode component - calculates distance on each GPS position update |
| `src/components/WalkingMode/WalkingControls.tsx` | Status bar - displays distance indicator with color-coded styling |
| `src/components/WalkingMode/LivePositionMarker.tsx` | Position marker - accepts `withinTolerance` prop for color change |

### Data Flow

```
GPS Position Update (useGeolocationTracking hook)
       |
       v
WalkingMode.tsx: useEffect triggered by position change
       |
       v
Convert position to [lng, lat] GeoJSON format
       |
       v
distanceToPerimeterLines(point, perimeterLines) from geo-distance.ts
       |
       v
setDistanceToBoundary(Math.round(distance))
       |
       v
Compute: withinTolerance = distance <= PERIMETER_BUFFER_METERS (25m)
       |
       +---> WalkingControls: 
       |       - Within tolerance: Green pill "✓ On track (12m)"
       |       - Outside tolerance: Neutral pill "23m from boundary"
       |
       +---> LivePositionMarker: 
               - Within tolerance: Green marker (#22c55e)
               - Outside tolerance: Blue marker (#3b82f6)
```

### Key Functions

**`src/lib/geo-distance.ts`** (new consolidated module):

- `polygonToPerimeterLines(polygon)` - Converts polygon to LineString array for distance calculations
- `distanceToLine(point, line)` - Distance from point to nearest point on a single line
- `distanceToPerimeterLines(point, lines)` - Minimum distance across multiple lines
- `distanceToPolygonPerimeter(point, polygon)` - Convenience: polygon → lines → min distance
- `checkPerimeterProximity(point, polygon, tolerance)` - Returns `{ distance, withinTolerance }`

**`src/components/WalkingMode/WalkingMode.tsx`**:

- `perimeterLines` (useMemo) - Memoizes polygon-to-line conversion for performance
- `useEffect` on `[position, perimeterLines]` - Calculates distance when GPS updates
- `withinTolerance` - Derived boolean: `distance <= 25m`

### Performance Considerations

- **Memoized perimeter lines**: The expensive `polygonToPerimeterLines()` call is memoized and only recalculates when geometry changes (once per walking session)
- **Cheap distance calculation**: `distanceToPerimeterLines()` is O(n) where n = number of perimeter rings (typically 1), executed on each GPS update (~1/second)
- **Rounded distance**: Distances are rounded to whole meters before state update to reduce unnecessary re-renders

## Rationale

### Design Decisions

1. **Bottom status bar placement**: Chosen to keep the main map view uncluttered while providing constant feedback. The status bar already shows GPS accuracy, making distance a natural companion metric.

2. **25m tolerance threshold**: Matches the existing buffer zone used in post-walk analysis (ADR 002, ADR 003). Using the same threshold provides consistency - if you see green during walking, you know that segment will count as "on boundary" in your final score.

3. **Color-coded marker vs. separate indicator**: The position marker color change provides immediate "at a glance" feedback without requiring the user to read numbers. Green = good, blue = needs adjustment.

4. **No haptic/audio feedback**: Kept to visual-only for MVP simplicity. Haptic and audio can be added later based on user feedback.

### ADR References

- [ADR 002: Exclusive Activity Matching](../ADR/002-exclusive-activity-matching.md) - Defines the 25m buffer zone for GPS accuracy tolerance
- [ADR 003: Multi-Metric Scoring](../ADR/003-multi-metric-completion-scoring.md) - Defines `PERIMETER_BUFFER_METERS = 25` and deviation thresholds
- [ADR 017: Live Walking Mode](../ADR/017-live-walking-mode.md) - Base feature this extends, explicitly mentions distance indicator as future enhancement

## Current Limitations

1. **No haptic feedback** - Users must look at screen to see distance (no vibration when crossing threshold)
2. **No directional guidance** - Shows distance but not which direction to go
3. **Single point calculation** - Measures to nearest boundary point, doesn't account for walking direction
4. **No historical tracking** - Distance not recorded for post-walk analysis (only used for real-time guidance)

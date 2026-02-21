# Distance-to-Boundary Indicator

## Overview

The Distance-to-Boundary Indicator provides real-time feedback to walkers during live walking mode, showing their current distance from the sub-area boundary line and which scoring tier they are currently in. This helps users optimize their walking precision by showing the same tier colors they'll see in their analyzed route segments.

The feature provides three visual elements:
1. **Position marker** - Color changes to reflect current distance tier (Platinum through Missed)
2. **Status text** - Shows distance and tier name (e.g., "12m - Gold")
3. **Enlarged display** - 2x larger than standard UI for outdoor visibility

## User Stories

From [PRD 001](../PRD/001-mvp-mobile-walker.md) Section 2 - Live Walking Mode Stories:

- "As a user, I want to see my real-time distance from the boundary while walking, so I know how far I need to adjust my path."
- "As a user, I want my position marker to use the same tier colors as the scoring system (Platinum/Gold/Silver/Bronze/Potato/Missed), so I know exactly which tier I'm walking at in real-time."
- "As a user, I want to see my current distance tier name in the status indicator (e.g., '12m - Gold'), so I understand how my walking precision translates to my final score."
- "As a user, I want the distance indicator to be large and easy to read while walking outdoors, so I can quickly glance at it without stopping."

## Implementation

*Initial implementation: 2026-02-16 per TICKET-018*
*Tiered enhancements: 2026-02-21 per TICKET-028*

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/geo-distance.ts` | Consolidated distance calculation utilities |
| `src/lib/distance-tiers.ts` | Tier assignment logic (`assignDistanceTier`) - reused from scoring |
| `src/lib/design-tokens.ts` | `DISTANCE_TIER_COLORS` - single source of truth for tier hex colors |
| `src/components/WalkingMode/WalkingMode.tsx` | Main component - calculates distance, computes tier via `assignDistanceTier()` |
| `src/components/WalkingMode/WalkingControls.tsx` | Status bar - displays "{distance}m - {Tier}" with tier-colored background |
| `src/components/WalkingMode/LivePositionMarker.tsx` | Position marker - accepts `tier` prop, applies `DISTANCE_TIER_COLORS[tier]` |

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
currentTier = useMemo(() => assignDistanceTier(distance).tier)
  - ≤10m: Platinum, ≤20m: Gold, ≤30m: Silver
  - ≤40m: Bronze, ≤50m: Potato, >50m: Missed
       |
       +---> WalkingControls (tier prop, ENLARGED 2x): 
       |       - Shows: "{distance}m - {Tier}" (e.g., "12m - Gold")
       |       - Background: DISTANCE_TIER_COLORS[tier]
       |       - Text: white on dark tiers, dark on light tiers
       |
       +---> LivePositionMarker (tier prop, ENLARGED 2x): 
               - fillColor: DISTANCE_TIER_COLORS[tier]
               - Platinum: Deep Violet (#7c3aed)
               - Gold: Vibrant Purple (#a855f7)
               - Silver: Magenta Pink (#d946ef)
               - Bronze: Soft Pink (#f0abfc)
               - Potato: Warm Gray (#a1a1aa)
               - Missed: Light Red (#fca5a5)
```

### Key Functions

**`src/lib/geo-distance.ts`**:

- `polygonToPerimeterLines(polygon)` - Converts polygon to LineString array for distance calculations
- `distanceToLine(point, line)` - Distance from point to nearest point on a single line
- `distanceToPerimeterLines(point, lines)` - Minimum distance across multiple lines

**`src/lib/distance-tiers.ts`**:

- `assignDistanceTier(distanceMeters)` - Returns `{ tier, points }` based on ADR 021 thresholds
- `DISTANCE_TIER_THRESHOLDS` - Threshold values: 10m, 20m, 30m, 40m, 50m
- `DistanceTier` type - 'platinum' | 'gold' | 'silver' | 'bronze' | 'potato' | 'missed'

**`src/lib/design-tokens.ts`**:

- `DISTANCE_TIER_COLORS` - Hex colors for each tier (single source of truth)

**`src/components/WalkingMode/WalkingMode.tsx`**:

- `perimeterLines` (useMemo) - Memoizes polygon-to-line conversion for performance
- `useEffect` on `[position, perimeterLines]` - Calculates distance when GPS updates
- `currentTier` (useMemo) - Derives tier from distance using `assignDistanceTier()`

### Performance Considerations

- **Memoized perimeter lines**: The expensive `polygonToPerimeterLines()` call is memoized and only recalculates when geometry changes (once per walking session)
- **Cheap distance calculation**: `distanceToPerimeterLines()` is O(n) where n = number of perimeter rings (typically 1), executed on each GPS update (~1/second)
- **Rounded distance**: Distances are rounded to whole meters before state update to reduce unnecessary re-renders

## Rationale

### Design Decisions

1. **Bottom status bar placement**: Chosen to keep the main map view uncluttered while providing constant feedback. The status bar already shows GPS accuracy, making distance a natural companion metric.

2. **6-tier coloring (not binary)**: Aligns real-time feedback with post-walk scoring (ADR 021). Users learn the tier system during walks, improving understanding of their final scores. Seeing "Gold" during walking means that segment will score 0.80 in analysis.

3. **Tier name in status text**: Shows "12m - Gold" instead of just "12m from boundary". This teaches users the scoring system and provides immediate feedback on precision quality.

4. **2x enlarged display**: Outdoor walking conditions require larger UI elements - bright sunlight, phone at arm's length, quick glances while moving. The enlarged indicator prioritizes glanceability over compactness.

5. **Color gradient consistency**: Uses same hex colors as route visualization (Deep Violet → Light Red), creating visual continuity between real-time walking and post-walk analysis.

6. **No haptic/audio feedback**: Kept to visual-only for MVP simplicity. Haptic and audio can be added later based on user feedback.

### ADR References

- [ADR 017: Live Walking Mode](../ADR/017-live-walking-mode.md) - Base feature, updated 2026-02-21 with tiered indicator enhancements
- [ADR 021: Tiered Distance Scoring](../ADR/021-tiered-distance-scoring.md) - Defines the 6-tier system and colors used by this indicator
- [ADR 002: Exclusive Activity Matching](../ADR/002-exclusive-activity-matching.md) - Original 25m buffer concept

## Current Limitations

1. **No haptic feedback** - Users must look at screen to see tier (no vibration when crossing tier boundaries)
2. **No directional guidance** - Shows distance but not which direction to go to improve tier
3. **Single point calculation** - Measures to nearest boundary point, doesn't account for walking direction
4. **No historical tracking** - Tier progression not recorded for post-walk analysis (only used for real-time guidance)
5. **No tier transition alerts** - No visual/audio alert when moving between tiers (e.g., Gold → Silver)

## Changelog

### 2026-02-21 (TICKET-028)
- Changed position marker from binary (green/blue) to 6-tier colors
- Changed status text from "On track (12m)" to "12m - Gold"
- Enlarged status indicator (px-6 py-3 text-lg vs px-4 py-2 text-sm) for outdoor visibility
- Added dark text on light tier backgrounds (bronze/potato/missed) for contrast
- Reused existing `assignDistanceTier()` and `DISTANCE_TIER_COLORS` (no new code duplication)

### 2026-02-16 (TICKET-018)
- Initial implementation with binary tolerance coloring (green within 25m, blue otherwise)
- Created `geo-distance.ts` module for distance calculations

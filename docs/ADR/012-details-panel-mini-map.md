# ADR 012: Details Panel Mini-Map Component

**Date:** 2026-02-07  
**Status:** Accepted

## Context

When users select a subarea on the map, the Area Details Panel (bottom sheet) displays comprehensive information about that area including name, tier, score breakdown, and walk history. However, users currently have no visual reference for the shape and boundary of the selected area within the panel itself.

This creates a disconnect: users must mentally map the textual information in the panel back to the geographic context on the main map behind it. For mobile users especially, the bottom sheet often covers most of the map, making it difficult to see the selected area.

**Primary use case:** Users need to **study the selected area to plan their walking route**. This requires seeing:
- The exact boundary shape and where it runs
- Street layout along the border (to find walkable paths)
- Surrounding context (parks, water, buildings) that affect routing

Additionally, during hover interactions, users see area name and score but not the circumference distance—useful information for planning walks.

## Decision

### Mini-Map in Details Panel

Add a **functional planning map** to the Area Details Panel that displays:

1. **Full street-level base map** - Standard OpenStreetMap or similar tiles showing streets, paths, and landmarks
2. **The selected subarea boundary polygon** - outlined prominently with tier-colored fill at low opacity
3. **Auto-fit bounds** - zoom level calculated to fit the polygon with padding
4. **Interactive** - users can pan and zoom to explore the area in detail

**Implementation approach:** Create an `AreaMiniMap` component using React-Leaflet with:
- Fixed dimensions (responsive: full-width, ~200px height on mobile, expandable)
- Full base map tiles (same provider as main map, or higher detail variant)
- Boundary polygon overlay with prominent stroke
- Pan and zoom enabled for route exploration
- Optional: tap-to-expand to larger view for detailed planning

**Why a real map with streets?** The primary goal is route planning - users need to see where streets run relative to the boundary to find optimal walking paths. A boundary-only view would not serve this purpose.

### Circumference in Hover Tooltip

Add circumference distance with estimated walk time to the `AreaTooltip` component:
- Display format: "2.3 km (~28 min)"
- Walk time estimate: 5 km/h average walking pace (12 minutes per km)
- Shown for all areas (completed and not started)

## Consequences

### Positive

- **Route planning enabled**: Users can study streets along the boundary to find optimal walking paths
- **Better spatial awareness**: Users can see exact shape, size, and context of selected area
- **Improved planning**: Circumference + time estimate helps users choose appropriate areas for their available time
- **Consistent UX**: Mini-map uses same tile provider as main map
- **No new dependencies**: Uses existing React-Leaflet setup

### Negative

- **Mobile bandwidth**: Additional tile requests for street-level detail (acceptable trade-off for planning utility)
- **Performance consideration**: Creating Leaflet instances has overhead; ensure cleanup on panel close
- **Panel height**: Functional map needs more vertical space (~200px vs original ~150px)

### Neutral

- **Future enhancement**: Could add walk routes overlay to mini-map to show previous attempts

## Implementation Notes

- Component location: `src/components/AreaMiniMap/AreaMiniMap.tsx`
- Props: `geometry: GeoJSON.Geometry`, `tier?: TierLevel`, `className?: string`
- Use `fitBounds()` with padding to auto-zoom on mount
- Enable `dragging`, `touchZoom`, `scrollWheelZoom` for exploration
- Use same tile provider as main map for consistency
- Boundary polygon: prominent stroke (3-4px), tier-colored fill at ~0.2 opacity so streets remain visible
- Respect existing design tokens from `src/lib/design-tokens.ts` for colors
- Walk time formula: `Math.round(circumference_km * 12)` minutes

## References

- [ADR 010: Map Visual Design System](./010-map-visual-design-system.md) - Color scheme for tier fills
- [PRD 001 Section 3.6](../PRD/001-mvp-mobile-walker.md) - Area Details Panel specification
- [Feature: Map Visualization](../features/map-visualization.md) - Parent feature

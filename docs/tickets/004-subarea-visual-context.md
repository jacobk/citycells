# TICKET-004: Subarea Visual Context Enhancements

**Related:** ADR 012, PRD Section 3.5, 3.6  
**Feature:** Map Visualization  
**Status:** Implemented  
**Created:** 2026-02-07

## Context to Load

Files the implementation agent MUST read first:

1. `docs/ADR/012-details-panel-mini-map.md` - Technical decision for mini-map approach
2. `docs/PRD/001-mvp-mobile-walker.md` Section 3.5, 3.6 - Tooltip and Details Panel specs
3. `docs/features/map-visualization.md` - Current implementation details
4. `src/components/AreaTooltip/` - Existing tooltip component to modify
5. `src/components/AreaDetailsPanel/` - Existing details panel to modify
6. `src/lib/design-tokens.ts` - Tier colors and design tokens

## Implementation Checklist

### 1. Create AreaMiniMap Component

Create new component at `src/components/AreaMiniMap/AreaMiniMap.tsx`:

- Accept props: `geometry: GeoJSON.Geometry`, `tier?: TierLevel`, `className?: string`
- Render React-Leaflet `MapContainer` with **interactions enabled**
- Use same tile provider as main map (full street-level detail)
- Single `GeoJSON` layer for the polygon boundary:
  - Prominent stroke (3-4px width)
  - Tier-colored fill at ~0.2 opacity (streets visible through fill)
- Use `fitBounds()` with padding to auto-zoom on mount
- Enable: `dragging`, `touchZoom`, `scrollWheelZoom`, `doubleClickZoom`
- Hide zoom controls (use gestures only) to save space
- Fixed height (~200px), full width

**Purpose:** Enable users to study the area and plan walking routes by seeing streets along the boundary.

See ADR 012 for full rationale.

### 2. Integrate Mini-Map into AreaDetailsPanel

Modify `src/components/AreaDetailsPanel/`:

- Add `AreaMiniMap` below the header section
- Pass selected area's geometry and tier
- Ensure proper cleanup when panel closes (unmount map instance)

### 3. Add Circumference to AreaTooltip

Modify `src/components/AreaTooltip/`:

- Add circumference display with format: "X.X km (~YY min)"
- Calculate walk time: `Math.round(circumference_km * 12)` minutes
- Position after area name, before tier badge
- Show for all areas (not just completed ones)

### 4. Calculate Circumference Utility

If not already available, create utility function:

- Input: GeoJSON polygon geometry
- Output: perimeter length in kilometers
- Use Turf.js `length()` on polygon boundary

## Acceptance Criteria

- [ ] When opening Area Details Panel, a mini-map showing the selected subarea is visible below the header
- [ ] The mini-map fills the panel width and has ~200px height
- [ ] The mini-map shows full street-level detail (same tiles as main map)
- [ ] The subarea boundary is clearly visible with prominent stroke
- [ ] The boundary fill uses tier color at low opacity (streets visible through it)
- [ ] User can pan and zoom the mini-map to explore the area
- [ ] Mini-map auto-fits to the subarea bounds on initial load
- [ ] When hovering over any area, the tooltip shows circumference with estimated walk time
- [ ] Walk time estimate uses 5 km/h formula (e.g., 2.3 km shows "~28 min")
- [ ] Circumference appears for both completed and not-started areas
- [ ] No console errors or memory leaks when opening/closing panel repeatedly

## Files to Modify

| File | Change |
|------|--------|
| NEW: `src/components/AreaMiniMap/AreaMiniMap.tsx` | New mini-map component |
| NEW: `src/components/AreaMiniMap/index.tsx` | Dynamic import wrapper (SSR) |
| `src/components/AreaDetailsPanel/AreaDetailsPanel.tsx` | Add AreaMiniMap integration |
| `src/components/AreaTooltip/AreaTooltip.tsx` | Add circumference + walk time |
| `src/lib/geo-utils.ts` (or similar) | Add circumference calculation if needed |

## Notes

- Do NOT duplicate ADR/PRD content - reference it
- Use dynamic import for AreaMiniMap to avoid SSR issues with Leaflet
- Consider lazy-loading map tiles only when panel opens
- Walk time estimate intentionally simple (no terrain/elevation factors)

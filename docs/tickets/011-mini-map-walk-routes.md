# TICKET-011: Mini-Map Walk Route Visualization

**Related:** ADR 010 (Section 3), ADR 012, PRD Section 3.6 (Mini-Map)  
**Feature:** Map Visualization  
**Status:** Implemented  
**Created:** 2026-02-07

## Context to Load

Files the implementation agent MUST read first:

1. `docs/ADR/010-map-visual-design-system.md` Section 3 - Route visualization decisions (deviation coloring, styling)
2. `docs/ADR/012-details-panel-mini-map.md` - Mini-map implementation details
3. `docs/PRD/001-mvp-mobile-walker.md` Section 3.6 - Area Details Panel Mini-Map requirements (updated)
4. `docs/features/map-visualization.md` - Route visualization implementation and mini-map section
5. `src/components/AreaMiniMap/AreaMiniMap.tsx` - Current mini-map component
6. `src/components/AreaDetailsPanel/AreaDetailsPanel.tsx` - Details panel with walk history
7. `src/lib/route-visualization.ts` - Route preparation utilities (reuse existing)
8. `src/lib/db.ts` - Database functions for retrieving walk stream data

## Implementation Checklist

### 1. Add Route Toggle Control to AreaDetailsPanel

Add a toggle control above the mini-map to show/hide walk routes.

- **Location:** Above mini-map, below header section
- **Design:** Toggle switch or button (match main map route toggle style)
- **Label:** "Show Walk Route" or icon-only (route/path icon)
- **Default State:** OFF (routes hidden)
- **State Management:** Local state in AreaDetailsPanel component

### 2. Retrieve Walk Route Data

Load route coordinates for the selected walk (or best walk if none selected).

- **Data Source:** Use `getWalkStreams()` from `db.ts` to get cached stream data
- **Fallback:** If stream data unavailable, decode `summary_polyline` from walk data
- **Coordinate Format:** Convert to GeoJSON `[lng, lat]` format for route preparation
- **Selected Walk:** Default to walk with `isBest: true`, allow selection from Walk History

### 3. Prepare Route Segments for Mini-Map

Reuse existing route visualization utilities to prepare deviation-colored segments.

- **Function:** Use `prepareDeviationColoredRoute()` from `route-visualization.ts`
- **Input:** Walk coordinates (from streams or polyline) + area boundary geometry
- **Output:** Array of `RouteSegment` objects with positions and colors
- **Styling:** Same deviation-based coloring (green = within 25m, red = deviation)

### 4. Render Routes on Mini-Map

Add route Polylines to AreaMiniMap component.

- **Component:** Add `Polyline` components from `react-leaflet` to AreaMiniMap
- **Props:** Accept optional `routeSegments` prop (array of RouteSegment)
- **Rendering:** Only render when toggle is ON and routeSegments provided
- **Z-Order:** Routes render above area boundary polygon (same as main map)
- **Styling:** Use `getRoutePathOptions()` from `route-visualization.ts` for consistent styling

### 5. Implement Walk Selection in Walk History

Make walk items in Walk History section selectable.

- **Selection State:** Track selected walk ID in AreaDetailsPanel state
- **Default Selection:** Set to walk with `isBest: true` when panel opens
- **Visual Indicator:** Highlight selected walk (border, background color, or checkmark)
- **Interaction:** Click/tap on walk item selects it and updates mini-map route
- **Single Walk:** When only one walk exists, auto-select it (no selection UI needed)

### 6. Update AreaDetailsPanel Props/State

Extend component to handle route data and selection.

- **Props:** No new props needed (walks already passed in `details.walks`)
- **State:** Add `selectedWalkId` state (number | null)
- **State:** Add `showRoute` toggle state (boolean)
- **Effect:** When selectedWalkId changes, load route data and prepare segments
- **Effect:** When showRoute changes, pass routeSegments to AreaMiniMap

### 7. Handle Edge Cases

- **No Walks:** Toggle disabled or hidden when `details.walks.length === 0`
- **No Stream Data:** Fallback to `summary_polyline` if streams unavailable
- **Loading State:** Show loading indicator while fetching/preparing route data
- **Error Handling:** Gracefully handle missing walk data or route preparation errors

## Acceptance Criteria

- [ ] Toggle control appears above mini-map in AreaDetailsPanel
- [ ] Toggle defaults to OFF (routes hidden)
- [ ] When toggle is ON, selected walk route displays on mini-map
- [ ] Route uses same deviation-based coloring as main map (green/red segments)
- [ ] When multiple walks exist, Walk History shows all walks
- [ ] Walk items in Walk History are clickable to select
- [ ] Selected walk is visually highlighted in Walk History
- [ ] Default selection is best walk (`isBest: true`)
- [ ] When only one walk exists, it auto-selects and displays when toggle is ON
- [ ] Routes render above area boundary polygon (correct z-order)
- [ ] Stream data preferred, falls back to `summary_polyline` if unavailable
- [ ] Toggle disabled/hidden when no walks exist for area

## Files to Modify

| File | Change |
|------|--------|
| `src/components/AreaMiniMap/AreaMiniMap.tsx` | Add `routeSegments` prop, render Polyline components |
| `src/components/AreaDetailsPanel/AreaDetailsPanel.tsx` | Add toggle control, walk selection state, route data loading, pass routeSegments to mini-map |
| `src/lib/route-visualization.ts` | Reuse existing functions (no changes needed) |
| `src/lib/db.ts` | Reuse `getWalkStreams()` (no changes needed) |

## Refactoring Opportunities

- **DRY Violation:** Route preparation logic is duplicated between Map.tsx and AreaMiniMap. Consider extracting route data loading into a shared hook (e.g., `useWalkRouteData(walkId, areaGeometry)`).
- **State Management:** Route toggle and selection state could be extracted into a custom hook for better testability and reuse.
- **Performance:** Route segments are recalculated on every selection change. Consider memoizing route preparation with `useMemo` based on walkId and geometry.

## Notes

- Do NOT duplicate ADR/PRD content - reference it
- Reuse existing route visualization utilities - do not reimplement deviation calculation
- The 25m threshold matches existing perimeter buffer (ADR 002/003)
- Stream data is already cached in database - no additional API calls needed
- Route styling matches main map for visual consistency (ADR 010)
- Mini-map route visualization is independent from main map route toggle

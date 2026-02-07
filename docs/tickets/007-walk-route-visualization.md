# TICKET-007: Walk Route Visualization Improvements

**Related:** ADR 010 (Section 3), ADR 006, PRD Section 3.4  
**Feature:** Map Visualization  
**Status:** Implemented  
**Created:** 2026-02-07  
**Implemented:** 2026-02-07

## Context to Load

Files the implementation agent MUST read first:

1. `docs/ADR/010-map-visual-design-system.md` Section 3 - Route visualization decisions (deviation coloring, visibility toggle, z-order)
2. `docs/ADR/006-strava-activity-streams.md` - Stream data for full path GPS coordinates
3. `docs/PRD/001-mvp-mobile-walker.md` Section 3.4 - Walking Route Visualization requirements
4. `docs/features/map-visualization.md` - Current implementation details and limitations
5. `src/components/Map/Map.tsx` - Main map component where routes are rendered
6. `src/lib/design-tokens.ts` - Centralized color tokens to update

## Implementation Checklist

### 1. Add Route Visibility Toggle

Create a toggle control to show/hide walking routes on the map.

- Default state: OFF (routes hidden)
- Location: Map controls area (consider placement near zoom controls or in hamburger menu)
- State management: Use React state in Map component or lift to page level
- Label: "Show Walk Routes" or use a route/path icon

### 2. Implement Deviation-Based Segment Coloring

When routes are visible, color each segment based on distance from sub-area boundary.

- Calculate distance from each segment midpoint to nearest point on assigned sub-area boundary
- Apply binary threshold:
  - ≤ 25m from boundary → Green (`#22c55e`)
  - > 25m from boundary → Red (`#ef4444`)
- Use Turf.js `nearestPointOnLine()` or similar for distance calculation
- Segment width: 3px, opacity: 0.85

### 3. Use Stream Data for Full Paths

Ensure route visualization uses activity stream data (not `summary_polyline`) for complete paths.

- Check if stream data is available for each activity
- If stream `latlng` exists, use it for route coordinates
- Fallback to `summary_polyline` if streams unavailable (with visual indicator if desired)
- This fixes the "cut off" appearance at start/end due to privacy zones

### 4. Update Z-Order (Routes Above Area Fills)

Ensure walking routes render above completed area fills for visibility.

- Routes should appear above area polygons but below tier medal icons
- Use Leaflet's `pane` system or explicit z-index ordering
- Test with completed (colored) areas to verify routes are visible

### 5. Update Design Tokens

Add new route colors to the design tokens file.

- Add `ROUTE_ON_TRACK` = `#22c55e` (green)
- Add `ROUTE_DEVIATION` = `#ef4444` (red)
- Remove or deprecate old triple-layer route colors if no longer used

## Acceptance Criteria

- [ ] Walking routes are hidden by default when the map loads
- [ ] Toggle control is visible and functional to show/hide routes
- [ ] When visible, route segments within 25m of boundary are green
- [ ] When visible, route segments beyond 25m of boundary are red
- [ ] Routes use stream data coordinates (full path, not truncated)
- [ ] Routes render on top of completed area fills (visible against colored areas)
- [ ] Route lines are 3px wide (not "chunky")
- [ ] All design tokens are centralized in `design-tokens.ts`

## Files to Modify

| File | Change |
|------|--------|
| `src/components/Map/Map.tsx` | Add route toggle state, update route rendering logic, z-order |
| `src/lib/design-tokens.ts` | Add new route colors (green/red), deprecate old cyan/teal |
| NEW: `src/components/RouteToggle/RouteToggle.tsx` | Toggle control component (optional - could be inline) |
| `src/components/HamburgerMenu/HamburgerMenu.tsx` | Add route toggle option if placing in menu |

## Notes

- Do NOT duplicate ADR/PRD content - reference it
- The 25m threshold matches the existing perimeter buffer in ADR 002/003
- Per-segment distance calculation may have performance implications with many routes; consider optimization if needed
- Stream data fetching is already covered by ADR 006; this ticket focuses on visualization

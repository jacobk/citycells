# TICKET-015: Details Panel Boundary View Enhancement

**Related:** ADR 012 (Updated), PRD Section 3.7  
**Feature:** Map Visualization  
**Status:** Implemented (pending manual viewport testing)  
**Created:** 2026-02-13

## Context to Load

Files the implementation agent MUST read first:

1. `docs/ADR/012-details-panel-mini-map.md` - Updated decision on dynamic height and stats placement
2. `docs/PRD/001-mvp-mobile-walker.md` Section 3.7 - Area Details Panel specification
3. `docs/features/map-visualization.md` - Current implementation details (Subarea Visual Context section)
4. `src/components/AreaDetailsPanel/AreaDetailsPanel.tsx` - Main component to modify
5. `src/components/AreaMiniMap/AreaMiniMap.tsx` - Mini-map component to modify
6. `src/lib/geo-utils.ts` - Shared perimeter and walk time utilities

## Implementation Checklist

### 1. Update Mini-Map Height Behavior

Change the mini-map from fixed 200px height to dynamic height that fills available viewport space.

- Current: Fixed `200px` height
- Target: Fill available viewport height above the fold (minimum ~200px)
- Use CSS flex-grow or `calc()` pattern to calculate available space
- Panel content below the map should scroll within the panel

### 2. Add Area Stats Section Below Mini-Map

Add a stats section between the mini-map and score breakdown showing:
- Circumference with estimated walk time (e.g., "2.3 km (~28 min)")
- Reuse `formatCircumferenceWithTime()` from `src/lib/geo-utils.ts`

### 3. Adjust Panel Scroll Behavior

Ensure the panel content structure supports:
- Header: Fixed at top
- Mini-map: Fills available viewport height
- Stats: Below mini-map
- Score breakdown, walk history, etc.: Scrollable below stats

## Maintainability

Before implementing, review for:

- [x] **Refactor opportunity?** Reuse existing `formatCircumferenceWithTime()` from geo-utils
- [x] **DRY check** - Stats formatting already exists in geo-utils.ts
- [x] **Modularity** - Mini-map uses CSS flex-grow, no complex height calculation needed
- [x] **Debt impact** - This reduces UX debt by improving boundary inspection experience

## Acceptance Criteria

- [x] Mini-map height fills available viewport space (not fixed 200px)
- [x] Mini-map has a minimum height of ~200px
- [x] Circumference and estimated walk time displayed below mini-map
- [x] Panel content below stats is scrollable
- [x] Existing mini-map functionality (pan, zoom, boundary polygon) unchanged
- [ ] Works on mobile viewport sizes (manual testing required)
- [ ] Works on desktop viewport sizes (manual testing required)

## Files to Modify

| File | Change |
|------|--------|
| `src/components/AreaDetailsPanel/AreaDetailsPanel.tsx` | Add stats section, adjust layout for dynamic map height |
| `src/components/AreaMiniMap/AreaMiniMap.tsx` | Change height from fixed to dynamic (flex-grow or CSS calc) |
| `src/components/AreaMiniMap/AreaMiniMap.css` or inline styles | Height and layout styling changes |

## Notes

- Do NOT duplicate ADR/PRD content - reference it
- The hover tooltip already uses `formatCircumferenceWithTime()` - reuse this for consistency
- Test on various viewport heights to ensure map sizing feels right
- Leaflet maps may need `invalidateSize()` call if height changes dynamically

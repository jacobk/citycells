# TICKET-027: Scrollable Mini-Map with Maximize View

**Related:** ADR 022, PRD Section 3.5 (Mini-Map)  
**Feature:** Map Visualization  
**Status:** Implemented  
**Created:** 2026-02-18

## Context to Load

Files the implementation agent MUST read first:

1. `docs/ADR/022-scrollable-minimap-with-maximize.md` - Full decision context and specifications
2. `docs/PRD/001-mvp-mobile-walker.md` Section 3.5 (Mini-Map) - Updated user requirements
3. `docs/features/map-visualization.md` - Current implementation details and updated specs
4. `src/components/AreaMiniMap/AreaMiniMap.tsx` - Current mini-map component to modify
5. `src/components/AreaDetailsPanel/AreaDetailsPanel.tsx` - Panel layout to refactor
6. `docs/ADR/021-tiered-distance-scoring.md` - Distance tier colors for legend
7. `src/lib/design-tokens.ts` - Color constants to reference/extend

## Implementation Checklist

### 1. Refactor AreaDetailsPanel Layout

Change from fixed mini-map + scrollable content to **fully scrollable content**:
- Remove flex-grow from mini-map section
- Make entire panel content scrollable (header can remain fixed if desired)
- Mini-map at top of scroll area with fixed height (~180-200px)
- See ADR 022 "Mini-Map in Scrollable Content" section

### 2. Add Maximize Button to AreaMiniMap

- Add expand icon button (e.g., maximize/fullscreen icon) in corner of mini-map
- Button should be clearly visible but not obstruct map interaction
- On click, opens MaximizedMapModal
- Pass necessary data (geometry, walks, tier) to modal

### 3. Create MaximizedMapModal Component

New component: `src/components/MaximizedMapModal/MaximizedMapModal.tsx`

**Structure:**
- Modal overlay (~90% viewport, modal-style with small margin)
- X close button in top-right corner
- Full-size interactive Leaflet map with boundary polygon
- Control panel with walk toggles
- Distance tier legend section

**Props interface (suggested):**
```typescript
interface MaximizedMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  geometry: GeoJSON.Geometry;
  tier?: TierLevel;
  walks: WalkData[]; // Array of walks for this area
}
```

### 4. Implement Per-Walk Toggle Controls

- Display a toggle for each walk in the area
- Toggles are multi-select (can show multiple walks)
- Each toggle shows walk name/date for identification
- Toggle state managed within modal (not persisted)
- When toggle is ON, walk route renders on map

### 5. Implement Distance Tier Legend

Create legend component showing tier colors and meanings:

| Tier | Color | Distance |
|------|-------|----------|
| Platinum | Deep Green | 0-10m |
| Gold | Light Green | 10-20m |
| Silver | Yellow | 20-30m |
| Bronze | Orange | 30-40m |
| Potato | Light Red | 40-50m |
| Missed | Red | >50m |

- Colors should come from `design-tokens.ts` (may need to add tier route colors)
- Legend can be collapsible to save space
- Position in modal control panel area

### 6. Render Walk Routes with Tier Colors

- Reuse/adapt `prepareDeviationColoredRoute()` from `route-visualization.ts`
- Color segments by distance tier (not deviation-based)
- Load stream data from database for accurate paths
- Handle multiple walks rendering simultaneously

## Maintainability

Before implementing, review for:

- [x] **Refactor opportunity?** Panel layout simplification removes complex flex logic
- [x] **DRY check** - Distance tier colors should be single source in design-tokens.ts
- [x] **Modularity** - MaximizedMapModal is a new reusable component; Legend is reusable
- [x] **Debt impact** - This change reduces complexity in AreaDetailsPanel

**Specific refactoring tasks:**
- Extract distance tier color definitions to `design-tokens.ts` if not already there
- Consider extracting Legend component for potential reuse on main map
- Ensure walk toggle state pattern is reusable

## Testing Requirements

**Reference:** [AGENTS.md Section 2](../../AGENTS.md#2-build-verification-checklist-required), [ADR 020](../ADR/020-agent-build-verification.md)

### Unit Tests Required

| Function | Test File | Test Cases |
|----------|-----------|------------|
| N/A (UI-only) | - | No new business logic functions |

**Note:** This ticket is primarily UI changes. No new business logic functions require unit tests. However, if any utility functions are created (e.g., tier color lookup), they should be tested.

### Verification Checklist

Implementation agent MUST run before marking complete:
```bash
npm run lint   # Must pass
npm run build  # Must pass
npm run test   # Must pass
```

## Acceptance Criteria

- [x] Mini-map in AreaDetailsPanel is scrollable with other content (not fixed)
- [x] Mini-map has fixed compact height (~180-200px)
- [x] Maximize button visible on mini-map
- [x] Clicking maximize opens modal (~90% viewport)
- [x] Modal has X button that closes it
- [x] Modal shows full-size interactive map with boundary
- [x] Modal has per-walk toggle controls (when walks exist)
- [x] Multiple walks can be shown simultaneously
- [x] Walk routes colored by distance tier (not deviation)
- [x] Distance tier legend displayed in modal
- [x] Legend explains all 6 tier colors
- [x] Modal backdrop is semi-transparent
- [x] All existing mini-map functionality preserved (pan, zoom, boundary)

## Files to Modify

| File | Change |
|------|--------|
| `src/components/AreaDetailsPanel/AreaDetailsPanel.tsx` | Refactor layout to fully scrollable, pass modal open handler |
| `src/components/AreaMiniMap/AreaMiniMap.tsx` | Add maximize button, reduce to fixed height |
| NEW: `src/components/MaximizedMapModal/MaximizedMapModal.tsx` | Full modal with map, toggles, legend |
| NEW: `src/components/MaximizedMapModal/index.tsx` | Dynamic import wrapper (SSR) |
| NEW: `src/components/DistanceTierLegend/DistanceTierLegend.tsx` | Reusable legend component |
| `src/lib/design-tokens.ts` | Add distance tier route colors if not present |
| `src/lib/route-visualization.ts` | Update/add tier-based coloring function if needed |

## Notes

- Do NOT duplicate ADR/PRD content - reference it
- This is a **breaking change** - users will see different behavior immediately
- Consider accessibility: modal should trap focus, be keyboard dismissible (Escape)
- Test on mobile viewport sizes to ensure modal is usable
- Walk route data comes from existing database caching (no new API calls needed)

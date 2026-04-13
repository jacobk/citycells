# TICKET-032: Map Layer Toggles

**Related:** ADR 027, PRD Section 2 (Map Layer Stories), PRD Section 3.4
**Feature:** Map Layer Toggles from docs/features/map-layer-toggles.md
**Status:** Ready for Implementation
**Created:** 2026-04-13

## Context to Load

Files the implementation agent MUST read first:

1. `docs/ADR/027-map-layer-toggles.md` - Layer toggle architecture and design decisions
2. `docs/PRD/001-mvp-mobile-walker.md` Section 3.4 - Area Status Visualization requirements
3. `docs/features/map-layer-toggles.md` - Feature documentation
4. `docs/features/map-visualization.md` - Existing map visualization feature details
5. `src/components/Map/Map.tsx` - Main map component (conditional layer rendering)
6. `src/components/MapStyleToggle.tsx` - Reference pattern for floating map controls
7. `src/components/HamburgerMenu/HamburgerMenu.tsx` - Current "Show Routes" toggle to migrate
8. `src/lib/design-tokens.ts` - Color tokens and tier styling
9. `src/lib/route-visualization.ts` - Route line rendering logic

## Implementation Checklist

### 1. Create Unified MapSettingsPanel Component

Replace `MapStyleToggle.tsx` with a new `MapSettingsPanel` component that combines tile style selection and layer toggles. Same position (bottom-right), same trigger size (40×40px rounded button), but with a layers icon. Panel opens upward with two sections:

- **Map Style section:** Horizontal segmented control with Grayscale/Color/Satellite (replaces current vertical list). Follow the same pattern as the Light/System/Dark theme picker in HamburgerMenu.
- **Layers section:** 4 toggle rows (Subarea Lines, Walk Lines, Walk Shapes, Heatmap) with labels and toggle switches. Each row 44px+ for touch targets.

Panel closes on tap-outside (same `pointerdown` listener pattern as current MapStyleToggle). Panel stays open while toggling — does NOT close on selection.

Support `variant: 'full' | 'compact'` prop — compact shows only tile style (for AreaMiniMap, MaximizedMapModal, SharedWalkMap).

### 2. Implement Subarea Lines Toggle

Conditionally render polygon border strokes based on toggle state. When OFF, sub-area polygons should have no visible border/stroke. Default: ON.

### 3. Migrate Walk Lines Toggle

Move the existing "Show Routes" toggle from `HamburgerMenu.tsx` into the Layers section. Reuse existing route rendering logic from `route-visualization.ts`. Remove the old toggle from hamburger menu. Default: OFF.

### 4. Implement Walk Shapes Layer

Create polygon-from-path logic: treat the GPS track as a polygon boundary and fill the enclosed area (paint-bucket fill). Render as **borderless filled polygons** (fill only, no stroke). Use GPS stream data when available, fall back to summary polyline. Default: OFF.

### 5. Implement Heatmap Toggle

When ON: current tier-based coloring (ADR 010 purple-pink gradient). When OFF: walked areas use the same styling as unwalked areas (no color distinction). Default: ON.

### 5b. Implement Emojis Toggle

When ON: show tier medal icons (🏆🥇🥈🥉🥔) at polygon centroids. When OFF: hide them. Default: OFF.

### 6. Persist Toggle States

Save all 5 layer toggle states to `localStorage`. Tile style persistence is unchanged (reuse existing key). Restore on page load.

### 7. Update Compact Map Views

Replace `MapStyleToggle` usage in AreaMiniMap, MaximizedMapModal, and SharedWalkMap with the new `MapSettingsPanel` using `variant="compact"`. Verify tile switching still works in all compact views.

### 8. Clean Up

Remove `MapStyleToggle.tsx` after all usages are migrated. Remove "Show Routes" toggle from `HamburgerMenu.tsx`.

## Maintainability

Before implementing, review for:

- [ ] **Refactor opportunity?** `MapStyleToggle.tsx` is fully replaced — delete it after migration, don't leave dead code
- [ ] **DRY check** — Tile style state (existing `useMapTileLayer` hook) and route visibility state (existing in `page.tsx`) should be consolidated into the new panel's state management
- [ ] **Modularity** — Walk shape generation should be a pure function in `src/lib/` for testability
- [ ] **Debt impact** — Reduces UI fragmentation: one panel replaces MapStyleToggle + hamburger route toggle

**Specific refactoring tasks:**
- Delete `MapStyleToggle.tsx` after all usages migrated to `MapSettingsPanel`
- Remove "Show Routes" toggle from `HamburgerMenu.tsx`
- Consolidate tile style + route visibility + new layer toggle states into one hook (e.g. `useMapSettings`)
- Update all compact map views to use new component with `variant="compact"`

## Testing Requirements

**Reference:** [AGENTS.md Section 2](../../AGENTS.md#2-build-verification-checklist-required), [ADR 020](../ADR/020-agent-build-verification.md)

### Unit Tests Required

| Function | Test File | Test Cases |
|----------|-----------|------------|
| Walk shape buffer generation | `src/lib/__tests__/walk-shapes.test.ts` | Buffer from GPS points, empty input, single point, closed loop |

### Verification Checklist

```bash
npm run lint   # Must pass
npm run build  # Must pass
npm run test   # Must pass
```

## Acceptance Criteria

- [ ] Unified MapSettingsPanel replaces MapStyleToggle in bottom-right corner
- [ ] Tile style segmented control works (Grayscale/Color/Satellite) — same behavior as before
- [ ] Compact variant works in AreaMiniMap, MaximizedMapModal, SharedWalkMap (tile style only)
- [ ] Subarea lines toggle hides/shows polygon borders
- [ ] Walk lines toggle shows/hides route polylines (same behavior as old "Show Routes")
- [ ] Walk shapes toggle shows/hides filled polygons from GPS tracks (paint-bucket fill of enclosed area)
- [ ] Heatmap toggle switches between tier-based coloring and no color distinction (same as unwalked)
- [ ] Emojis toggle shows/hides tier medal icons at polygon centroids (default OFF)
- [ ] All toggle states persist across page reloads via localStorage
- [ ] "Show Routes" toggle removed from hamburger menu
- [ ] `MapStyleToggle.tsx` deleted (fully replaced)
- [ ] Default states: Subarea lines ON, Walk lines OFF, Walk shapes OFF, Heatmap ON, Emojis OFF
- [ ] Panel closes on tap-outside, stays open while toggling
- [ ] Touch targets ≥44px for all toggles

## Files to Modify

| File | Change |
|------|--------|
| `src/components/MapSettingsPanel/MapSettingsPanel.tsx` | New unified panel (replaces MapStyleToggle) |
| `src/components/MapStyleToggle.tsx` | **Delete** — fully replaced by MapSettingsPanel |
| `src/components/Map/Map.tsx` | Conditional rendering for all 4 layers, use new panel |
| `src/components/HamburgerMenu/HamburgerMenu.tsx` | Remove "Show Routes" toggle |
| `src/components/AreaMiniMap/AreaMiniMap.tsx` | Switch to MapSettingsPanel with `variant="compact"` |
| `src/components/MaximizedMapModal/MaximizedMapModal.tsx` | Switch to MapSettingsPanel with `variant="compact"` |
| `src/app/page.tsx` | Layer toggle state management, pass to Map |
| `src/lib/walk-shapes.ts` | New GPS track buffering logic |
| `src/lib/__tests__/walk-shapes.test.ts` | Unit tests for buffer generation |
| `src/lib/design-tokens.ts` | Add uniform fill color token for heatmap-off mode |

## Notes

- Do NOT duplicate ADR/PRD content — reference it
- The walk shapes feature is the most technically novel part — GPS buffering logic needs careful design
- Touch targets must be ≥44px for all toggles (WCAG)
- Tile style section uses horizontal segmented control (same pattern as theme picker in HamburgerMenu)
- `MapStyleClass` helper (Leaflet CSS class sync) is unchanged — just import it from the new component location
- Estimated panel height ~280-320px; on 667px iPhone screen this leaves ~350px visible map — acceptable since panel is temporary

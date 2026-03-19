# TICKET-031: Satellite Map Toggle

**Related:** ADR 025, PRD Section 3.1, 3.13
**Feature:** Satellite Map Toggle from docs/features/satellite-map-toggle.md
**Status:** Done
**Created:** 2026-03-19

## Context to Load

Files the implementation agent MUST read first:

1. `docs/ADR/025-satellite-map-toggle.md` - Tile provider decision, toggle behavior spec
2. `docs/PRD/001-mvp-mobile-walker.md` Section 3.1, 3.13 - Map interface and walking mode requirements
3. `docs/features/satellite-map-toggle.md` - Feature documentation
4. `src/lib/map-config.ts` - Current tile configuration (single source of truth)
5. `src/components/Map/Map.tsx` - Main map component with TileLayer
6. `src/components/WalkingMode/WalkingMode.tsx` - Walking mode map
7. `src/components/AreaMiniMap/AreaMiniMap.tsx` - Mini-map in details panel
8. `src/components/MaximizedMapModal/MaximizedMapModal.tsx` - Maximized map modal
9. `src/app/share/walk/SharedWalkMap.tsx` - Shared walk view map

## Implementation Checklist

### 1. Add Satellite Tile Configuration to map-config.ts

Add satellite tile URL and attribution constants alongside existing street tile config. See ADR 025 for exact URL and attribution.

### 2. Create Shared Map Layer Toggle Hook/Utility

Create a shared mechanism (e.g., custom hook or utility) that:
- Reads/writes map style preference to `localStorage`
- Returns current tile URL and attribution
- Provides toggle function
- Ensures consistency across all map views

### 3. Add Toggle UI to All Map Views

Add a satellite/street toggle control to each map component:
- `Map.tsx` — Map controls area
- `WalkingMode.tsx` — Map controls area
- `AreaMiniMap.tsx` — Small icon button (space-constrained)
- `MaximizedMapModal.tsx` — Map controls area
- `SharedWalkMap.tsx` — Map controls area

### 4. Update TileLayer Instances

Update all `TileLayer` components to use dynamic tile URL from the shared toggle state instead of the static `TILE_LAYER_URL`.

### 5. Full-Color Satellite Rendering

Disable the grayscale CSS filter (ADR 010) when satellite tiles are active. The `.satellite-tiles` class on `MapContainer` scopes the filter with `:not(.satellite-tiles)` in `globals.css`. See ADR 025 "Full-Color Satellite Rendering" section.

### 6. Satellite Boundary Contrast Enhancement

When satellite mode is active, boundary overlays must use high-contrast styling per ADR 025:

- **Border color:** White `#ffffff` (replaces tier-specific purple-pink)
- **Border opacity:** 1.0 (up from 0.8)
- **Border weight:** Component default + 1px
- **Fill opacity:** Tier-specific + 0.10 (capped at 0.75)
- **Unwalked border:** White `#ffffff`, 2px (up from Slate, 1px)

Add satellite-aware helpers to `design-tokens.ts` (e.g., `getSatelliteBorderColor()`, `getSatelliteFillOpacity()`) and update all 5 map components' style functions to use them when `isSatellite` is true.

### 7. Verify Overlay Visibility on Satellite

Ensure boundary polygons, walk routes, and markers remain clearly visible against satellite imagery after applying the contrast changes from step 6.

## Maintainability

Before implementing, review for:

- [ ] **Refactor opportunity?** All 5 map components use `TILE_LAYER_URL` — a shared hook avoids duplicating toggle logic
- [ ] **DRY check** — Tile config stays centralized in `map-config.ts`; toggle logic in one shared hook
- [ ] **Modularity** — Toggle hook should be independent of any specific map component
- [ ] **Debt impact** — Reduces debt by replacing the hardcoded tile URL pattern with a configurable one

**Specific refactoring tasks:**
- Extract tile layer selection into a reusable hook (e.g., `useMapTileLayer`)
- Consider whether the toggle button UI can be a shared component used across all map views

## Testing Requirements

**Reference:** [AGENTS.md Section 2](../../AGENTS.md#2-build-verification-checklist-required), [ADR 020](../ADR/020-agent-build-verification.md)

### Unit Tests Required

| Function | Test File | Test Cases |
|----------|-----------|------------|
| Toggle hook/utility | `src/lib/__tests__/map-tile-toggle.test.ts` | Returns correct URLs for each mode, persists preference, defaults to street |

### Verification Checklist

```bash
npm run lint   # Must pass
npm run build  # Must pass
npm run test   # Must pass
```

## Acceptance Criteria

- [x] Toggle button visible on all 5 map views (main, walking, mini-map, maximized, shared)
- [x] Clicking toggle switches between street and satellite tiles
- [x] Preference persists across page reloads (localStorage)
- [x] Preference applies globally — toggling in one view affects all views
- [x] Default is street view (existing behavior unchanged for new users)
- [x] Attribution text updates correctly for each tile provider
- [x] Satellite tiles render in full color (grayscale filter disabled)
- [x] Boundaries use white strokes on satellite imagery for maximum contrast
- [x] Fill opacity increased on satellite to stand out against busy terrain
- [x] Unwalked area borders switch to white on satellite
- [x] All overlays (boundaries, routes, markers) clearly visible on satellite imagery

## Files to Modify

| File | Change |
|------|--------|
| `src/lib/map-config.ts` | Add satellite tile URL and attribution constants |
| `src/hooks/useMapTileLayer.ts` (new) | Shared hook for tile layer toggle with localStorage |
| `src/components/MapStyleToggle.tsx` (new) | Shared floating toggle button component |
| `src/app/globals.css` | Conditional grayscale filter (`:not(.satellite-tiles)`) |
| `src/lib/design-tokens.ts` | Add satellite-aware boundary styling helpers |
| `src/components/Map/Map.tsx` | Add toggle button, dynamic TileLayer, satellite boundary styling |
| `src/components/WalkingMode/WalkingMode.tsx` | Add toggle button, dynamic TileLayer, satellite boundary styling |
| `src/components/AreaMiniMap/AreaMiniMap.tsx` | Add toggle button, dynamic TileLayer, satellite boundary styling |
| `src/components/MaximizedMapModal/MaximizedMapModal.tsx` | Add toggle button, dynamic TileLayer, satellite boundary styling |
| `src/app/share/walk/SharedWalkMap.tsx` | Add toggle button, dynamic TileLayer, satellite boundary styling |

## Notes

- Do NOT duplicate ADR/PRD content — reference it
- The PRD Section 3.13 already listed "Satellite/street toggle" as nice-to-have for walking mode — this ticket promotes it to all map views
- Esri World Imagery requires no API key — just the tile URL

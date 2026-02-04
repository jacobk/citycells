# TICKET-001: Map Visual Design System

**Related:** ADR 010, PRD Section 3.4  
**Feature:** Map Visualization  
**Status:** Implemented  
**Created:** 2026-02-04

## Context to Load

Files the implementation agent MUST read first:

1. `docs/ADR/010-map-visual-design-system.md` - Full technical specification (colors, layers, accessibility)
2. `docs/PRD/001-mvp-mobile-walker.md` Section 3.4 - Requirements summary
3. `docs/features/map-visualization.md` - Current implementation details and key functions
4. `src/components/Map/Map.tsx` - Main component to modify

## Implementation Checklist

### 1. Base Map Grayscale Filter

Apply muted styling to reduce visual competition with data overlays.

**Option A - CSS Filter (recommended):**
- Add filter to `.leaflet-tile-pane` in globals.css

**Option B - Tile Provider:**
- Switch to CartoDB Positron tiles

### 2. Create Design Tokens

Create `src/lib/design-tokens.ts` with centralized color constants:

- Tier fill colors (purple-pink gradient)
- Tier border colors
- Route colors (cyan glow effect)
- Opacity values per tier

### 3. Update `getStyle()` Function

Modify the area styling function to use new palette:

- Platinum: `#7c3aed` @ 0.65 opacity
- Gold: `#a855f7` @ 0.60 opacity
- Silver: `#d946ef` @ 0.55 opacity
- Bronze: `#f0abfc` @ 0.50 opacity

### 4. Route Triple-Layer Styling

Implement glow/outline/core layers for walking routes:

- Glow layer: `#22d3ee`, 7px, 0.30 opacity
- Outline layer: `#0f766e`, 5px, 0.60 opacity
- Core layer: `#06b6d4`, 3px, 0.90 opacity

### 5. Tier Medal Icons

Create `TierIcon` component:

- Use `L.DivIcon` for Leaflet integration
- Calculate polygon centroids with `turf.centroid()` / `turf.pointOnFeature()`
- Show icons at zoom level 13+
- Scale icon size with zoom

## Acceptance Criteria

- [x] Base map is grayscale/muted (not colorful OSM default)
- [x] Area fills use purple-pink gradient (darker = higher tier)
- [x] Routes have visible cyan glow effect
- [x] Tier icons appear at area centers when zoom >= 13
- [x] WCAG 2.1 contrast ratios maintained (3:1+ adjacent colors)
- [x] Colors work for common color vision deficiencies

## Files to Modify

| File | Change |
|------|--------|
| `src/components/Map/Map.tsx` | Update `getStyle()`, add route layers, add icon markers |
| `src/app/globals.css` | Add `.leaflet-tile-pane` grayscale filter |
| NEW: `src/lib/design-tokens.ts` | Centralized color constants |
| NEW: `src/components/TierIcon/TierIcon.tsx` | Medal icon component |

## Notes

- Do NOT duplicate ADR 010 content - reference it for exact specifications
- Test on mobile viewport sizes
- Verify glow effect performance on older devices

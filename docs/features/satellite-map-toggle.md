# Satellite Map Toggle

## Overview

Allows users to select between three map styles — **Grayscale** (default), **Color**, and **Satellite** — across all map views. Grayscale mutes the base map so walked-area overlays stand out (ADR 010). Color shows full-color OpenStreetMap tiles. Satellite uses Esri World Imagery for real-world landmark orientation. Preference persists via localStorage and applies globally.

## User Stories

From [PRD 001](../PRD/001-mvp-mobile-walker.md):
- "As a walker, I want to toggle between street and satellite map views so that I can better orient myself using real-world imagery when navigating boundaries."
- "As a user, I want my map style preference to persist across sessions and views so that I don't have to toggle it every time I open a different map."

## Implementation

### Key Files

| File | Purpose |
|------|---------|
| `src/hooks/useMapTileLayer.ts` | Shared hook — external store with localStorage, exposes `mapStyle`, `setStyle`, tile URL/attribution |
| `src/components/MapStyleToggle.tsx` | Popover selector UI (3 options) + `MapStyleClass` for imperative DOM class sync |
| `src/lib/map-config.ts` | Satellite tile URL and attribution constants |
| `src/lib/design-tokens.ts` | Satellite-aware boundary helpers (`getBorderColor`, `getBorderWeight`, `getBorderOpacity`, `getFillOpacity`) |
| `src/app/globals.css` | `.grayscale-tiles` CSS filter rule (opt-in, default mode) |
| `src/components/Map/Map.tsx` | Main map — uses hook, selector, and boundary helpers |
| `src/components/WalkingMode/WalkingMode.tsx` | Walking mode map |
| `src/components/AreaMiniMap/AreaMiniMap.tsx` | Mini-map in details panel |
| `src/components/MaximizedMapModal/MaximizedMapModal.tsx` | Maximized map modal |
| `src/app/share/walk/SharedWalkMap.tsx` | Shared walk view map |

### Data Flow

1. `useMapTileLayer` hook reads/writes `citycells-map-style` in localStorage via `useSyncExternalStore`.
2. All map components consume the hook to get `tileUrl`, `mapStyle`, and `isSatellite`.
3. `MapStyleClass` child component imperatively manages CSS classes on the Leaflet container (because `MapContainer` className is immutable after mount in react-leaflet v4).
4. Boundary style functions (`getBorderColor`, etc.) accept `isSatellite` and return white high-contrast values when true.

### Key Functions

- `useMapTileLayer()` — returns `{ tileUrl, tileAttribution, mapStyle, isSatellite, setStyle }`
- `MapStyleClass` — react-leaflet child that syncs `grayscale-tiles` / `satellite-tiles` / none on the container DOM element
- `getBorderColor(tier, isSatellite)` — returns white `#ffffff` in satellite mode, tier color otherwise
- `getBorderWeight(base, isSatellite)` — adds +1px in satellite mode
- `getFillOpacity(tier, base, isSatellite)` — boosts by 0.10, capped at 0.75, in satellite mode

## Rationale

### Design Decisions

- **Three modes** (grayscale/color/satellite) instead of two — grayscale remains the default for overlay contrast (ADR 010), but users can opt into full-color street tiles when they prefer it.
- **Popover selector** instead of cycling toggle — explicit menu avoids confusion about which mode comes next.
- **Esri World Imagery** chosen over Mapbox/Google for zero-config setup (no API key needed) with excellent satellite image quality. See ADR 025 for full comparison.
- **localStorage persistence** chosen over component state so the preference is global across all map views and survives page reloads.
- **Imperative DOM class sync** (`MapStyleClass`) — `MapContainer`'s `className` prop is immutable after mount in react-leaflet v4, so CSS classes must be managed via `useMap().getContainer().classList`.
- **White boundaries on satellite** — sub-area boundary strokes switch to white (`#ffffff`) at full opacity when satellite is active. White provides maximum contrast against any satellite terrain type. See ADR 025.

### ADR References

- [ADR 025: Satellite Map Toggle](../ADR/025-satellite-map-toggle.md) - Tile provider selection, toggle architecture, full-color rendering, and boundary contrast rules
- [ADR 010: Map Visual Design System](../ADR/010-map-visual-design-system.md) - Grayscale filter that is conditionally disabled

## Current Limitations

1. Satellite tiles are heavier than street tiles, increasing mobile data usage
2. Satellite imagery may be dated in rapidly developing areas
3. Offline support for satellite tiles depends on prior caching (tiles cached on use)

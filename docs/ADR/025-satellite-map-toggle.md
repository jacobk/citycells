# ADR 025: Satellite Map Toggle

**Date:** 2026-03-19 (Updated: 2026-03-19)
**Status:** Accepted
**Supersedes:** N/A

## Context

CityCells currently uses OpenStreetMap street tiles exclusively across all map views (main map, walking mode, mini-map, maximized modal, shared walk). When walking sub-area boundaries in practice, users sometimes need real-world imagery to orient themselves — identifying landmarks, green spaces, water features, or building layouts that help them navigate the boundary more precisely.

The PRD (Section 3.13, Walking Mode Controls) already identified a satellite/street toggle as a "nice-to-have". This ADR promotes it to a supported feature across all map instances.

## Decision

We will add a satellite tile layer toggle using **Esri World Imagery** as the satellite tile provider, available across all map views.

### Tile Provider: Esri World Imagery

- **URL:** `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}`
- **Attribution:** `Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community`
- **License:** Free for non-commercial and commercial use, no API key required
- **Quality:** High-resolution satellite imagery with global coverage, updated regularly

### Alternatives Considered

| Provider | Quality | Setup | Cost | Decision |
|----------|---------|-------|------|----------|
| **Esri World Imagery** | Excellent global coverage | Zero config, no API key | Free | **Selected** |
| Mapbox Satellite | Excellent | Requires API key, account setup | Free tier (200k loads/mo) | Rejected — unnecessary complexity |
| Google Satellite | Best in urban areas | Requires GCP account, API key, billing | Pay-per-use | Rejected — cost and setup overhead |

Esri was chosen for the best balance of image quality and zero-friction setup (no API key, no account, no rate limits for typical usage).

### Toggle Behavior

- Toggle control available on all map instances
- User preference persisted to `localStorage` so it carries across views and sessions
- Default: Street view (existing behavior, preserves current UX)
- Switching layers preserves current zoom, center, and all overlays

### Full-Color Satellite Rendering

The street map uses a grayscale CSS filter (ADR 010) to mute the base map and reduce visual competition with data overlays. **This filter MUST be disabled when satellite tiles are active.** Grayscale destroys the value of satellite imagery — users switch to satellite specifically to see real-world color context (green spaces, water, building materials, etc.).

**Implementation:** Add a `.satellite-tiles` class to each `MapContainer` when satellite is active. Scope the grayscale filter with `:not(.satellite-tiles)`:

```css
.leaflet-container:not(.satellite-tiles) .leaflet-tile-pane {
  filter: grayscale(100%) brightness(1.1) !important;
}
```

### Boundary Contrast on Satellite Imagery

Satellite imagery has rich, varied colors (greens, browns, grays, blues) that can clash with overlay colors. The existing tier boundary styling (ADR 010 purple-pink gradient) was designed for contrast against a muted grayscale base map — on satellite, some boundary colors (especially lighter tiers like Bronze `#f0abfc` and Potato `#b8936d`) risk blending into the terrain.

**Decision:** When satellite mode is active, all sub-area boundary strokes switch to **white (`#ffffff`)** at full opacity with an increased weight (+1px). This ensures boundaries remain clearly visible against any satellite terrain.

| Property | Street Mode | Satellite Mode |
|----------|-------------|----------------|
| **Border color** | Tier-specific (ADR 010 purple-pink) | White `#ffffff` |
| **Border opacity** | 0.8 | 1.0 |
| **Border weight** | Component default (1-4px) | Component default + 1px |
| **Fill colors** | Tier-specific (ADR 010) | Tier-specific (unchanged) |
| **Fill opacity** | Tier-specific (0.40-0.65) | Tier-specific + 0.10 (capped at 0.75) |
| **Unwalked border** | Slate `#64748b`, 1px | White `#ffffff`, 2px |

**Rationale:**
- White provides maximum contrast against all satellite terrain types (urban, rural, water, forest)
- WCAG 2.1 requires 3:1 minimum contrast for graphical objects; white against typical satellite imagery exceeds 7:1
- Tier identification is still conveyed via fill color — the border's job is visibility, not tier encoding
- Increased fill opacity compensates for the busier satellite background competing with the overlay
- This approach requires no new colors — just conditional application of existing white + existing fills

### Map Views Affected

| View | Component | Toggle Location |
|------|-----------|-----------------|
| Main map | `Map.tsx` | Map controls area |
| Walking mode | `WalkingMode.tsx` | Map controls area |
| Mini-map (details panel) | `AreaMiniMap.tsx` | Small icon button |
| Maximized map modal | `MaximizedMapModal.tsx` | Map controls area |
| Shared walk view | `SharedWalkMap.tsx` | Map controls area |

## Consequences

### Positive
- Users can orient themselves using real-world imagery while walking
- Satellite view helps identify landmarks, paths, and obstacles near boundaries
- Zero additional cost or infrastructure (no API keys, no accounts)
- Single `localStorage` preference applies globally — set once, applies everywhere
- Full-color satellite rendering preserves the value of real-world imagery
- White boundaries ensure sub-areas are clearly visible on any satellite terrain

### Negative
- Satellite tiles are larger than street tiles, increasing data usage on mobile
- Satellite imagery may be less readable at very high zoom levels in some areas
- Additional tile provider URL to cache for offline support
- Boundary styling is conditionally different between modes, adding code complexity

### Technical
- New satellite tile URL and attribution constants in `map-config.ts`
- Shared toggle state via `localStorage` (consistent across all map views)
- All `TileLayer` instances need to support dynamic URL switching
- Grayscale CSS filter must be conditionally disabled via `.satellite-tiles` class on `MapContainer`
- Boundary styling functions in `design-tokens.ts` should accept an `isSatellite` parameter for conditional white borders
- Service Worker tile caching strategy should include satellite tiles

### Maintainability
- Tile config remains centralized in `map-config.ts` (DRY)
- Toggle logic extracted to `useMapTileLayer` shared hook for reuse across map components
- Satellite-aware boundary styling centralized in `design-tokens.ts` helper functions
- No new dependencies required — uses existing react-leaflet `TileLayer`

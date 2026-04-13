# ADR 027: Map Layer Toggles

**Date:** 2026-04-13
**Status:** Proposed
**Supersedes:** Partially supersedes ADR 025 (MapStyleToggle UI — tile selection moves into this combined panel; tile behavior unchanged)

## Context

The main map currently shows all visual layers simultaneously: sub-area polygon borders, tier-based heatmap coloring, and optionally walk route lines (via a toggle in the hamburger menu). Users want more granular control over what's visible on the map to focus on specific information — for example, seeing only where they've physically walked (as filled polygons around GPS tracks) without the distraction of scoring colors, or viewing total progress with uniform coloring instead of tier-based shading.

Additionally, the existing "Show Routes" toggle lives in the hamburger menu, which is not discoverable and requires navigating away from the map. A dedicated floating layer control panel would make all layer toggles accessible directly on the map.

## Decision

We will replace the existing `MapStyleToggle` component with a unified **Map Settings panel** that combines tile style selection and layer visibility toggles into a single floating control.

### Unified Panel Design

The current `MapStyleToggle` (bottom-right, ADR 025) is absorbed into a new combined panel. Both tile style and layer visibility answer the same user question: "What does my map look like?" — combining them follows the pattern used by Google Maps, Apple Maps, and standard GIS tools.

**Collapsed state:** A single 40×40px rounded button in the bottom-right corner (same position as current MapStyleToggle) with a **layers icon**. Replaces the current map-style-specific icon.

**Expanded state (on tap):** Panel opens upward with two sections:

```
+----------------------------------+
|  MAP STYLE                       |
|  [Grayscale] [Color] [Satellite] |   ← horizontal segmented control
|  ─────────────────────────────── |
|  LAYERS                          |
|  Subarea Lines          [toggle] |
|  Walk Lines             [toggle] |
|  Walk Shapes            [toggle] |
|  Heatmap                [toggle] |
|  Emojis                 [toggle] |
+----------------------------------+
```

**Close behavior:** Tap outside the panel (same pattern as current MapStyleToggle). Panel stays open while toggling — unlike the current MapStyleToggle which closes on selection — because layer toggles are multi-choice and users will toggle several in one session.

**Compact variant:** Mini-map views (AreaMiniMap, MaximizedMapModal, SharedWalkMap) only need tile style selection, not layer toggles. The component supports a `variant: 'full' | 'compact'` prop — compact shows only the Map Style section.

### Layer Toggles

| Toggle | Description | Default |
|--------|-------------|---------|
| **Subarea Lines** | Show/hide the polygon border outlines for all 136 sub-areas | ON |
| **Walk Lines** | Show/hide the route polylines (colored by distance tier per ADR 021) | OFF |
| **Walk Shapes** | Show/hide filled/buffered polygons around GPS tracks, representing the actual ground covered | OFF |
| **Heatmap** | Toggle between tier-based coloring (current behavior per ADR 010) and no coloring (walked areas look the same as unwalked) | ON |
| **Emojis** | Show/hide tier medal icons (🏆🥇🥈🥉🥔) at polygon centroids | OFF |

### Walk Shapes (New Layer)

Walk shapes are polygons created from GPS track coordinates, treating the walk path as a polygon boundary and filling the enclosed area (like a "paint bucket" fill). When a user walks a loop around an area, the entire interior is filled. This provides a visual answer to "where exactly have I walked?" independent of sub-area boundaries and scoring.

Walk shapes render as **borderless filled polygons** — fill only, no stroke/outline. This keeps them visually distinct from subarea lines and walk route lines.

### Heatmap Toggle Behavior

- **ON (default):** Current behavior — sub-areas colored by tier using the purple-pink gradient (ADR 010).
- **OFF:** All walked sub-areas use the same styling as unwalked areas (no color distinction), removing score-based visual noise.

### Map Style Section

Tile style selection (Grayscale/Color/Satellite) uses a **horizontal segmented control** (like the existing Light/System/Dark theme picker in HamburgerMenu) instead of the current vertical list. This is more compact and frees vertical space for the layer toggles.

### State Persistence

All state persists to `localStorage`:
- Tile style preference (existing key, same behavior as current MapStyleToggle)
- 4 layer toggle booleans (new keys)

## Consequences

### Positive
- Users can focus on specific information (walk coverage, progress, scoring) independently
- Walk shapes provide a new way to visualize actual ground covered
- Uniform color mode makes total progress easier to assess at a glance
- Consolidates all map appearance controls (tile style + layer visibility) into one panel
- Reduces floating UI elements — one button replaces the current MapStyleToggle, and removes the hamburger menu route toggle
- Follows established map UI conventions (Google Maps, Apple Maps, Mapbox)

### Negative
- Walk shape generation (GPS buffering) adds computation cost
- More map layers increase rendering complexity
- Combined panel is taller than current MapStyleToggle dropdown (~280-320px)

### Technical
- `MapStyleToggle.tsx` is replaced by new unified component (e.g. `MapSettingsPanel.tsx`)
- `MapStyleClass` helper (Leaflet CSS class sync) remains unchanged
- Compact variant needed for mini-map views that only need tile style selection
- New GPS track buffering logic needed in `src/lib/` for walk shape generation
- Route toggle moves from hamburger menu to combined panel
- `localStorage` keys needed for persisting 4 layer toggle states (tile style key unchanged)
- Map component needs conditional rendering for each layer

### Maintainability
- Layer control logic should be modular — each toggle manages one visual concern
- Walk shape generation should be a pure function in `src/lib/` with unit tests
- Design tokens for uniform color mode should extend `src/lib/design-tokens.ts`
- DRY: consolidates route toggle state, tile style state, and new layer states into one component/hook
- `variant: 'full' | 'compact'` keeps the component reusable across map contexts

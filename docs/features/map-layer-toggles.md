# Map Layer Toggles

## Overview

A unified Map Settings panel that replaces the existing `MapStyleToggle` and combines tile style selection with five layer visibility toggles. The panel provides granular control over map appearance: tile style (Grayscale/Color/Satellite), subarea lines, walk lines, walk shapes (filled polygons from GPS tracks), heatmap coloring, and tier emoji icons. This enables focused views like "only show where I've walked" or "show progress without score colors."

## User Stories

From [PRD 001](../PRD/001-mvp-mobile-walker.md):
- "As a user, I want to toggle sub-area boundary lines on/off, so I can reduce visual clutter when focusing on walk data."
- "As a user, I want to toggle walk route lines on/off directly from the map, so I can quickly see or hide my routes without navigating to a menu."
- "As a user, I want to see filled shapes showing where I've physically walked, so I can visualize my actual ground coverage."
- "As a user, I want to toggle between tier-based heatmap coloring and uniform coloring, so I can easily see total progress without score distraction."

## Implementation

> **Note:** This section is completed by the implementation agent.

### Key Files

| File | Purpose |
|------|---------|
| `src/components/MapSettingsPanel/MapSettingsPanel.tsx` | Unified panel replacing MapStyleToggle (tile style + layer toggles) |
| `src/lib/walk-shapes.ts` | Walk shape (GPS buffer) generation logic |
| `src/lib/__tests__/walk-shapes.test.ts` | Unit tests for walk shape generation |
| `src/components/Map/Map.tsx` | Conditional layer rendering |
| `src/lib/design-tokens.ts` | Uniform color token for heatmap-off mode |

### Data Flow

{Describe how data moves through the system for this feature.}

### Key Functions

{Document important functions and what they do.}

## Rationale

### Design Decisions

- **Combined panel replacing MapStyleToggle:** Tile style and layer visibility both answer "what does my map look like?" — combining them into one panel follows established map UI conventions (Google Maps, Apple Maps) and reduces the number of floating controls. The existing `MapStyleToggle` is absorbed, not supplemented.
- **Layers icon trigger:** A universal layers icon (stacked parallelograms) replaces the current map-style icon. Communicates "multiple things to configure" rather than just tile style.
- **Horizontal segmented control for tile style:** The current vertical list of Grayscale/Color/Satellite becomes a compact horizontal segmented control (same pattern as the Light/System/Dark theme picker), freeing vertical space for the layer toggles.
- **Panel stays open while toggling:** Unlike the current MapStyleToggle which closes on selection (single-choice), the combined panel stays open on tap-outside only — layer toggles are multi-choice and users toggle several per session.
- **Compact variant for mini-maps:** Mini-map views (AreaMiniMap, MaximizedMapModal, SharedWalkMap) only need tile style, not layer toggles. A `variant: 'full' | 'compact'` prop keeps the component reusable.
- **Walk shapes as borderless filled polygons:** GPS tracks form loops around areas. The walk path is treated as a polygon boundary and the enclosed area is filled (like a "paint bucket" fill). Shapes render with fill only (no stroke/border) to stay visually distinct from subarea lines and route lines.
- **Heatmap toggle removes color distinction:** When OFF, walked areas use the same styling as unwalked areas (no color distinction). This removes score-based visual noise and lets other layers (walk shapes, walk lines) stand out.
- **Emojis toggle (default OFF):** Tier medal icons at polygon centroids can be distracting. Off by default so users opt-in when they want to see them.
- **Independent toggles:** Each layer serves a different purpose. Users should be able to combine them freely (e.g., walk shapes ON + subarea lines OFF + heatmap OFF = pure walk coverage view).

### ADR References

- [ADR 027: Map Layer Toggles](../ADR/027-map-layer-toggles.md) - Architecture decision for unified panel and toggle system
- [ADR 025: Satellite Map Toggle](../ADR/025-satellite-map-toggle.md) - Original MapStyleToggle (partially superseded by ADR 027)
- [ADR 010: Map Visual Design System](../ADR/010-map-visual-design-system.md) - Current heatmap coloring system
- [ADR 021: Tiered Distance Scoring](../ADR/021-tiered-distance-scoring.md) - Route coloring tiers

## Current Limitations

1. Walk shapes require GPS stream data (not just summary polylines) for accurate polygon creation
2. Walk shapes work best with closed-loop walks; open paths are auto-closed by connecting end to start

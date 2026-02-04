# Map Visualization

## Overview

The map visualization is the core UI of CityCells, displaying Malmö's 136 sub-areas (delområden) and the user's walking progress. Areas are colored based on completion status, and walking routes are overlaid on the map.

## User Stories

From [PRD 001](../PRD/001-mvp-mobile-walker.md):
- "As a user, I want to see a map of Malmö with all sub-areas outlined, so I know where to walk."
- "As a user, I want to clearly see which areas I have completed."
- "As a user, I want to see a progress bar indicating how many total areas I have conquered."

## Implementation

### Key Files

| File | Purpose |
|------|---------|
| `src/components/Map/Map.tsx` | Main map component with analysis logic |
| `src/components/Map/index.tsx` | Dynamic import wrapper (SSR compatibility) |
| `src/components/TierIcon/TierIcon.tsx` | Medal icons at polygon centroids (ADR 010) |
| `src/lib/design-tokens.ts` | Centralized map visual design tokens (ADR 010) |
| `src/app/globals.css` | Grayscale filter for base map tiles |
| `public/data/malmo_delomraden.geojson` | GeoJSON data for 136 sub-areas |
| `src/app/page.tsx` | Main page integrating map with UI overlay |

### Data Flow

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  GeoJSON File   │    │   Strava API     │    │   Map Component │
└────────┬────────┘    └────────┬─────────┘    └────────┬────────┘
         │                      │                       │
         │ 1. Load areas        │                       │
         │─────────────────────────────────────────────>│
         │                      │                       │
         │                      │ 2. Fetch activities   │
         │                      │──────────────────────>│
         │                      │                       │
         │                      │                       │ 3. Analyze coverage
         │                      │                       │ (perimeter buffer)
         │                      │                       │
         │                      │                       │ 4. Exclusive assignment
         │                      │                       │
         │                      │                       │ 5. Update area colors
         │                      │                       │
```

### Analysis Algorithm (Current - Basic)

The current implementation performs basic perimeter coverage analysis:

1. **Pre-process areas**: For each sub-area polygon:
   - Convert polygon to perimeter line using `turf.polygonToLine()`
   - Create 25m buffer around perimeter using `turf.buffer()`
   - Calculate total perimeter length

2. **Pre-process activities**: For each Strava activity:
   - Decode polyline to GPS coordinates
   - Convert to Turf LineString

3. **Calculate coverage**: For each activity-area pair:
   - Check intersection with buffered perimeter
   - Calculate length of walk within buffer zone
   - Compute coverage ratio: `covered_length / perimeter_length`

4. **Exclusive assignment** (per ADR 002):
   - Each activity assigned to at most one area
   - Assigned to area with highest coverage ratio
   - Must exceed 50% to be "registered" (shown in amber)
   - Must exceed 75% to be "completed" (shown in green)

### Visual Design System (Updated: 2026-02-04)

The map uses a **heat map style visual design** as specified in ADR 010 and PRD 001 section 3.4:

#### Base Map
- **Grayscale/muted base layer** to reduce visual competition with data overlays
- Implemented via CSS filter (`grayscale(100%) brightness(1.1)`) or CartoDB Positron tiles

#### Area Fill Colors (Vibrant Purple-Pink Gradient)

| Tier | Color | Hex | Opacity | Score Range |
|------|-------|-----|---------|-------------|
| Platinum | Deep Violet | `#7c3aed` | 0.65 | ≥ 95% |
| Gold | Vibrant Purple | `#a855f7` | 0.60 | ≥ 85% |
| Silver | Magenta Pink | `#d946ef` | 0.55 | ≥ 70% |
| Bronze | Soft Pink | `#f0abfc` | 0.50 | ≥ 50% |
| Not Started | None | — | — | No qualifying walks |

**Design Rationale:** Bold purple-to-pink gradient creates visual excitement and aligns with modern design trends. High saturation colors pop dramatically against the grayscale base map while maintaining accessibility.

#### Walking Route Styling

| Element | Color | Hex | Width | Opacity |
|---------|-------|-----|-------|---------|
| Path Glow | Cyan Glow | `#22d3ee` | 7px | 0.30 |
| Path Outline | Deep Teal | `#0f766e` | 5px | 0.60 |
| Path Core | Electric Cyan | `#06b6d4` | 3px | 0.90 |

**Design Rationale:** Electric cyan is complementary to purple-pink (maximum contrast on color wheel). Triple-layer glow effect creates a premium, modern look that makes routes visually "pop".

#### Tier Medal Icons

- Small tier medal icons displayed at the centroid of each completed area
- Icons scale with zoom level, hidden below zoom 13
- Provides instant tier recognition without hovering

| Tier | Icon | Size |
|------|------|------|
| Platinum | Trophy | 20px |
| Gold | Gold Medal | 18px |
| Silver | Silver Medal | 16px |
| Bronze | Bronze Medal | 14px |

### Key Functions

**`CityMap` component**
- Manages `geoData`, `completedAreas`, `activityToAreaMap` state
- Runs analysis in `useEffect` when activities change
- Defers analysis to next tick (`setTimeout`) to avoid blocking UI

**`getStyle(feature)`**
Returns Leaflet style object based on area completion status.

**`LocationMarker` component**
Shows user's current GPS location on map.

## Rationale

### Why 25m Buffer?

The 25-meter buffer around area perimeters accounts for:
- GPS accuracy limitations (typically 5-15m in urban areas)
- Sidewalk offsets from property boundaries
- Natural walking path variations

This value is referenced in ADR 002 and ADR 003.

### Why Exclusive Assignment?

Per ADR 002, each walk is assigned to exactly one area to prevent:
- Gaming the system (one long walk matching 5 adjacent areas)
- Confusion about which walks count for which areas

### Why 75%/50% Thresholds?

- **75% for "Completed"**: Ensures walker actually traversed most of the border, not just passed through
- **50% for "Registered"**: Acknowledges partial progress while not counting minimal overlap

**Note**: ADR 003 changes the completion threshold to 50% (Bronze tier) with multi-metric scoring. The current 75% threshold is temporary.

### Why Defer Analysis?

Analysis runs in `setTimeout(..., 100)` to:
- Avoid blocking the main thread during map rendering
- Allow the UI to show "Analyzing paths..." indicator
- Prevent jank when processing many activities

### Why Hamburger Menu in Top-Left?

The hamburger menu button is positioned in the top-left corner because:
- Standard mobile convention places hamburger menus on the left
- Top-right is now occupied by the collapsible profile card (avatar)
- Bottom positions would conflict with the bottom sheet panel
- Familiar pattern users expect from mobile apps

See [ADR 009: UI Navigation Layout](../ADR/009-ui-navigation-layout.md) for full rationale.

### Collapsible Profile Card

The profile card (athlete info, progress) is now a collapsible component in the top-right:
- **Default state**: Collapsed, showing only the user's avatar (48x48px circular button)
- **Expanded state**: Full card with athlete name, progress bar, and logout button
- **Mutual exclusivity**: Only one overlay (hamburger or profile) can be open at a time

This design reduces visual clutter while maintaining quick access to profile information.

### ADR References

- [ADR 001: Tech Stack](../ADR/001-tech-stack.md) - Leaflet + Turf.js decision
- [ADR 002: Exclusive Activity Matching](../ADR/002-exclusive-activity-matching.md) - Assignment rules
- [ADR 003: Multi-Metric Scoring](../ADR/003-multi-metric-completion-scoring.md) - Tier thresholds and scoring
- [ADR 009: UI Navigation Layout](../ADR/009-ui-navigation-layout.md) - Current navigation layout (hamburger left, collapsible profile right)
- [ADR 008: Panel Navigation Architecture](../ADR/008-panel-navigation-architecture.md) - Original panel navigation (superseded by ADR 009)
- [ADR 010: Map Visual Design System](../ADR/010-map-visual-design-system.md) - Heat map colors, grayscale base, route styling, tier icons

## Current Limitations

1. **Details panel deviations**: The AreaDetailsPanel does not yet load deviation + exemption rows from the database; it only shows deviations when wired to persisted data.

2. **Cached details**: Clicked areas currently use the in-memory analysis results from the active session; loading full details from persistence is pending.

## New Components (Phase 5)

| Component | Location | Purpose |
|-----------|----------|---------|
| AreaTooltip | `src/components/AreaTooltip/` | Hover/long-press tooltip with quick info |
| AreaDetailsPanel | `src/components/AreaDetailsPanel/` | Bottom sheet with full score breakdown |
| ExemptionModal | `src/components/ExemptionModal/` | Modal for marking deviations as exempt |
| ProgressDashboard | `src/components/ProgressDashboard/` | Drawer with tier breakdown and stats |

## New Components (Sub-Area List Feature)

| Component | Location | Purpose |
|-----------|----------|---------|
| HamburgerMenu | `src/components/HamburgerMenu/` | Floating menu button (top-left) with app navigation |
| ProfileCard | `src/components/ProfileCard/` | Collapsible profile card (top-right) with avatar, name, progress |
| SubAreaListPanel | `src/components/SubAreaListPanel/` | Sortable list of all sub-areas in bottom sheet |
| PanelBreadcrumbs | `src/components/PanelBreadcrumbs/` | Navigation breadcrumbs within bottom sheet |

See [Sub-Area List](./sub-area-list.md) for full feature documentation.

## Planned Improvements

See [PROJECT_PLAN.md](../../PROJECT_PLAN.md) Phase 4-5 for:
- Multi-metric analysis engine
- Tier-based visualization
- Hover tooltips
- Area details panel
- Progress dashboard with tier breakdown

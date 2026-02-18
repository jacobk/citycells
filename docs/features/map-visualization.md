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
| `src/components/AreaMiniMap/AreaMiniMap.tsx` | Interactive mini-map for details panel (ADR 012) |
| `src/lib/design-tokens.ts` | Centralized map visual design tokens (ADR 010) |
| `src/lib/route-visualization.ts` | Route deviation calculation and segment coloring utilities (ADR 010) |
| `src/lib/geo-utils.ts` | Shared perimeter calculation and walk time formatting |
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
| Potato | Light Tan | `#d4b896` | 0.40 | < 50% |
| Not Started | None | — | — | No qualifying walks |

**Design Rationale:** Bold purple-to-pink gradient creates visual excitement and aligns with modern design trends. High saturation colors pop dramatically against the grayscale base map while maintaining accessibility.

#### Walking Route Styling (Updated: 2026-02-07)

**Visibility:** Routes are **hidden by default** to reduce visual clutter. Users toggle route visibility via a control in the map UI.

**Deviation-Based Coloring:** When visible, route segments are colored based on distance from the sub-area boundary:

| Condition | Color | Hex | Width | Opacity |
|-----------|-------|-----|-------|---------|
| Within 25m buffer | Green | `#22c55e` | 3px | 0.85 |
| Outside 25m buffer | Red | `#ef4444` | 3px | 0.85 |

**Data Source:** Routes use Strava stream data (ADR 006) to display the complete path, including segments that may be hidden by privacy zones in `summary_polyline`.

**Z-Order:** Routes render above completed area fills, ensuring they are visible when overlaid on completed (colored) areas.

**Design Rationale:**
- Binary threshold (green/red) provides immediate feedback on walk quality
- 25m threshold matches the buffer used for perimeter coverage scoring (ADR 002, 003)
- Thinner 3px lines reduce "chunky" appearance compared to previous triple-layer glow
- Hidden by default keeps the map clean; users opt-in to see route details

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
| Potato | Potato | 12px |

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
- [ADR 006: Strava Activity Streams](../ADR/006-strava-activity-streams.md) - High-fidelity GPS data for full route visualization
- [ADR 009: UI Navigation Layout](../ADR/009-ui-navigation-layout.md) - Current navigation layout (hamburger left, collapsible profile right)
- [ADR 008: Panel Navigation Architecture](../ADR/008-panel-navigation-architecture.md) - Original panel navigation (superseded by ADR 009)
- [ADR 010: Map Visual Design System](../ADR/010-map-visual-design-system.md) - Heat map colors, grayscale base, route styling (deviation coloring), tier icons
- [ADR 012: Details Panel Mini-Map](../ADR/012-details-panel-mini-map.md) - Original mini-map design (superseded by ADR 022)
- [ADR 022: Scrollable Mini-Map with Maximize](../ADR/022-scrollable-minimap-with-maximize.md) - Scrollable mini-map with maximize modal, walk toggles, legend

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

## New Components (Subarea Visual Context)

| Component | Location | Purpose |
|-----------|----------|---------|
| AreaMiniMap | `src/components/AreaMiniMap/` | Interactive mini-map in details panel for route planning (ADR 012) |

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

### Subarea Visual Context (Implemented - ADR 012, Updated: 2026-02-13)

Enhancements for spatial awareness and route planning:

1. **Mini-Map in Details Panel** (Updated: 2026-02-13)
   - Interactive React-Leaflet map inside AreaDetailsPanel (below header)
   - Full street-level base map (same tiles as main map)
   - Boundary polygon with prominent stroke (3px), low-opacity tier fill (0.2)
   - Pan and zoom enabled for route exploration; zoom controls hidden (gesture-only)
   - Auto-fits to polygon bounds on initial load with padding
   - **Dynamic height via flex-grow:** Mini-map fills available viewport space above the fold
   - **Minimum height:** 200px ensures usability even in collapsed panel state
   - **Layout structure:** Mini-map is **outside** the scrollable content area, using CSS flex-grow
   - **Purpose:** Optimized for boundary inspection - maximize map visibility
   - Panel content below the stats section scrolls within the panel

2. **Circumference in Hover Tooltip**
   - Shows distance with estimated walk time (e.g., "2.3 km (~28 min)")
   - Walk time calculated at 5 km/h (12 min/km) via shared `formatCircumferenceWithTime()`
   - Displayed for all areas (completed and not started)

3. **Area Stats in Details Panel** (Added: 2026-02-13)
   - **Location:** Fixed section between mini-map and scrollable content
   - **Content:** Circumference with estimated walk time (e.g., "2.3 km (~28 min)")
   - **Rationale:** Users should see these quick-reference stats without closing the panel to hover
   - Uses `formatCircumferenceWithTime()` from `geo-utils.ts` for consistency with hover tooltip

**Panel Layout Structure:**
```
Panel Container (flex column)
├── Drag Handle (fixed height)
├── Breadcrumbs (optional)
├── Header (fixed height)
└── Scrollable Content (overflow-y: auto)
    ├── Mini-Map Section (fixed ~180-200px, with maximize button)
    ├── Area Stats
    ├── Score Breakdown
    ├── Area Information
    ├── Walk History
    └── Deviations
```

**Maximized Map Modal:** (NEW - ADR 022)
- Opens via maximize button on compact mini-map
- ~90% viewport coverage (modal-style)
- Contains: full-size map, per-walk route toggles, distance tier legend
- Dismissed via X button in corner

**Key Implementation Files:**

| File | Purpose |
|------|---------|
| `src/lib/geo-utils.ts` | Shared perimeter calculation and walk time formatting (single source of truth) |
| `src/components/AreaMiniMap/AreaMiniMap.tsx` | Compact scrollable mini-map with maximize button |
| `src/components/AreaMiniMap/index.tsx` | Dynamic import wrapper (SSR) |
| `src/components/AreaDetailsPanel/AreaDetailsPanel.tsx` | Panel with scrollable content |
| `src/components/MaximizedMapModal/MaximizedMapModal.tsx` | NEW: Full-size map modal with walk toggles and legend |

**Refactoring Note:** Perimeter calculation was previously duplicated in Map.tsx and db.ts. Both now use `calculatePerimeterMeters()` from `geo-utils.ts` to ensure a single source of truth.

**Reference:** [ADR 022](../ADR/022-scrollable-minimap-with-maximize.md) (supersedes ADR 012) | [Ticket 027](../tickets/027-scrollable-minimap-maximize.md)

### Walk Route Visualization (Implemented - ADR 010)

Route visualization with deviation-based coloring to show walk quality at a glance:

1. **Toggle Control in Hamburger Menu**
   - Routes hidden by default to reduce visual clutter
   - Toggle switch in hamburger menu dropdown: "Show Routes"
   - State managed at page level, passed to Map component

2. **Deviation-Based Segment Coloring**
   - Green (`#22c55e`): Segment midpoint within 25m of assigned area boundary
   - Red (`#ef4444`): Segment midpoint beyond 25m of assigned area boundary
   - Gray (`#94a3b8`): Activity not assigned to any area (unmatched)
   - 25m threshold matches perimeter coverage buffer (ADR 002/003)

3. **Stream Data for Full Paths**
   - Prefers cached stream data from IndexedDB when available
   - Falls back to `summary_polyline` if streams not cached
   - Stream data provides full path without privacy zone truncation (ADR 006)

4. **Z-Order: Routes Above Area Fills**
   - Routes render after GeoJSON layer (area polygons)
   - Routes render before TierIcon markers
   - Ensures routes are visible on top of completed (colored) areas

**Key Implementation Files:**

| File | Purpose |
|------|---------|
| `src/lib/route-visualization.ts` | Deviation calculation, segment coloring, route data preparation |
| `src/lib/design-tokens.ts` | Route deviation colors and segment styling constants |
| `src/components/HamburgerMenu/HamburgerMenu.tsx` | Toggle control for route visibility |
| `src/components/Map/Map.tsx` | Route rendering with deviation-colored Polylines |
| `src/app/page.tsx` | `showRoutes` state management |

**Performance Considerations:**
- Route visualization data calculated on-demand when toggle is enabled
- Consecutive same-color segments grouped to reduce Polyline element count
- Stream data cached in IndexedDB (no additional API calls for visualization)

**Reference:** [ADR 010](../ADR/010-map-visual-design-system.md) Section 3 | [Ticket 007](../tickets/007-walk-route-visualization.md)

### Mini-Map Walk Route Visualization (Updated: 2026-02-18)

Extension of route visualization to the **Maximized Map Modal**, enabling users to view matched walk routes in full detail:

> **Note:** ADR 022 changed mini-map behavior. Walk routes are now displayed in the Maximized Map Modal (not the compact scrollable mini-map). This provides better space for route visualization and comparison.

1. **Access via Maximize Button**
   - User taps maximize button on compact mini-map
   - Opens Maximized Map Modal (~90% viewport)
   - Walk route controls are in the modal, not the panel

2. **Per-Walk Toggle Controls (Multi-Select)**
   - Each walk has its own toggle in the modal control panel
   - Users can show/hide each walk independently
   - Can display multiple walks simultaneously for comparison
   - Default state: All toggles OFF (routes hidden)

3. **Distance Tier Coloring (ADR 021)**
   - Walk segments colored by distance from boundary (not deviation-based)
   - Uses tier colors from `design-tokens.ts`:
     - Platinum (0-10m): Deep Green
     - Gold (10-20m): Light Green
     - Silver (20-30m): Yellow
     - Bronze (30-40m): Orange
     - Potato (40-50m): Light Red
     - Missed (>50m): Red

4. **Distance Tier Legend**
   - Displayed in modal (collapsible section or overlay)
   - Explains what each segment color means
   - Helps users understand their walk quality

5. **Route Rendering**
   - Reuses `prepareDeviationColoredRoute()` from `route-visualization.ts` (updated for tier colors)
   - Routes render above area boundary polygon
   - Uses cached stream data from database (no additional API calls)

**Key Implementation Files:**

| File | Purpose |
|------|---------|
| `src/components/MaximizedMapModal/MaximizedMapModal.tsx` | NEW: Modal with full-size map, walk toggles, legend |
| `src/components/AreaMiniMap/AreaMiniMap.tsx` | Compact map with maximize button (no routes) |
| `src/components/AreaDetailsPanel/AreaDetailsPanel.tsx` | Opens modal on maximize button click |
| `src/lib/route-visualization.ts` | Route preparation utilities |
| `src/lib/design-tokens.ts` | Distance tier colors for legend |
| `src/lib/db.ts` | Retrieve walk stream data for selected walk ID |

**Design Rationale:**
- Modal provides ample space for route visualization and controls
- Multi-select toggles enable walk comparison (new capability)
- Legend educates users about distance tier system
- Compact mini-map scrolls with content, doesn't block panel details

**Reference:** [ADR 022](../ADR/022-scrollable-minimap-with-maximize.md) | [PRD 001](../PRD/001-mvp-mobile-walker.md) Section 3.5 | [Ticket 027](../tickets/027-scrollable-minimap-maximize.md)

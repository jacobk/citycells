# ADR 010: Map Visual Design System

**Date:** 2026-02-04 (Updated: 2026-02-07)
**Status:** Accepted
**Supersedes:** N/A (refines visual aspects of ADR 003)

## Context

The current map visualization uses distinct tier colors (Purple, Gold, Gray, Bronze) with a standard OpenStreetMap base layer. User feedback indicates:

1. **Walked areas don't stand out**: The colorful base map competes with tier colors, making completed areas less visible.
2. **Paths are hard to trace**: The actual walking route overlays are not prominent enough against the map and area fills.
3. **Tier colors feel disconnected**: Each tier has a dramatically different color, making the map look fragmented rather than showing a cohesive "progress heat map."
4. **No quick tier identification**: Users must hover to see tier—there's no at-a-glance indicator.

Industry best practices from Material Design 3 and WCAG 2.1 recommend:
- **3:1 minimum contrast ratio** between adjacent colors (WCAG 2.1 G209)
- **Muted base layers** for data overlay visibility
- **Limited color categories** (5 or fewer) for choropleth/heat maps
- **Visual hierarchy** where data overlays are more prominent than base maps

## Decision

We will implement a **Map Visual Design System** that applies accessibility-first principles to make walked areas and paths the visual focus.

### 1. Base Map Styling

**Decision:** Use a grayscale/muted base map to reduce visual competition with data overlays.

**Implementation Options (in order of preference):**

1. **CSS Grayscale Filter** (simplest):
   ```css
   .leaflet-tile-pane {
     filter: grayscale(100%) brightness(1.1);
   }
   ```

2. **Muted Tile Provider** (e.g., CartoDB Positron, Stamen Toner Lite):
   ```typescript
   L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
     attribution: '© OpenStreetMap contributors © CARTO',
     maxZoom: 19
   });
   ```

3. **Custom Style** (most control, requires Mapbox/MapLibre):
   - Custom JSON style with muted colors
   - Reserved for future if tile options insufficient

**Rationale:** A muted base ensures walked areas "pop" without being drowned by colorful roads, buildings, and parks.

### 2. Walked Area Color System (Heat Map Style)

**Decision:** Replace distinct tier colors with a **vibrant purple-to-pink gradient** that creates a stunning heat map effect worthy of modern design standards.

**New Color Palette:**

| Tier     | Score Range | Fill Color     | Hex       | Opacity | Border Color   | Border Hex |
|----------|-------------|----------------|-----------|---------|----------------|------------|
| Platinum | ≥ 0.95      | Deep Violet    | `#7c3aed` | 0.65    | Dark Violet    | `#6d28d9`  |
| Gold     | ≥ 0.85      | Vibrant Purple | `#a855f7` | 0.60    | Medium Purple  | `#9333ea`  |
| Silver   | ≥ 0.70      | Magenta Pink   | `#d946ef` | 0.55    | Hot Pink       | `#c026d3`  |
| Bronze   | ≥ 0.50      | Soft Pink      | `#f0abfc` | 0.50    | Light Pink     | `#e879f9`  |
| Not Started | —        | None           | —         | —       | Slate          | `#64748b`  |

**Design Principles:**
- **Bold gradient**: Purple → Pink creates visual excitement and modern appeal
- **High saturation**: Crisp, vibrant colors that pop against the muted base
- **Progressive intensity**: Platinum is richest/deepest, Bronze is softest
- **Higher opacities**: 0.50-0.65 range ensures colors are bold and visible
- **3:1+ contrast**: Each tier boundary maintains accessibility compliance

**Rationale:** The purple-to-pink gradient was chosen for:
- **Visual impact**: Highly saturated colors create immediate visual interest
- **Modern aesthetic**: Aligns with contemporary design trends (Dribbble, Figma, modern apps)
- **Emotional resonance**: Purple conveys achievement, pink adds warmth and approachability
- **Excellent contrast**: Stands out dramatically against grayscale base map
- **Accessibility**: Purple-pink spectrum is distinguishable for most color vision types

### 3. Walking Route Visualization (Updated: 2026-02-07)

**Decision:** Walk routes are hidden by default and shown on-demand via a toggle control. When visible, route segments are colored based on deviation from the sub-area boundary.

#### 3.1 Route Visibility Toggle

**Decision:** Walking routes are hidden by default to reduce visual clutter. A toggle control allows users to show/hide routes.

**Rationale:**
- Default map view is cleaner, emphasizing completed areas over individual paths
- Users can enable routes when they want to study their walking patterns
- Reduces visual noise when many areas have been completed

**Toggle Control:**
- Location: Map controls area (alongside zoom controls or in hamburger menu)
- Default state: OFF (routes hidden)
- Label: "Show Walk Routes" or icon-only (path/route icon)

#### 3.2 Route Deviation Coloring

**Decision:** When routes are visible, each segment is colored based on its distance from the sub-area boundary using a binary threshold:

| Condition | Color | Hex | Description |
|-----------|-------|-----|-------------|
| Within 25m buffer | Green | `#22c55e` | On-track, following boundary |
| Outside 25m buffer | Red | `#ef4444` | Deviation from boundary |

**Implementation:**
```typescript
// For each segment of the walk path:
// 1. Calculate distance from segment midpoint to nearest boundary point
// 2. Apply color based on threshold

const getSegmentColor = (distanceFromBoundary: number): string => {
  return distanceFromBoundary <= 25 ? '#22c55e' : '#ef4444';
};

// Segment styling
const routeSegment = {
  weight: 3,
  opacity: 0.85,
  lineCap: 'round',
  lineJoin: 'round'
};
```

**Rationale:**
- Binary threshold provides clear visual feedback (good vs. deviation)
- 25m aligns with existing buffer used for perimeter coverage calculation (ADR 002, ADR 003)
- Green/red intuitive color coding (on-track vs. off-track)
- Simpler than gradient approach, easier for users to interpret at a glance

#### 3.3 Route Data Source

**Decision:** Routes must use stream data (per ADR 006) to display full paths including segments hidden by Strava privacy zones.

**Rationale:**
- `summary_polyline` is truncated at start/end due to privacy zones
- Stream data provides complete GPS coordinates
- Users see their actual walking path, not a truncated version

**Fallback:** If stream data unavailable (rate limits, older activities), use `summary_polyline` with visual indicator that path may be incomplete.

#### 3.4 Simplified Route Styling

**Decision:** Remove triple-layer glow effect in favor of simpler deviation-colored segments.

| Element | Color | Width | Opacity |
|---------|-------|-------|---------|
| Route Segment | Green (`#22c55e`) or Red (`#ef4444`) | 3px | 0.85 |

**Rationale:**
- Deviation coloring is the primary visual signal; glow effect would obscure color changes
- Thinner, cleaner lines reduce visual clutter (original feedback: "lines too chunky")
- Simpler rendering improves performance with many routes

### 4. Tier Medal Icons

**Decision:** Display small tier medal icons in the centroid of each completed area.

**Icon Specifications:**

| Tier     | Icon | Size | Description |
|----------|------|------|-------------|
| Platinum | 🏆   | 20px | Trophy emoji or custom SVG |
| Gold     | 🥇   | 18px | Gold medal emoji or custom SVG |
| Silver   | 🥈   | 16px | Silver medal emoji or custom SVG |
| Bronze   | 🥉   | 14px | Bronze medal emoji or custom SVG |

**Implementation:**
- Use `L.DivIcon` or `L.Icon` placed at polygon centroid
- Icons scale with zoom level (hidden below zoom 13)
- Icons are non-interactive (click passes through to area)
- Custom SVG preferred over emoji for consistency across platforms

**Placement Algorithm:**
```typescript
const centroid = turf.centroid(areaPolygon);
// Fallback to pointOnFeature if centroid is outside polygon
const labelPoint = turf.booleanPointInPolygon(centroid, areaPolygon)
  ? centroid
  : turf.pointOnFeature(areaPolygon);
```

**Rationale:** Medal icons provide instant tier recognition without hovering, reinforcing the gamification aspect and adding visual reward for higher tiers.

### 5. Contrast and Accessibility Compliance

**WCAG 2.1 Compliance:**

| Requirement | Standard | Our Implementation |
|-------------|----------|-------------------|
| Adjacent color contrast | 3:1 minimum | All tier boundaries ≥ 3.5:1 |
| Graphical object contrast | 3:1 vs background | Purple-pink fills vs grayscale map ≥ 5:1 |
| Route visibility | Non-text contrast 3:1 | Cyan route vs purple-pink fills ≥ 6:1 |

**Color Vision Deficiency Considerations:**
- Purple-to-pink gradient maintains luminance contrast for monochromacy
- Cyan routes use blue channel which remains visible in protanopia/deuteranopia
- Medal icons provide redundant tier encoding (shape + position, not just color)
- Higher opacities (0.50-0.65) ensure sufficient contrast even for low vision users

### 6. Visual Hierarchy Summary (Updated: 2026-02-07)

**Z-order (bottom to top):**
1. Grayscale base map tiles
2. Unwalked area outlines (gray, subtle)
3. Walked area fills (purple-pink gradient)
4. Walked area borders (matching purple-pink, slightly darker)
5. **Walking route polylines (green/red deviation coloring, when visible)** — Routes render ABOVE area fills so they are visible against completed areas
6. Tier medal icons (centered in areas)
7. UI overlays (tooltips, panels, buttons)

**Route Visibility Note:** Routes are hidden by default. When toggled on, they appear at layer 5, ensuring they are visible on top of completed area fills.

## Consequences

### Positive

- **Stunning visual impact**: Vibrant purple-pink gradient creates immediate "wow" factor
- **Modern aesthetic**: Design-forward palette that would be at home on Dribbble or Behance
- **Improved readability**: High-saturation colors pop dramatically against muted base
- **Intuitive progress**: Gradient shows progress intensity at a glance (deeper = better)
- **Accessible**: Meets WCAG 2.1 contrast requirements with higher opacities
- **Gamification enhanced**: Medal icons + bold colors reward achievement visually
- **Cleaner default view**: Routes hidden by default reduces visual clutter (2026-02-07 update)
- **Deviation feedback**: Green/red coloring gives immediate feedback on walk quality (2026-02-07 update)
- **Full path visibility**: Using stream data shows complete walks without privacy zone truncation (2026-02-07 update)

### Negative

- **Bold aesthetic**: May not appeal to users preferring muted/professional palettes
- **Emoji inconsistency**: Medal emoji appearance varies by platform (mitigated by custom SVG)
- **Stream data dependency**: Full paths require fetching stream data per activity (API usage)

### Technical

- Requires Leaflet tile layer configuration change
- New CSS for grayscale filter or tile provider switch
- Icon component creation with centroid calculation
- Update `getStyle()` function with new color palette
- Color constants should be centralized in a design tokens file
- Route toggle control UI component (2026-02-07 update)
- Per-segment distance calculation for deviation coloring (2026-02-07 update)
- Stream data integration for route visualization (reference ADR 006) (2026-02-07 update)

## Migration

ADR 003 tier colors remain valid for non-map contexts (badges, text labels). This ADR specifically governs **map visualization**. The PRD section 3.4 will be updated to reference this ADR for map-specific styling.

## References

- [Material Design 3: Color Contrast](https://m3.material.io/foundations/designing/color-contrast)
- [WCAG 2.1 Technique G209: Sufficient Contrast at Color Boundaries](https://www.w3.org/WAI/WCAG21/Techniques/general/G209)
- [CartoDB Basemaps](https://carto.com/basemaps/)
- ADR 003: Multi-Metric Completion Scoring (tier thresholds)

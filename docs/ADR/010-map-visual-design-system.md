# ADR 010: Map Visual Design System

**Date:** 2026-02-04
**Status:** Proposed
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

### 3. Walking Route Visualization

**Decision:** Walked routes must have significantly higher contrast than area fills using a complementary color.

**Route Styling:**

| Element | Color | Hex | Width | Opacity |
|---------|-------|-----|-------|---------|
| Walk Path | Electric Cyan | `#06b6d4` | 3px | 0.90 |
| Walk Path Outline | Deep Teal | `#0f766e` | 5px | 0.6 |
| Walk Path Glow | Cyan Glow | `#22d3ee` | 7px | 0.3 |

**Implementation:**
```typescript
// Glow layer (bottom)
const routeGlow = {
  color: '#22d3ee',
  weight: 7,
  opacity: 0.3,
  lineCap: 'round',
  lineJoin: 'round'
};

// Outline layer (middle)
const routeOutline = {
  color: '#0f766e',
  weight: 5,
  opacity: 0.6,
  lineCap: 'round',
  lineJoin: 'round'
};

// Core layer (top)
const routeCore = {
  color: '#06b6d4',
  weight: 3,
  opacity: 0.90,
  lineCap: 'round',
  lineJoin: 'round'
};
```

**Rationale:** Electric cyan provides striking contrast against the purple-pink fills (complementary on the color wheel). The triple-layer technique (glow + outline + core) creates a premium, modern look that makes routes visually "pop" while maintaining readability.

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

### 6. Visual Hierarchy Summary

**Z-order (bottom to top):**
1. Grayscale base map tiles
2. Unwalked area outlines (gray, subtle)
3. Walked area fills (teal gradient)
4. Walked area borders (matching teal, slightly darker)
5. Walking route polylines (orange-red, high contrast)
6. Tier medal icons (centered in areas)
7. UI overlays (tooltips, panels, buttons)

## Consequences

### Positive

- **Stunning visual impact**: Vibrant purple-pink gradient creates immediate "wow" factor
- **Modern aesthetic**: Design-forward palette that would be at home on Dribbble or Behance
- **Improved readability**: High-saturation colors pop dramatically against muted base
- **Intuitive progress**: Gradient shows progress intensity at a glance (deeper = better)
- **Accessible**: Meets WCAG 2.1 contrast requirements with higher opacities
- **Gamification enhanced**: Medal icons + bold colors reward achievement visually
- **Premium feel**: Triple-layer route glow creates polished, app-store-ready appearance

### Negative

- **Bold aesthetic**: May not appeal to users preferring muted/professional palettes
- **Emoji inconsistency**: Medal emoji appearance varies by platform (mitigated by custom SVG)
- **Performance**: Additional glow layer on routes may impact rendering on older devices

### Technical

- Requires Leaflet tile layer configuration change
- New CSS for grayscale filter or tile provider switch
- Icon component creation with centroid calculation
- Update `getStyle()` function with new color palette
- Color constants should be centralized in a design tokens file

## Migration

ADR 003 tier colors remain valid for non-map contexts (badges, text labels). This ADR specifically governs **map visualization**. The PRD section 3.4 will be updated to reference this ADR for map-specific styling.

## References

- [Material Design 3: Color Contrast](https://m3.material.io/foundations/designing/color-contrast)
- [WCAG 2.1 Technique G209: Sufficient Contrast at Color Boundaries](https://www.w3.org/WAI/WCAG21/Techniques/general/G209)
- [CartoDB Basemaps](https://carto.com/basemaps/)
- ADR 003: Multi-Metric Completion Scoring (tier thresholds)

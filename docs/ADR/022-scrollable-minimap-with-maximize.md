# ADR 022: Scrollable Mini-Map with Maximize View

**Date:** 2026-02-18
**Status:** Accepted (Implemented)
**Supersedes:** ADR 012 (Details Panel Mini-Map)

## Context

ADR 012 introduced a mini-map in the Area Details Panel with **dynamic height that fills available viewport space**. The intent was to maximize map visibility for boundary inspection and route planning.

**Current implementation issues:**

- The mini-map is fixed in position and cannot be scrolled away
- Users only have a small "window" to scroll content below the map
- The fixed map dominates the panel, making it difficult to access other details (score breakdown, walk history, area stats)
- On smaller screens, users cannot see full content without the map consuming most of the viewport

**User feedback:**
- Users want to access panel content without the map blocking the view
- The large fixed map is useful for route planning, but not always needed
- Users want the option to see the map in detail when needed, not always

**Requirements:**
- Allow users to scroll the mini-map away with other content
- Provide a way to view the map in full detail when desired
- Include walk route visualization controls in the detailed view
- Show a legend explaining distance tier colors

## Decision

We will change the mini-map from a **fixed viewport-filling element** to a **scrollable content element with a maximize option**.

### Mini-Map in Scrollable Content

**New Behavior:**
- Mini-map positioned at **top of panel content** (below header)
- Mini-map has a **fixed compact height** (~180-200px) instead of dynamic height
- Mini-map **scrolls with the rest of the content** - user can scroll it out of view
- All panel content (mini-map, stats, score breakdown, walk history) is in a single scrollable area

**Rationale:** This returns control to the user. They can scroll to see whatever content they need without the map permanently consuming viewport space.

### Maximize Button & Modal View

**Maximize Button:**
- Small "expand" icon button in the corner of the mini-map
- Tapping opens the **Maximized Map Modal**

**Maximized Map Modal:**
| Property | Value |
|----------|-------|
| Coverage | ~90% viewport (modal-style with small margin) |
| Dismiss | X button in top-right corner |
| Background | Semi-transparent backdrop |

**Modal Contents:**

1. **Full-size interactive map**
   - Same base map tiles as main map
   - Sub-area boundary polygon with tier-colored fill
   - Pan and zoom enabled
   - Auto-fit bounds on open

2. **Walk Route Toggles (per-walk multi-select)**
   - When multiple walks exist, each walk has its own toggle
   - Users can show/hide each walk independently
   - Can display multiple walks simultaneously for comparison
   - Toggle controls positioned in a collapsible control panel

3. **Distance Tier Legend**
   - Explains the meaning of walk segment colors
   - Colors based on ADR 021 (Tiered Distance Scoring):

   | Tier | Color | Distance from Boundary |
   |------|-------|----------------------|
   | Platinum | Deep Green | 0-10m |
   | Gold | Light Green | 10-20m |
   | Silver | Yellow | 20-30m |
   | Bronze | Orange | 30-40m |
   | Potato | Light Red | 40-50m |
   | Missed | Red | >50m |

   - Legend shown in a collapsible section or overlay on the map

### Interaction Flow

```
User opens Area Details Panel
  ↓
Panel shows: header → compact mini-map (with maximize button) → stats → score → walks
  ↓
User scrolls → mini-map scrolls out of view, user sees full content
  ↓
User taps maximize button
  ↓
Modal opens: large map + walk toggles + legend
  ↓
User toggles walks on/off, explores map
  ↓
User taps X button → modal closes, returns to panel
```

### Breaking Change

This is a **breaking change** from the ADR 012 behavior:
- Users accustomed to the large fixed map will see a smaller scrollable map
- The full-size map is now opt-in via the maximize button

**Migration:** No data migration needed. UI behavior changes immediately.

## Consequences

### Positive

- **Better content accessibility**: Users can scroll to see all panel content without the map blocking
- **User control**: Map detail available on-demand via maximize, not forced always-on
- **Multi-walk comparison**: Toggle per walk allows comparing different walk routes
- **Educational**: Legend helps users understand the distance tier color system
- **Improved mobile UX**: More usable on smaller screens

### Negative

- **Extra tap for large map**: Users who always want the large map need an extra interaction
- **Breaking change**: Users familiar with current behavior need to adjust
- **Modal complexity**: New modal component with multiple controls to implement

### Technical

- **New component**: `MaximizedMapModal` or similar for the modal view
- **State management**: Modal open/close state, per-walk toggle states
- **Component refactoring**: `AreaDetailsPanel` layout changes from fixed-map to scrollable
- **Legend component**: New reusable legend component for distance tiers
- **Reuse opportunity**: Legend and walk toggles could be reused elsewhere (main map controls)

### Maintainability

- **Modularity improved**: Extracting maximized view to modal creates cleaner separation
- **DRY opportunity**: Distance tier colors/definitions should come from a single source (`design-tokens.ts`)
- **Testing**: Modal interactions and walk toggle state need testing
- **Component reuse**: Legend and toggle controls are reusable patterns

## Related Decisions

- [ADR 012: Details Panel Mini-Map](./012-details-panel-mini-map.md) - **Superseded** by this ADR
- [ADR 015: Expandable Bottom Panel](./015-expandable-bottom-panel.md) - Panel expand states (separate concern from mini-map behavior)
- [ADR 021: Tiered Distance Scoring](./021-tiered-distance-scoring.md) - Distance tier colors for legend
- [ADR 010: Map Visual Design System](./010-map-visual-design-system.md) - Design tokens for colors

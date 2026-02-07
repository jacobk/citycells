# ADR 015: Expandable Bottom Panel with Multi-State Slide Behavior

**Date:** 2026-02-07
**Status:** Proposed

## Context

The Area Details Panel (bottom sheet) currently has two states: closed (hidden) and open (fixed at ~85vh max height). On mobile devices, users often need to:
- View more content by expanding the panel to nearly full-screen
- Quickly collapse it to see more of the map
- Explore the mini-map in detail without the panel taking up too much space

**Current limitations:**
- Panel height is fixed at `max-h-[85vh]` when open
- No intermediate state between closed and fully open
- Drag handle only closes the panel (doesn't toggle between states)
- Mini-map is constrained to ~200px height, limiting exploration
- Desktop users must click the close button; drag handle doesn't toggle

**Requirements:**
- Support multiple panel heights (collapsed, expanded, full-screen)
- Touch-friendly slide gestures for mobile
- Click-to-toggle drag handle for desktop/non-touch devices
- Optimize mini-map for expanded panel state
- Smooth animations between states
- Maintain existing close behavior

## Decision

We will implement a **multi-state expandable bottom panel** with the following states and behaviors:

### Panel States

| State | Height | Use Case | Trigger |
|-------|--------|----------|---------|
| Closed | 0 (hidden) | Viewing map only | Close button, drag down past threshold |
| Collapsed | ~40vh | Quick info view, see more map | Drag handle click (desktop), slide down from expanded |
| Expanded | ~85vh (current) | Default detailed view | Panel open, slide up from collapsed |
| Full-screen | ~95vh | Maximum content viewing | Slide up from expanded, drag handle click when expanded |

**Height Specifications:**
- **Collapsed**: 40vh (minimum to show header + mini-map preview)
- **Expanded**: 85vh (current default, shows full content with scrolling)
- **Full-screen**: 95vh (almost full viewport, minimal top margin for status bar)

### Interaction Patterns

#### Touch Devices (Mobile)

1. **Slide Up Gesture:**
   - From closed → Opens to expanded state
   - From collapsed → Transitions to expanded
   - From expanded → Transitions to full-screen
   - Drag handle area is draggable; release determines final state

2. **Slide Down Gesture:**
   - From full-screen → Transitions to expanded
   - From expanded → Transitions to collapsed
   - From collapsed → Closes panel
   - Velocity-based: fast swipe down closes regardless of position

3. **Drag Handle:**
   - Visual indicator (horizontal bar) at top of panel
   - Draggable area extends ~48px vertically for touch target
   - Shows visual feedback during drag (opacity change, cursor change)

#### Non-Touch Devices (Desktop)

1. **Click Drag Handle:**
   - Single click toggles between collapsed ↔ expanded ↔ full-screen
   - Cycle order: collapsed → expanded → full-screen → collapsed
   - Close button still closes panel completely

2. **Mouse Drag:**
   - Optional: allow mouse drag for manual height adjustment
   - Release determines nearest state (snap to state)

### Mini-Map Optimization

The `AreaMiniMap` component will adapt its height based on panel state:

| Panel State | Mini-Map Height | Rationale |
|-------------|-----------------|-----------|
| Collapsed | ~150px | Compact preview, still functional |
| Expanded | ~200px | Current default, good for exploration |
| Full-screen | ~400px | Maximum detail for route planning |

**Implementation:**
- Pass panel state to `AreaMiniMap` via props
- Use CSS transitions for smooth height changes
- Ensure map instance resizes correctly (Leaflet `invalidateSize()`)

### State Management

```typescript
type PanelState = 'closed' | 'collapsed' | 'expanded' | 'fullscreen';

interface PanelStateConfig {
  state: PanelState;
  height: string; // CSS value (e.g., '40vh', '85vh', '95vh')
  miniMapHeight: number; // pixels
}
```

**State Transitions:**
- Closed → Expanded (default open)
- Expanded ↔ Collapsed (toggle)
- Expanded ↔ Full-screen (toggle)
- Any state → Closed (close button or drag down past threshold)

### Visual Feedback

1. **Drag Handle:**
   - Active state: Slightly darker color, cursor changes to `grab` → `grabbing`
   - Hover state (desktop): Subtle scale or color change
   - During drag: Opacity reduction to 0.7

2. **Panel Animation:**
   - Smooth CSS transitions: `transition-transform duration-300 ease-out`
   - Height changes animate smoothly
   - Backdrop opacity adjusts with panel state

3. **State Indicators:**
   - Optional: Visual indicator showing current state (e.g., dots on drag handle)
   - Not required for MVP; state is clear from panel height

## Consequences

### Positive

- **Better mobile UX**: Users can expand panel to see more content without scrolling
- **Improved map visibility**: Collapsed state shows more map while keeping panel accessible
- **Enhanced mini-map exploration**: Full-screen state provides ample space for route planning
- **Desktop-friendly**: Click-to-toggle provides quick state changes without drag
- **Flexible content viewing**: Users choose optimal viewing mode for their task

### Negative

- **Increased complexity**: More states to manage and test
- **Touch gesture handling**: Requires careful implementation to avoid conflicts with scrolling
- **State persistence**: May want to remember user preference (future enhancement)
- **Animation performance**: Multiple transitions need to be smooth on lower-end devices

### Technical

- **Component refactoring**: `AreaDetailsPanel` needs state management for panel height
- **Gesture library consideration**: May need `react-use-gesture` or similar for robust touch handling
- **Mini-map resize**: Must call Leaflet `invalidateSize()` when height changes
- **Z-index management**: Ensure full-screen state doesn't conflict with other overlays
- **Accessibility**: Keyboard navigation and screen reader support for state changes

### Maintainability

- **Modular state logic**: Extract panel state management to a custom hook (`useExpandablePanel`)
- **Reusable pattern**: Same pattern can be applied to `SubAreaListPanel` if needed
- **DRY opportunity**: Consolidate panel styling and animation logic
- **Testing**: Unit tests for state transitions; integration tests for gesture handling
- **Documentation**: Clear component API for panel state props

## Related Decisions

- [ADR 009: UI Navigation Layout](./009-ui-navigation-layout.md) - Panel positioning and z-index hierarchy
- [ADR 012: Details Panel Mini-Map](./012-details-panel-mini-map.md) - Mini-map component that will adapt to panel states
- [ADR 008: Panel Navigation Architecture](./008-panel-navigation-architecture.md) - Original panel design (superseded by ADR 009)

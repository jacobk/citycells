# Expandable Bottom Panel

## Overview

The Expandable Bottom Panel feature enhances the Area Details Panel (and potentially SubAreaListPanel) with multi-state slide behavior optimized for vertical displays. Users can slide the panel up to cover almost the full viewport for detailed content viewing and mini-map exploration, or slide it down to a smaller size to see more of the map while keeping the panel accessible.

This feature addresses the mobile-first design requirement by providing flexible panel heights that adapt to user needs. On desktop/non-touch devices, users can click the drag handle to toggle between states without requiring drag gestures.

## User Stories

From [PRD 001](../PRD/001-mvp-mobile-walker.md):
- "**As a mobile user,** I want to slide the bottom panel up to cover almost the full screen, so I can see more content and explore the mini-map in detail without scrolling."
- "**As a mobile user,** I want to slide the bottom panel down to a smaller size, so I can see more of the map while still keeping the panel accessible."
- "**As a desktop user,** I want to click the drag handle to toggle between panel sizes, so I can quickly adjust the view without dragging."
- "**As a user,** I want the mini-map to adapt its size based on the panel state, so I have optimal space for route planning when the panel is expanded."

## Implementation

> **Note:** This section is completed by the implementation agent.

### Key Files

| File | Purpose |
|------|---------|
| `src/components/AreaDetailsPanel/AreaDetailsPanel.tsx` | Main panel component - add state management and gesture handling |
| `src/components/AreaMiniMap/AreaMiniMap.tsx` | Mini-map component - adapt height based on panel state |
| `src/hooks/useExpandablePanel.ts` | Custom hook for panel state management and gesture logic (NEW) |
| `src/lib/panel-state.ts` | Type definitions and state configuration constants (NEW) |

### Data Flow

```
User Interaction (slide/click)
  ↓
useExpandablePanel hook
  ↓
Panel state update (collapsed/expanded/fullscreen)
  ↓
AreaDetailsPanel re-renders with new height
  ↓
AreaMiniMap receives panel state prop
  ↓
Mini-map height updates + Leaflet invalidateSize()
```

### Key Functions

- `useExpandablePanel()` - Custom hook managing panel state, touch gestures, and click handlers
- `handleDragStart()` - Initialize drag gesture tracking
- `handleDragMove()` - Update panel position during drag
- `handleDragEnd()` - Determine final state based on position and velocity
- `togglePanelState()` - Cycle through states on drag handle click (desktop)
- `getPanelHeight()` - Calculate CSS height value from state
- `getMiniMapHeight()` - Calculate mini-map height from panel state

## Rationale

### Design Decisions

**Multi-state approach (4 states):**
- Provides granular control without overwhelming users
- Collapsed state (~40vh) balances content visibility with map access
- Full-screen state (~95vh) maximizes content viewing without completely hiding map context
- Smooth transitions between states create polished UX

**Touch vs. non-touch interaction patterns:**
- Touch devices benefit from drag gestures (natural mobile pattern)
- Desktop users prefer click-to-toggle (faster, no precision drag needed)
- Both patterns coexist without conflict

**Velocity-based closing:**
- Fast swipe down closes panel regardless of position (standard mobile pattern)
- Prevents accidental closes from slow drags
- Improves user experience by respecting user intent

**Mini-map height adaptation:**
- Collapsed: Compact preview maintains functionality
- Expanded: Default size balances content and map
- Full-screen: Maximum space enables detailed route planning
- Smooth height transitions prevent jarring map resizes

**State management hook:**
- Extracts complex gesture logic from component
- Reusable pattern for other panels (SubAreaListPanel)
- Easier to test and maintain
- Follows React best practices for custom hooks

### ADR References

- [ADR 015: Expandable Bottom Panel](../ADR/015-expandable-bottom-panel.md) - Multi-state panel design, interaction patterns, mini-map optimization
- [ADR 012: Details Panel Mini-Map](../ADR/012-details-panel-mini-map.md) - Mini-map component that adapts to panel states
- [ADR 009: UI Navigation Layout](../ADR/009-ui-navigation-layout.md) - Panel positioning and z-index hierarchy

## Current Limitations

1. **State persistence**: Panel state is not remembered across sessions (future enhancement)
2. **Gesture library**: May need to add `react-use-gesture` or similar for robust touch handling if native implementation is insufficient
3. **Keyboard navigation**: State changes via keyboard not yet implemented (accessibility enhancement)
4. **SubAreaListPanel**: Expandable behavior not yet applied to list panel (can be added later using same pattern)

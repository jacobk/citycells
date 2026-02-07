# TICKET-008: Expandable Bottom Panel with Multi-State Slide Behavior

**Related:** ADR 015, PRD Section 3.6  
**Feature:** [Expandable Bottom Panel](../features/expandable-bottom-panel.md)  
**Status:** Ready for Implementation  
**Created:** 2026-02-07

## Context to Load

Files the implementation agent MUST read first:

1. `docs/ADR/015-expandable-bottom-panel.md` - Multi-state panel design, interaction patterns, height specifications
2. `docs/PRD/001-mvp-mobile-walker.md` Section 3.6 - Area Details Panel specification with expandable behavior
3. `docs/features/expandable-bottom-panel.md` - Feature documentation with implementation placeholders
4. `src/components/AreaDetailsPanel/AreaDetailsPanel.tsx` - Current panel implementation to modify
5. `src/components/AreaMiniMap/AreaMiniMap.tsx` - Mini-map component that needs state-aware height
6. `docs/ADR/012-details-panel-mini-map.md` - Mini-map design context

## Implementation Checklist

### 1. Create Panel State Types and Configuration

- Create `src/lib/panel-state.ts` with:
  - `PanelState` type: `'closed' | 'collapsed' | 'expanded' | 'fullscreen'`
  - `PanelStateConfig` interface with height and mini-map height mappings
  - Constants for height values (`COLLAPSED_HEIGHT`, `EXPANDED_HEIGHT`, `FULLSCREEN_HEIGHT`)
  - Helper functions: `getPanelHeight(state)`, `getMiniMapHeight(state)`

### 2. Create useExpandablePanel Hook

- Create `src/hooks/useExpandablePanel.ts`:
  - Manage panel state with `useState<PanelState>`
  - Track drag state (isDragging, startY, currentY, velocity)
  - Implement `handleDragStart` for touch/mouse down
  - Implement `handleDragMove` to update position during drag
  - Implement `handleDragEnd` to determine final state based on:
    - Current position (snap to nearest state)
    - Velocity (fast swipe down closes regardless)
    - Threshold values for state transitions
  - Implement `togglePanelState` for click-to-toggle (desktop)
  - Return: `{ state, height, miniMapHeight, handlers, toggleState }`

### 3. Update AreaDetailsPanel Component

- Modify `src/components/AreaDetailsPanel/AreaDetailsPanel.tsx`:
  - Import and use `useExpandablePanel` hook
  - Replace fixed `max-h-[85vh]` with dynamic height from hook
  - Add drag handle event handlers (onMouseDown, onTouchStart)
  - Update drag handle styling for active/hover states
  - Add smooth CSS transitions for height changes
  - Pass panel state to `AreaMiniMap` component
  - Ensure close button still closes panel completely
  - Handle backdrop click to close (existing behavior)

### 4. Update AreaMiniMap Component

- Modify `src/components/AreaMiniMap/AreaMiniMap.tsx`:
  - Add `panelState?: PanelState` prop
  - Calculate height dynamically based on panel state
  - Use CSS transitions for smooth height changes
  - Call `map.invalidateSize()` when height changes (use `useEffect` with panelState dependency)
  - Ensure map instance resizes correctly on state transitions

### 5. Touch Gesture Handling

- Implement touch gesture detection:
  - Track touch start position (`touchstart`)
  - Track touch move with `preventDefault()` to avoid scrolling conflicts
  - Calculate velocity from touch events
  - Handle touch end to determine final state
  - Ensure gestures don't conflict with panel content scrolling
  - Consider using `react-use-gesture` if native implementation is insufficient

### 6. Desktop Click-to-Toggle

- Implement click handler on drag handle:
  - Detect non-touch devices (check for `pointer: fine` or similar)
  - Cycle through states: collapsed → expanded → full-screen → collapsed
  - Skip 'closed' state in cycle (close button handles that)
  - Add visual feedback (hover state, active state)

### 7. Animation and Visual Feedback

- Add CSS transitions:
  - Panel height: `transition-height duration-300 ease-out`
  - Mini-map height: Smooth transition
  - Drag handle opacity during drag
  - Backdrop opacity based on panel state
- Ensure animations are performant (use `transform` where possible)

### 8. Testing and Edge Cases

- Test state transitions on mobile (touch)
- Test click-to-toggle on desktop
- Test fast swipe down closes panel
- Test panel content scrolling doesn't conflict with drag gestures
- Test mini-map resizing and Leaflet `invalidateSize()` calls
- Test panel behavior when switching between areas
- Verify z-index doesn't conflict with other overlays (ADR 009)

## Maintainability

Before implementing, review for:

- [ ] **Refactor opportunity?** Extract common panel logic that could be shared with `SubAreaListPanel` in the future
- [ ] **DRY check** - Panel styling and animation logic should be reusable
- [ ] **Modularity** - `useExpandablePanel` hook should be isolated and testable independently
- [ ] **Debt impact** - This adds complexity; ensure it's well-documented with `// WHY:` comments

**Specific refactoring tasks:**
- Consider creating a shared `PanelDragHandle` component if pattern is reused
- Panel height calculations could be extracted to utility functions
- Gesture detection logic should be modular for potential reuse

## Acceptance Criteria

- [ ] Panel has four states: closed, collapsed (~40vh), expanded (~85vh), full-screen (~95vh)
- [ ] Touch devices can slide panel up/down to transition between states
- [ ] Desktop users can click drag handle to cycle through states (collapsed → expanded → full-screen)
- [ ] Fast swipe down closes panel regardless of current state
- [ ] Mini-map height adapts to panel state (150px / 200px / 400px)
- [ ] Mini-map correctly resizes when panel state changes (Leaflet `invalidateSize()` called)
- [ ] Smooth animations between all state transitions
- [ ] Drag handle shows visual feedback during interaction
- [ ] Panel content scrolling doesn't conflict with drag gestures
- [ ] Close button still closes panel completely
- [ ] Backdrop click closes panel (existing behavior maintained)

## Files to Modify

| File | Change |
|------|--------|
| `src/components/AreaDetailsPanel/AreaDetailsPanel.tsx` | Add state management, gesture handlers, dynamic height |
| `src/components/AreaMiniMap/AreaMiniMap.tsx` | Add panelState prop, dynamic height, resize handling |
| NEW: `src/hooks/useExpandablePanel.ts` | Custom hook for panel state and gesture logic |
| NEW: `src/lib/panel-state.ts` | Type definitions and state configuration |

## Notes

- Do NOT duplicate ADR/PRD content - reference it
- Consider adding `react-use-gesture` dependency if native touch handling proves insufficient
- Panel state persistence (remembering user preference) is out of scope for MVP
- Keyboard navigation for state changes is a future enhancement
- SubAreaListPanel expandable behavior can be added later using the same pattern

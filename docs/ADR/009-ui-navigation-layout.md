# ADR 009: UI Navigation Layout with Collapsible Profile Card

**Date:** 2026-02-04
**Status:** Proposed
**Supersedes:** ADR 008

## Context

ADR 008 established the panel navigation architecture with a hamburger menu in the top-right corner and the profile/status card (athlete info, progress bar) in the top-left.

User feedback and UX review identified several issues with the current layout:

1. **Position expectations**: Users expect hamburger menus on the left (standard mobile convention)
2. **Profile card prominence**: The always-visible profile card takes up significant screen real estate, reducing map visibility
3. **No dismissibility**: Users cannot collapse the profile card when they want to focus on the map
4. **Conflicting interactions**: Both hamburger menu and profile card can be open simultaneously, creating visual clutter

**Requirements:**
- Hamburger menu should follow standard left-side placement convention
- Profile card should be collapsible to reduce visual clutter
- Only one overlay/menu should be open at a time
- Maintain quick access to athlete info and progress

## Decision

We will update the UI navigation layout with the following changes:

### 1. Swap Hamburger Menu and Profile Card Positions

**Before:**
- Profile card: Top-left (always expanded)
- Hamburger menu: Top-right

**After:**
- Hamburger menu: Top-left
- Profile card: Top-right (collapsible)

**Rationale:**
- Hamburger menus are conventionally placed on the left in mobile apps
- Profile/avatar placement in top-right matches common patterns (Twitter, GitHub, most apps)
- Users will find the layout more intuitive

### 2. Collapsible Profile Card

The profile card will have three states:

| State | Appearance | Trigger |
|-------|------------|---------|
| Collapsed (default) | Avatar image only (circular button) | Page load |
| Expanded | Full card with name, progress, logout | Tap on collapsed avatar |
| Collapsed | Avatar only | Tap outside, tap avatar again, or open hamburger |

**Design Specifications:**
- **Collapsed state**: 48x48px circular avatar button
- **Expanded state**: Same as current profile card design (athlete name, progress bar, logout)
- **Animation**: Smooth expand/collapse transition (200-300ms)
- **Position**: Top-right corner, same z-index as hamburger menu

### 3. Mutual Exclusivity

Only one menu/overlay can be open at a time:

| Action | Result |
|--------|--------|
| Open hamburger menu | Collapse profile card (if expanded) |
| Expand profile card | Close hamburger menu (if open) |
| Tap outside any overlay | Close all menus |

**State management:**
```typescript
type UIOverlayState = 
  | { type: 'none' }
  | { type: 'hamburger-menu' }
  | { type: 'profile-card' };
```

**Rationale:**
- Prevents visual clutter from multiple overlays
- Creates cleaner, focused user experience
- Simplifies mental model (one thing open at a time)

### 4. Z-Index Hierarchy

Maintain consistent layering:

| Element | Z-Index |
|---------|---------|
| Map | 0-100 |
| Hamburger menu button | 400 |
| Profile card (collapsed) | 400 |
| Hamburger menu dropdown | 450 |
| Profile card (expanded) | 450 |
| Bottom sheet panels | 500 |
| Modals | 600 |

## Consequences

### Positive

- More intuitive hamburger menu placement (left side)
- Reduced visual clutter with collapsible profile card
- Cleaner UI when user wants to focus on map
- Familiar pattern (avatar-based profile access)
- Prevents conflicting overlays

### Negative

- **Breaking change**: Users familiar with current layout need to adjust
- Profile info requires extra tap to view (collapsed by default)
- Slightly more complex state management (mutual exclusivity)

### Migration Notes

Users will notice:
1. Hamburger menu moved from right to left
2. Profile card is now just an avatar by default (tap to expand)
3. Cannot have both menus open simultaneously

No data migration required—this is a UI-only change.

### Technical

- Update `HamburgerMenu` component positioning (left instead of right)
- Create collapsible `ProfileCard` component (or refactor existing status card)
- Add `UIOverlayState` to page-level state management in `page.tsx`
- Implement mutual exclusivity logic in state handlers
- Add expand/collapse animations

## Related Decisions

- [ADR 008: Panel Navigation Architecture](./008-panel-navigation-architecture.md) - Superseded; original hamburger menu placement
- [ADR 003: Multi-Metric Completion Scoring](./003-multi-metric-completion-scoring.md) - Progress bar data displayed in profile card

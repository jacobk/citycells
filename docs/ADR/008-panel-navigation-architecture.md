# ADR 008: Panel Navigation Architecture with Hamburger Menu

**Date:** 2026-02-04
**Status:** Superseded by ADR 009
**Supersedes:** N/A

## Context

CityCells currently has multiple UI panel patterns:

1. **ProgressDashboard**: Right-side slide-out drawer for stats overview
2. **AreaDetailsPanel**: Bottom sheet slide-up for area details when clicking map
3. **ExemptionModal**: Modal overlay for exemption management

Users have requested the ability to:
- View all 136 sub-areas in a sortable list
- See walked status at a glance without clicking each area on the map
- Drill into area details from the list view
- Navigate between different app sections via a menu

**Problems with current architecture:**
- No unified navigation pattern between panels
- Users must know to click areas on map to see details
- No way to browse areas without interacting with map
- ProgressDashboard and AreaDetailsPanel use different panel styles (drawer vs bottom sheet)

**Requirements:**
- Consistent panel pattern for content browsing
- Clear navigation between list and detail views
- App-wide menu for accessing different sections
- Mobile-first design with thumb-reachable controls

## Decision

### 1. Standardize on Bottom Sheet for Content Browsing

Both the sub-area list and area details will use the bottom sheet pattern (like `AreaDetailsPanel`).

**Rationale:**
- Consistent visual language across the app
- Bottom sheets work better on mobile (more content area than side drawers)
- Map remains partially visible, maintaining spatial context
- Enables seamless in-panel navigation without closing/reopening

### 2. Breadcrumb Navigation Within Panel

Implement stack-based navigation inside the bottom sheet using breadcrumbs:

```
Areas > Västra Hamnen
```

**Navigation Flow:**
1. User opens "Areas" from hamburger menu → Bottom sheet shows sub-area list
2. User taps an area → Panel transitions to area detail view, breadcrumb updates
3. User taps "Areas" in breadcrumb → Returns to list view

**Rationale:**
- Clear hierarchy indication
- Familiar pattern from web/mobile apps
- Works well with potential future deep linking
- Doesn't conflict with map pan/zoom gestures (unlike swipe navigation)

### 3. Hamburger Menu in Top-Right

Add a floating hamburger menu button in the top-right corner.

**Menu Options:**
- **Areas** - Opens sub-area list in bottom sheet
- **Stats** - Opens ProgressDashboard (existing right drawer, unchanged)

**Rationale:**
- Top-left is occupied by the status card (athlete info, progress bar)
- Bottom positions would conflict with bottom sheet
- Top-right is thumb-reachable on mobile when phone held in right hand
- Standard mobile menu position recognized by users

### 4. State Management: Component State, Not URL

Navigation state (current view, selected area) stored in React component state, not in the URL.

**Rationale:**
- Simpler implementation for MVP
- Avoids complexity of URL synchronization with panel state
- Panel state is ephemeral (closing panel resets navigation)
- Can add URL-based deep linking in future if needed

### 5. Panel Navigation State Model

```typescript
type PanelView = 
  | { type: 'closed' }
  | { type: 'area-list'; sortBy: SortOption }
  | { type: 'area-detail'; areaId: number; fromList: boolean };

type SortOption = 
  | 'circumference-asc' 
  | 'circumference-desc'
  | 'name-asc'
  | 'status-walked'
  | 'status-unwalked'
  | 'area-asc'
  | 'area-desc';
```

The `fromList` flag determines whether breadcrumbs show (true = navigated from list, show breadcrumbs; false = clicked from map, no breadcrumbs).

## Consequences

### Positive

- Unified navigation pattern for content browsing
- Users can discover and browse areas without map interaction
- Clear navigation hierarchy with breadcrumbs
- Mobile-optimized with thumb-reachable controls
- Maintains map visibility for spatial context

### Negative

- Adds complexity to panel state management
- Hamburger menu is an additional UI element to maintain
- ProgressDashboard remains a different pattern (right drawer) - minor inconsistency
- No URL-based deep linking initially

### Technical

- New `HamburgerMenu` component needed (`src/components/HamburgerMenu/`)
- Extend or refactor `AreaDetailsPanel` to support list view mode
- Add `PanelBreadcrumbs` component for navigation
- Update `page.tsx` to manage unified panel navigation state
- Sorting logic uses existing area data from analysis (perimeter, completion status)

## Related Decisions

- [ADR 003: Multi-Metric Completion Scoring](./003-multi-metric-completion-scoring.md) - Tier data displayed in list
- [ADR 007: Interactive Metrics Documentation](./007-interactive-metrics-documentation.md) - Link from area details to docs

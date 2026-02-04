# Sub-Area List

## Overview

The sub-area list provides a browsable view of all 136 Malmö sub-areas (delområden) with sorting and filtering capabilities. Users can discover areas without interacting with the map, see completion status at a glance, and drill into individual areas to view their walk history.

This feature includes a hamburger menu in the top-right corner that provides app-wide navigation, making it easy to switch between the area list, stats dashboard, and map views.

## User Stories

From [PRD 001](../PRD/001-mvp-mobile-walker.md) Section 2 (Sub-Area List & Navigation Stories):
- "As a user, I want to see a list of all sub-areas sorted by circumference, so I can find short walks to complete."
- "As a user, I want to see which areas I've walked directly in the list view, so I can quickly identify remaining areas."
- "As a user, I want to drill into an area from the list to see all registered walks for that area."
- "As a user, I want breadcrumb navigation to return from area details to the list."
- "As a user, I want a hamburger menu to access different app sections without cluttering the map interface."

## Implementation

> **Note:** This section is completed by the implementation agent.

### Key Files

| File | Purpose |
|------|---------|
| `src/components/HamburgerMenu/HamburgerMenu.tsx` | Floating menu button and overlay |
| `src/components/HamburgerMenu/index.tsx` | Component export |
| `src/components/SubAreaListPanel/SubAreaListPanel.tsx` | List view component |
| `src/components/SubAreaListPanel/index.tsx` | Component export |
| `src/components/PanelBreadcrumbs/PanelBreadcrumbs.tsx` | Breadcrumb navigation |
| `src/app/page.tsx` | Panel navigation state management |

### Component Structure (Suggested)

```
src/components/
├── HamburgerMenu/
│   ├── HamburgerMenu.tsx    # Button + dropdown menu
│   └── index.tsx
├── SubAreaListPanel/
│   ├── SubAreaListPanel.tsx # List with sorting
│   ├── SubAreaListItem.tsx  # Individual list row
│   └── index.tsx
└── PanelBreadcrumbs/
    ├── PanelBreadcrumbs.tsx # Navigation breadcrumbs
    └── index.tsx
```

### Data Flow

```
┌─────────────────┐
│  Hamburger Menu │
│  (top-right)    │
└────────┬────────┘
         │ "Areas" selected
         ▼
┌─────────────────────────────────────────────┐
│           Bottom Sheet Panel                 │
│  ┌───────────────────────────────────────┐  │
│  │  [Breadcrumbs: Areas > ...]           │  │
│  ├───────────────────────────────────────┤  │
│  │                                       │  │
│  │  ┌─ List View ─────────────────────┐  │  │
│  │  │  Sort: [Circumference ▼]        │  │  │
│  │  │  ┌─────────────────────────────┐│  │  │
│  │  │  │ Västra Hamnen    2.1km  🟣  ││  │  │
│  │  │  │ Limhamn          3.4km  🟡  ││  │  │
│  │  │  │ Rosengård        2.8km  ○   ││  │  │
│  │  │  └─────────────────────────────┘│  │  │
│  │  └─────────────────────────────────┘  │  │
│  │           ↓ tap item                  │  │
│  │  ┌─ Detail View ───────────────────┐  │  │
│  │  │ (existing AreaDetailsPanel)     │  │  │
│  │  └─────────────────────────────────┘  │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

### Key Functions

_To be documented by implementation agent._

## Rationale

### Design Decisions

**Bottom Sheet (not drawer):**
- Consistent with existing AreaDetailsPanel pattern
- Better for mobile - more vertical content area
- Map remains partially visible for spatial context
- Enables seamless in-panel navigation

**Breadcrumbs (not tabs or swipe):**
- Clear navigation hierarchy
- Familiar web/mobile pattern
- Works well with potential future deep linking
- Doesn't conflict with map pan/zoom gestures

**Hamburger Menu in Top-Right:**
- Top-left is occupied by status card (would be crowded)
- Bottom positions would conflict with bottom sheet
- Top-right is thumb-reachable when holding phone in right hand
- Standard mobile menu position users recognize

**Default Sort by Circumference:**
- Most common use case: "What's a quick walk I can do?"
- Shortest walks first encourages completion of easy areas
- Users can easily switch to other sorts

### ADR References

- [ADR 008: Panel Navigation Architecture](../ADR/008-panel-navigation-architecture.md) - Core navigation patterns
- [ADR 003: Multi-Metric Completion Scoring](../ADR/003-multi-metric-completion-scoring.md) - Tier badges shown in list

## Current Limitations

1. **No search/filter**: Users cannot search for areas by name (sorting only)
2. **No URL deep linking**: Panel state is not reflected in URL
3. **Single sort only**: Cannot sort by multiple criteria (e.g., walked status then circumference)
4. **No map highlighting**: Selecting an area in the list doesn't highlight it on the map

## Planned Improvements

1. Add text search for area names
2. URL-based deep linking to specific areas
3. Map highlighting when hovering/selecting list items
4. Remember last sort preference in local storage

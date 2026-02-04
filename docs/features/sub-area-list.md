# Sub-Area List

## Overview

The sub-area list provides a browsable view of all 136 Malmö sub-areas (delområden) with sorting and filtering capabilities. Users can discover areas without interacting with the map, see completion status at a glance, and drill into individual areas to view their walk history.

This feature includes a hamburger menu in the top-left corner that provides app-wide navigation, making it easy to switch between the area list, stats dashboard, and map views.

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
│  (top-left)     │
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

**`page.tsx` - Panel Navigation State:**
```typescript
type PanelView = 
  | { type: 'closed' }
  | { type: 'area-list'; sortBy: SortOption }
  | { type: 'area-detail'; areaId: number; fromList: boolean };
```
The `fromList` flag determines whether breadcrumbs are shown (true = navigated from list, false = clicked from map).

**`SubAreaListPanel.tsx` - Sorting Logic:**
```typescript
type SortOption = 
  | 'circumference-asc' 
  | 'circumference-desc'
  | 'name-asc'
  | 'status-walked'
  | 'status-unwalked';
```

**`Map.tsx` - Area Data Callback:**
```typescript
onAreasLoaded?: (areas: Map<number, AreaClickData>) => void;
```
Passes all area data to parent for use in list panel.

**Key Integration Points:**
- `HamburgerMenu` calls `onOpenAreas` and `onOpenStats` handlers
- `SubAreaListPanel` calls `onSelectArea` when user taps a list item
- `PanelBreadcrumbs` calls `onBackToList` to return from detail to list
- `AreaDetailsPanel` accepts optional `breadcrumbs` ReactNode prop for in-panel navigation

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

**Hamburger Menu in Top-Left:**
- Standard mobile convention places hamburger menus on the left
- Profile card (now collapsible) moved to top-right
- Bottom positions would conflict with bottom sheet
- Familiar pattern users expect from mobile apps

**Mutual Exclusivity:**
- Only one overlay (hamburger menu OR profile card) can be open at a time
- Opening one automatically closes the other
- Reduces visual clutter and provides focused interaction

**Default Sort by Circumference:**
- Most common use case: "What's a quick walk I can do?"
- Shortest walks first encourages completion of easy areas
- Users can easily switch to other sorts

### ADR References

- [ADR 009: UI Navigation Layout](../ADR/009-ui-navigation-layout.md) - Current navigation layout (hamburger left, profile right, mutual exclusivity)
- [ADR 008: Panel Navigation Architecture](../ADR/008-panel-navigation-architecture.md) - Original panel patterns (superseded by ADR 009)
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

# Distance Progress Tracking

## Overview

Distance Progress Tracking displays distance metrics in the Progress Dashboard, providing users with both theoretical and actual distance views of their progress through Malmö's sub-areas. The primary metric (theoretical distance) represents the sum of perimeters for completed areas, providing an "ideal" distance if walking exactly each area's border. The actual distance from Strava activities is shown as an additional statistic, along with the difference between actual and theoretical distances.

This feature complements the area-based progress (X of 136 areas completed) with distance-based progress tracking, showing both how much theoretical distance has been covered and how efficiently the user walked compared to the ideal path.

## User Stories

From [PRD 001](../PRD/001-mvp-mobile-walker.md) Section 2:
- "As a user, I want to see my total walked distance displayed in the status view, so I can track how much I've walked overall."
- "As a user, I want to see the total distance of all area perimeters combined, so I know the total challenge distance."
- "As a user, I want to see a progress bar showing walked distance vs total perimeter distance (e.g., 'walked X km of Y km'), so I can track my distance-based progress."

## Implementation

> **Note:** This section is completed by the implementation agent.

### Key Files

| File | Purpose |
|------|---------|
| `src/components/ProgressDashboard/ProgressDashboard.tsx` | Main component displaying distance metrics and progress bar |
| `src/lib/db.ts` | Database queries to calculate theoretical distance, total perimeter distance, and actual walked distance |
| `src/app/page.tsx` | Queries distance metrics when Progress Dashboard opens and passes to ProgressDashboard component |
| `src/lib/format-utils.ts` | Shared utility function for formatting distance values (X.XX km format) |

### Data Flow

1. User opens Progress Dashboard (via hamburger menu → Stats)
2. Component queries database for:
   - **Theoretical distance**: `SELECT SUM(a.perimeter_meters) FROM areas a INNER JOIN area_completions ac ON a.id = ac.area_id WHERE ac.user_id = ?`
   - **Total perimeter distance**: `SELECT SUM(perimeter_meters) FROM areas` (cached or calculated once)
   - **Actual walked distance**: `SELECT SUM(total_distance_meters) FROM walks WHERE user_id = ?`
3. Calculate metrics:
   - Distance progress percentage: `(theoreticalDistance / totalPerimeterDistance) * 100`
   - Distance difference: `actualWalkedDistance - theoreticalDistance`
4. Display metrics and progress bar in dashboard UI:
   - Primary: Theoretical distance progress bar and "Walked X.XX km of Y.YY km"
   - Secondary: Actual distance and difference as additional statistics

### Key Functions

**Database Query Functions (`src/lib/db.ts`):**

- `getTheoreticalDistance(userId: number): number` - Calculates sum of `perimeter_meters` for all completed areas (JOIN with `area_completions`). Returns 0 if no completed areas.
- `getTotalPerimeterDistance(): number` - Calculates sum of all `perimeter_meters` from `areas` table (all 136 areas). Cached at module level since it's a static value.
- `getActualWalkedDistance(userId: number): number` - Calculates sum of `total_distance_meters` from `walks` table for the user. Uses indexed `user_id` column for efficiency.

**Formatting Utility (`src/lib/format-utils.ts`):**

- `formatDistance(meters: number): string` - Formats distance in meters to human-readable string (X.XX km for >= 1000m, rounded meters otherwise). Used consistently across ProgressDashboard, AreaDetailsPanel, and ExemptionModal.

**Component Integration (`src/app/page.tsx`):**

- Distance metrics are queried via `useEffect` hook when `isDashboardOpen` becomes `true` and user is authenticated.
- Uses `getOrCreateUserId(athlete.id)` to get userId, then calls the three query functions.
- Results are stored in state and passed as props to `ProgressDashboard` component.

**ProgressDashboard Component (`src/components/ProgressDashboard/ProgressDashboard.tsx`):**

- Receives distance metrics as optional props: `theoreticalDistance`, `totalPerimeterDistance`, `actualWalkedDistance`.
- Calculates distance progress percentage: `(theoreticalDistance / totalPerimeterDistance) * 100` (capped at 100%).
- Calculates distance difference: `actualWalkedDistance - theoreticalDistance`.
- Displays distance progress bar (blue gradient, distinct from orange area completion bar) and secondary statistics.

## Rationale

### Design Decisions

**Theoretical vs Actual Distance:** The primary metric (theoretical distance) represents the sum of perimeters for completed areas, providing a clean "ideal" distance metric. This is used for the progress bar and main display. Actual distance from Strava is shown separately to provide transparency about real-world walking patterns (detours, multiple walks, inefficient routes).

**Efficient Calculation:** Theoretical distance is calculated via a single SQL JOIN query joining `areas` and `area_completions` tables, avoiding multiple queries or client-side calculations. Total perimeter distance (sum of all 136 areas) is static and should be cached or calculated once to avoid repeated computation.

**Using Strava's `distance` field:** Actual walked distance uses `total_distance_meters` from the `walks` table, which stores Strava's `distance` field. This accounts for privacy zone truncation in the polyline (see ADR 005) and provides accurate total distance even when GPS points are missing.

**Distance Difference Display:** The difference between actual and theoretical distance provides insight into walking efficiency. Positive values indicate detours or multiple walks per area, while negative values (rare) might indicate GPS errors or data inconsistencies.

**Separate progress bar:** Distance progress is displayed as a separate progress bar from area completion progress, allowing users to see both metrics at a glance. The progress bar uses theoretical distance to show progress toward the challenge goal.

### ADR References

- [ADR 004: SQLite Storage](../ADR/004-sqlite-storage.md) - Database schema and query patterns for accessing walk and area data
- [ADR 005: Strava Privacy Zones](../ADR/005-strava-privacy-zones.md) - Rationale for using Strava's `distance` field instead of polyline-calculated distance

## Current Limitations

1. Actual walked distance includes all walks, not just those matched to areas. This means walks that don't match any area (e.g., walks without `#malmödelområde` tag) are still counted in actual distance.
2. Theoretical distance progress may exceed 100% if user completes all areas (theoretical distance equals total perimeter distance).
3. Total perimeter distance is static (sum of all 136 areas) and doesn't account for areas that may be impossible to walk due to obstacles.
4. Theoretical distance assumes perfect perimeter coverage; it doesn't account for partial coverage (e.g., a Bronze-tier walk that only covered 60% of a perimeter still counts the full perimeter).

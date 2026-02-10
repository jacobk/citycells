# TICKET-012: Distance Progress Tracking

**Related:** ADR 004, ADR 005, PRD Section 3.9.1  
**Feature:** Distance Progress Tracking from [docs/features/distance-progress-tracking.md](../features/distance-progress-tracking.md)  
**Status:** Ready for Implementation  
**Created:** 2026-02-09

## Context to Load

Files the implementation agent MUST read first:

1. `docs/PRD/001-mvp-mobile-walker.md` Section 3.9.1 - Progress Dashboard & Distance Tracking requirements
2. `docs/features/distance-progress-tracking.md` - Feature documentation with rationale and data flow
3. `docs/ADR/004-sqlite-storage.md` - Database schema and query patterns
4. `docs/ADR/005-strava-privacy-zones.md` - Rationale for using Strava's `distance` field
5. `src/components/ProgressDashboard/ProgressDashboard.tsx` - Current ProgressDashboard implementation
6. `src/lib/db.ts` - Database query functions and schema
7. `src/components/Map/Map.tsx` - ProgressInfo interface definition

## Implementation Checklist

### 1. Add Database Query Functions

Create functions in `src/lib/db.ts` to calculate distance metrics efficiently:

- `getTheoreticalDistance(userId: number): number` - Sum of `perimeter_meters` from `areas` table for completed areas (JOIN with `area_completions`)
  - Query: `SELECT SUM(a.perimeter_meters) FROM areas a INNER JOIN area_completions ac ON a.id = ac.area_id WHERE ac.user_id = ?`
  - Returns 0 if no completed areas
- `getTotalPerimeterDistance(): number` - Sum of `perimeter_meters` from `areas` table (all 136 areas)
  - Query: `SELECT SUM(perimeter_meters) FROM areas`
  - Should be cached or calculated once (static value)
  - Consider memoizing this value since it never changes
- `getActualWalkedDistance(userId: number): number` - Sum of `total_distance_meters` from `walks` table for user
  - Query: `SELECT SUM(total_distance_meters) FROM walks WHERE user_id = ?`
  - Uses indexed `user_id` column for efficiency
  - Returns 0 if no walks
- All functions should handle null values gracefully (return 0 if no data)
- Add `// WHY:` comments referencing ADR 005 for using `total_distance_meters` instead of polyline-calculated distance
- Add `// WHY:` comments explaining theoretical vs actual distance distinction

### 2. Extend ProgressInfo Interface (if needed)

Check if `ProgressInfo` interface in `src/components/Map/Map.tsx` needs extension:

- Review current interface structure
- Determine if distance metrics should be part of `ProgressInfo` or calculated separately in ProgressDashboard
- If extending, update `onProgressChange` callback signature and Map component

### 3. Update ProgressDashboard Component

Modify `src/components/ProgressDashboard/ProgressDashboard.tsx`:

- Add state or props for distance metrics:
  - `theoreticalDistance` - Sum of perimeters for completed areas
  - `totalPerimeterDistance` - Sum of all area perimeters (136 areas)
  - `actualWalkedDistance` - Sum of all Strava walk distances
- Calculate metrics:
  - Distance progress percentage: `(theoreticalDistance / totalPerimeterDistance) * 100`
  - Distance difference: `actualWalkedDistance - theoreticalDistance`
- Add new UI section displaying:
  - **Primary display**: Theoretical distance progress bar and "Walked X.XX km of Y.YY km" (theoretical vs total perimeter)
  - **Secondary stats**: Actual walked distance: "X.XX km" format
  - **Difference**: "+X.XX km" or "-X.XX km" format (actual - theoretical)
- Handle edge cases:
  - Division by zero (no areas or no completed areas)
  - Progress > 100% (theoretical distance equals total perimeter when all areas completed)
  - Null/undefined values
  - Negative difference (rare, but handle gracefully)

### 4. Update ProgressDashboard Props Interface

Extend `ProgressDashboardProps` interface:

- Add `userId?: number` prop to pass user ID for distance queries
- Or add distance metrics as props if calculated in parent:
  - `theoreticalDistance?: number`
  - `totalPerimeterDistance?: number`
  - `actualWalkedDistance?: number`
- Update component usage in `src/app/page.tsx` to pass required props

### 5. Update Parent Component (page.tsx)

Modify `src/app/page.tsx` if distance metrics are calculated at parent level:

- Query database for distance metrics when user is authenticated and Progress Dashboard opens
- Consider caching `totalPerimeterDistance` (static value) to avoid repeated queries
- Calculate distance metrics efficiently (use the new query functions)
- Pass distance metrics to ProgressDashboard component
- Consider memoizing calculations to avoid recomputation on every render

## Maintainability

Before implementing, review for:

- [ ] **Refactor opportunity?** Check if similar aggregation queries exist in `db.ts` that could be consolidated
- [ ] **DRY check** - Review if distance formatting logic exists elsewhere (e.g., AreaDetailsPanel) that could be extracted to a utility
- [ ] **Modularity** - Consider extracting distance calculation logic to a separate utility function for testability
- [ ] **Debt impact** - This adds new database queries; ensure they're efficient and don't duplicate existing query patterns

**Specific considerations:**
- Distance formatting (meters to kilometers with 2 decimals) should be consistent with existing UI patterns
- Progress bar styling should match existing area completion progress bar for visual consistency
- Database queries should be efficient:
  - `area_completions.user_id` is indexed (see ADR 004)
  - `walks.user_id` is indexed (see ADR 004)
  - Total perimeter distance should be cached/memoized (static value)
- Theoretical distance calculation uses JOIN which is efficient with proper indexes
- Consider calculating distance metrics only when Progress Dashboard opens, not on every render

## Acceptance Criteria

- [ ] Progress Dashboard displays theoretical distance (sum of completed area perimeters) in "X.XX km" format
- [ ] Progress Dashboard displays total perimeter distance (all 136 areas) in "X.XX km" format
- [ ] Progress Dashboard shows distance progress text: "Walked X.XX km of Y.YY km" (theoretical vs total perimeter)
- [ ] Progress Dashboard displays a separate progress bar showing theoretical distance completion percentage
- [ ] Progress Dashboard displays actual walked distance as secondary statistic in "X.XX km" format
- [ ] Progress Dashboard displays distance difference (+X.XX km or -X.XX km) showing actual - theoretical
- [ ] Theoretical distance calculated efficiently via SQL JOIN query
- [ ] Total perimeter distance is cached/memoized to avoid repeated calculation (static value)
- [ ] Actual distance uses Strava's `distance` field (from `total_distance_meters` column), not polyline-calculated distance
- [ ] Component handles edge cases gracefully (no walks, no completed areas, division by zero, progress > 100%)
- [ ] Distance metrics update correctly when new walks are synced or areas are completed
- [ ] UI is mobile-friendly and matches existing ProgressDashboard styling
- [ ] Distance calculations are efficient and don't cause performance issues on dashboard open

## Files to Modify

| File | Change |
|------|--------|
| `src/lib/db.ts` | Add `getTheoreticalDistance()`, `getTotalPerimeterDistance()`, and `getActualWalkedDistance()` query functions. Consider caching total perimeter distance. |
| `src/components/ProgressDashboard/ProgressDashboard.tsx` | Add distance metrics display (theoretical, actual, difference) and progress bar using theoretical distance |
| `src/app/page.tsx` | Pass userId or distance metrics to ProgressDashboard component. Consider memoizing calculations. |
| `src/components/Map/Map.tsx` | Possibly extend ProgressInfo interface if distance metrics should be part of progress state (optional) |

## Notes

- Do NOT duplicate ADR/PRD content - reference it
- Distance formatting should be consistent with existing UI (check AreaDetailsPanel for similar formatting)
- **Performance is critical**: 
  - Total perimeter distance is static (sum of 136 areas) - cache or memoize this value
  - Theoretical distance uses efficient JOIN query with indexed columns
  - Consider calculating distance metrics only when Progress Dashboard opens, not on every render
  - Use React.useMemo or similar for expensive calculations
- Progress bar should visually distinguish from area completion progress bar (different color or styling)
- Theoretical distance progress will reach 100% when all 136 areas are completed
- Actual distance may exceed theoretical distance due to detours, multiple walks per area, or inefficient routes
- Distance difference provides insight into walking efficiency (positive = detours, negative = rare GPS errors)

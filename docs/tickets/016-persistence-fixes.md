# TICKET-016: Data Persistence Fixes and Improvements

**Related:** ADR 004 (Updated 2026-02-15), PRD Section 3.9  
**Feature:** Data Persistence (docs/features/data-persistence.md)  
**Status:** Ready for Implementation  
**Created:** 2026-02-15

## Context to Load

Files the implementation agent MUST read first:

1. `docs/ADR/004-sqlite-storage.md` - Storage architecture, schema, new sections for reset and incremental sync
2. `docs/PRD/001-mvp-mobile-walker.md` Section 3.9 - Data persistence requirements
3. `docs/features/data-persistence.md` - Current implementation details and known issues
4. `src/lib/analysis-persistence.ts` - **Critical bug location** (lines 196-204, 310-320)
5. `src/lib/db.ts` - Database operations and schema
6. `src/hooks/useStrava.ts` - Activity fetching logic
7. `src/app/api/activities/route.ts` - Strava API calls
8. `src/components/Map/Map.tsx` - Page load flow and cache loading

## Implementation Checklist

### 1. Fix Potato Tier Persistence Bug (CRITICAL)

The `saveWalkAnalysis()` and `loadCachedAnalyses()` functions in `analysis-persistence.ts` fail to assign potato tier.

**Location:** `src/lib/analysis-persistence.ts`

**Bug (lines ~196-204 in saveWalkAnalysis):**
```typescript
// Current code - MISSING potato tier
let bestTier: Tier = null;
if (bestScore >= TIER_THRESHOLDS.platinum) { bestTier = 'platinum'; }
else if (bestScore >= TIER_THRESHOLDS.gold) { bestTier = 'gold'; }
else if (bestScore >= TIER_THRESHOLDS.silver) { bestTier = 'silver'; }
else if (bestScore >= TIER_THRESHOLDS.bronze) { bestTier = 'bronze'; }
// MISSING: else if (bestScore > 0) { bestTier = 'potato'; }
```

**Fix:** Add `else if (bestScore > 0) { bestTier = 'potato'; }` after bronze check.

**Same bug exists in loadCachedAnalyses() (lines ~310-320)** - apply same fix.

- [ ] Fix `saveWalkAnalysis()` tier assignment
- [ ] Fix `loadCachedAnalyses()` tier assignment
- [ ] Verify potato tier areas persist after page refresh

### 2. Add Database Reset Capability

Add a "Clear All Data" function and UI control.

**Schema:** No changes needed (deletes data, doesn't alter structure)

**New function in `src/lib/db.ts`:**
```typescript
async function clearUserData(userId: number): Promise<void>
```

**Deletion order (for foreign key safety):**
1. `deviations` (references `walk_analyses`)
2. `walk_analyses` (references `walks`)
3. `area_completions` (references `walks`)
4. `walks` (main data)

**Preserve:**
- `users` table (authentication)
- `areas` table (GeoJSON data)

**UI Location:** Profile card (expanded state) → "Clear All Data" button

- [ ] Implement `clearUserData()` in `db.ts`
- [ ] Add confirmation dialog (destructive action warning)
- [ ] Add button to ProfileCard component
- [ ] After clearing, trigger page refresh or re-initialize app state

### 3. Implement Incremental Activity Sync

Avoid fetching all activities from Strava on every page load.

**Schema changes (migration required):**
```sql
ALTER TABLE users ADD COLUMN last_activity_sync_at TEXT;
ALTER TABLE users ADD COLUMN last_synced_activity_id INTEGER;
```

**New/modified functions:**

| Function | File | Purpose |
|----------|------|---------|
| `getLastSyncTimestamp(userId)` | `db.ts` | Get stored sync timestamp |
| `updateLastSync(userId, timestamp, activityId)` | `db.ts` | Update after successful sync |
| Modified `fetchActivities()` | `api/activities/route.ts` | Accept `after` parameter |

**Sync flow:**
1. Load cached analyses immediately (existing)
2. Check `last_activity_sync_at` for user
3. If exists, call Strava API with `after` parameter (epoch seconds)
4. If null or force refresh, fetch all activities
5. After successful fetch, update `last_activity_sync_at`

**Strava API:** Use `after` parameter (epoch timestamp) to filter activities

- [ ] Add migration for new columns
- [ ] Implement sync timestamp storage/retrieval
- [ ] Modify activity fetching to use `after` parameter
- [ ] Add "Force Refresh" option to re-sync all activities
- [ ] Test incremental sync with various scenarios

## Maintainability

Before implementing, review for:

- [ ] **Refactor opportunity?** Tier assignment logic appears in multiple places (`saveWalkAnalysis`, `loadCachedAnalyses`, possibly `analysis.ts`). Consider extracting to a single `assignTier(score)` function.
- [ ] **DRY check** - Tier thresholds may be duplicated. Use centralized `TIER_THRESHOLDS` constant everywhere.
- [ ] **Modularity** - `clearUserData()` should be a standalone function that can be tested independently.
- [ ] **Debt impact** - The potato tier bug suggests tier assignment wasn't properly centralized. Fix the root cause by consolidating tier logic.

**Specific refactoring task:** If tier assignment logic is duplicated, create:
```typescript
// src/lib/tiers.ts
export function assignTier(score: number): Tier {
  if (score >= TIER_THRESHOLDS.platinum) return 'platinum';
  if (score >= TIER_THRESHOLDS.gold) return 'gold';
  if (score >= TIER_THRESHOLDS.silver) return 'silver';
  if (score >= TIER_THRESHOLDS.bronze) return 'bronze';
  if (score > 0) return 'potato';
  return null;
}
```

## Acceptance Criteria

### Potato Tier Fix
- [ ] Areas with scores 0 < score < 0.50 persist with tier = 'potato' (not null)
- [ ] Potato tier areas remain visible after page refresh
- [ ] Existing potato tier areas are correctly displayed (may require data migration or re-analysis)

### Database Reset
- [ ] "Clear All Data" button visible in expanded profile card
- [ ] Confirmation dialog warns user before clearing
- [ ] After clearing: all walks, analyses, completions deleted
- [ ] After clearing: user remains logged in (tokens preserved)
- [ ] After clearing: area definitions preserved
- [ ] App re-initializes cleanly after clear (no stale UI state)

### Incremental Sync
- [ ] First visit: Full sync behavior unchanged
- [ ] Return visit (no new activities): Cached data displays instantly, API returns quickly
- [ ] Return visit (new activities): Only new activities fetched and analyzed
- [ ] Force refresh: Re-fetches all activities regardless of timestamp
- [ ] `last_activity_sync_at` column properly updated after each sync

## Files to Modify

| File | Change |
|------|--------|
| `src/lib/analysis-persistence.ts` | Fix potato tier in `saveWalkAnalysis()` and `loadCachedAnalyses()` |
| `src/lib/db.ts` | Add `clearUserData()`, add migration for sync columns, add sync timestamp functions |
| `src/lib/tiers.ts` (NEW - recommended) | Centralized `assignTier()` function |
| `src/hooks/useStrava.ts` | Modify to support incremental sync |
| `src/app/api/activities/route.ts` | Add `after` parameter support |
| `src/components/ProfileCard.tsx` (or similar) | Add "Clear All Data" button and confirmation |
| `src/components/Map/Map.tsx` | Integrate incremental sync flow |

## Notes

- **Priority order:** Fix potato bug first (critical), then database reset, then incremental sync
- **Do NOT duplicate ADR/PRD content** - reference sections as needed
- The potato tier bug is likely causing the "areas disappear after refresh" issue reported by users
- Database reset is important for debugging and user recovery from data corruption
- Incremental sync is a performance optimization - ensure it doesn't break existing behavior
- Consider E2E test for page refresh preserving potato tier areas

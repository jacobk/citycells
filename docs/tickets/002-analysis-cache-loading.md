# TICKET-002: Analysis Cache Loading

**Related:** ADR 004 (Cache Loading Strategy section), PRD Section 3.8  
**Feature:** Data Persistence  
**Status:** Ready for Implementation  
**Created:** 2026-02-05

## Summary

Analysis results are saved to the database but **never loaded on page reload**. The page always shows "Analyzing paths..." and re-computes all analyses, even though cached results exist. This ticket implements the cache loading flow specified in ADR 004.

## Context to Load

Files the implementation agent MUST read first:

1. `docs/ADR/004-sqlite-storage.md` - See "Cache Loading Strategy" section for required flow
2. `docs/PRD/001-mvp-mobile-walker.md` Section 3.8 - "Analysis results cached—no re-analysis on page reload"
3. `docs/features/data-persistence.md` - Intended flow described in lines 102-117
4. `src/lib/analysis-persistence.ts` - Contains `loadCachedAnalyses()` and `getActivitiesToAnalyze()` (already implemented, not used)
5. `src/components/Map/Map.tsx` - Main component to modify (analysis useEffect at line 236)

## Implementation Checklist

### 1. Load Cached Results Before Analysis

In `Map.tsx`, at the start of the analysis `useEffect` (after `userId` is obtained), add:

```typescript
// Load cached results from database
const cachedResults = userId ? loadCachedAnalyses(userId) : new Map();
```

Import `loadCachedAnalyses` from `@/lib/analysis-persistence`.

### 2. Populate UI State from Cache

Before running any analysis, populate `areaAnalyses` and `areaDetailsData` from cached results:

```typescript
// Immediately display cached results
cachedResults.forEach((cached, areaFid) => {
  newAreaAnalyses.set(areaFid, {
    areaId: areaFid,
    tier: cached.metrics.tier as Tier,
    qualityScore: cached.metrics.rawQualityScore,
    metrics: /* convert cached metrics */,
    matchedActivities: cached.activityIds.map(id => ({ id, name: '' }))
  });
});
```

### 3. Filter Activities Using `getActivitiesToAnalyze()`

Only process activities that haven't been analyzed:

```typescript
const activityIds = activities.map(a => a.id);
const needsAnalysis = userId 
  ? getActivitiesToAnalyze(userId, activityIds)
  : activityIds;

// Only process NEW activities
const activitiesToProcess = activities.filter(a => needsAnalysis.includes(a.id));
```

Import `getActivitiesToAnalyze` from `@/lib/analysis-persistence`.

### 4. Update Progress Display

Show cached progress immediately, then optionally show "Analyzing X new activities..." if there are new ones:

- If `cachedResults.size > 0`: Call `onProgressChange()` immediately with cached tier counts
- If `needsAnalysis.length > 0`: Show "Analyzing X new activities..." instead of "Analyzing paths..."
- If `needsAnalysis.length === 0`: Skip analysis entirely, just use cached data

### 5. Enhance `loadCachedAnalyses()` Return Type (if needed)

The current function returns limited metrics. If UI needs more fields, enhance the SQL query to return:

- All metric fields from `walk_analyses` table
- Walk names from `walks` table for the walk history list
- Consider returning deviation data for the deviations panel

Check if current return type is sufficient for `AreaAnalysis` and `AreaClickData` types.

### 6. Merge Cached + New Results

After analyzing new activities, merge them with cached results:

```typescript
// After analysis loop completes
// newAreaAnalyses already contains cached + newly analyzed
setAreaAnalyses(newAreaAnalyses);
```

## Acceptance Criteria

- [ ] Page with existing analyses loads instantly without "Analyzing paths..." message
- [ ] Cached tier colors and scores display immediately on map
- [ ] Adding a new Strava activity only analyzes the new activity
- [ ] Progress bar shows correct counts from cached data on load
- [ ] Console logs show "Skipping X already-analyzed activities" or similar
- [ ] Clear IndexedDB → full analysis runs again (regression test)

## Files to Modify

| File | Change |
|------|--------|
| `src/components/Map/Map.tsx` | Add cache loading at start of analysis useEffect, filter activities |
| `src/lib/analysis-persistence.ts` | Potentially enhance `loadCachedAnalyses()` return type if more fields needed |

## Notes

- Do NOT duplicate ADR 004 content - reference the "Cache Loading Strategy" section
- The caching functions already exist and are tested - this ticket wires them up
- Stream data caching already works correctly - no changes needed there
- Test with browser DevTools → Application → IndexedDB to verify cached data exists

# Re-Analysis

## Overview

Re-analysis lets users refresh cached walk scores when either the scoring algorithm has changed (e.g., new weights or metrics) or when source data from Strava may have changed (e.g., privacy zone edits, activity corrections). Without this, cached results in the database would never be updated. The feature is user-initiated and offers two modes: re-score only (fast, uses existing GPS cache) and full re-analyze (re-fetch streams from Strava then re-score). The primary entry point is a re-analyze control in the user-profile popup (ProfileCard); per-walk re-analysis is available from area details or walk list.

## User Stories

From [PRD 001](../PRD/001-mvp-mobile-walker.md) Section 2 (Re-Analysis Stories):
- "As a user, I want to re-analyze my cached walks so that scores stay correct when the app's scoring formula changes."
- "As a user, I want to re-fetch and re-analyze my walks so that scores reflect the latest GPS data from Strava (e.g., after editing privacy zones or correcting an activity)."
- "As a user, I want a re-analyze control in my profile popup so I can refresh all my walk scores in one place."
- "As a user, I want to choose between re-scoring only (fast) and full re-fetch plus re-score when source data may have changed."

## Implementation

> **Note:** This section is completed by the implementation agent.

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/analysis-persistence.ts` | Re-analyze logic: invalidate cache, re-score or re-fetch+re-score, refresh area_completions |
| `src/lib/analysis.ts` | `analyzeWalk()` — used to recompute scores |
| `src/components/ProfileCard/ProfileCard.tsx` | Re-analyze button and mode choice in user-profile popup |
| `src/components/AreaDetailsPanel/AreaDetailsPanel.tsx` | Per-walk re-analyze menu in walk history section |
| `src/lib/db.ts` | IndexedDB stores: walkAnalyses, walks, areaCompletions (async operations) |
| `src/components/Map/Map.tsx` | Orchestration: registers refresh callback, reloads cached analyses after re-analysis |
| `src/app/page.tsx` | Wires up re-analysis handlers from ProfileCard and AreaDetailsPanel to persistence layer |

### Data Flow

1. **User initiates re-analysis** via ProfileCard ("Re-score All" / "Full Re-fetch") or AreaDetailsPanel (per-walk menu).
2. **Page handler** (`handleReAnalyze` or `handleReAnalyzeWalk`) is called with mode (`rescore` | `full`).
3. **Persistence layer** (`reAnalyzeWalks` / `reAnalyzeWalk`) is invoked:
   - Lists walks to process (all cached walks or single walk).
   - For each walk, invalidates existing analyses (`invalidateWalkAnalyses`) by deleting records from IndexedDB stores.
   - If `full` mode, fetches fresh streams from `/api/activities/streams` and saves them to the `walkStreams` store.
   - Runs `analyzeWalk()` with cached or fresh GPS coordinates.
   - Saves new analysis via `saveWalkAnalysis()` (which also updates `areaCompletions` store).
   - Calls progress callback to update UI.
4. **UI refresh**: After completion, `refreshMapRef.current()` increments `refreshCounter`, triggering the Map's analysis effect to reload cached analyses from the database.
5. **Map updates**: Cached analyses are loaded via `loadCachedAnalyses()`, and `areaAnalyses` / `areaDetailsData` state is updated, causing the map and panels to re-render with new scores and tiers.

### Key Functions

| Function | Location | Purpose |
|----------|----------|---------|
| `listWalksWithCache(userId)` | `analysis-persistence.ts` | Returns all walks with cached analyses for batch re-analysis |
| `invalidateWalkAnalyses(walkIds)` | `analysis-persistence.ts` | Deletes `walkAnalyses`, `deviations`, and orphaned `areaCompletions` records from IndexedDB for given walks |
| `reAnalyzeWalk(walkId, mode, fetchStreams?)` | `analysis-persistence.ts` | Re-analyzes a single walk (invalidate → fetch streams if full → run analyzeWalk → save) |
| `reAnalyzeWalks(userId, mode, walkIds?, onProgress?, fetchStreams?)` | `analysis-persistence.ts` | Batch re-analysis with progress tracking |
| `getWalkIdByStravaActivityId(stravaActivityId)` | `analysis-persistence.ts` | Maps Strava activity ID to database walk ID |
| `handleReAnalyze(mode)` | `page.tsx` | Orchestrates batch re-analysis from ProfileCard |
| `handleReAnalyzeWalk(stravaActivityId, mode)` | `page.tsx` | Orchestrates single-walk re-analysis from AreaDetailsPanel |

## Rationale

### Design Decisions

- **Two modes:** Re-score only vs full re-fetch+re-score address different causes of staleness (algorithm vs source data). Letting the user choose avoids unnecessary API calls when only the app has been updated.
- **Profile card as primary entry:** "Re-analyze all" in the profile popup gives one clear place to refresh everything; per-walk re-analyze supports targeted refresh from area/walk context.
- **Reuse existing persistence:** Invalidation is implemented by deleting relevant records in the `walkAnalyses` and `deviations` IndexedDB stores, then re-running analysis and calling existing `saveWalkAnalysis()` and `areaCompletions` update logic. No new stores.

### ADR References

- [ADR 011: Re-Analysis Strategy](../ADR/011-re-analysis-strategy.md) — Two modes, entry points, invalidation approach, UI/state.
- [ADR 026: IndexedDB Storage](../ADR/026-indexeddb-storage.md) — Schema and persistence (supersedes ADR 004); re-analysis invalidates and rewrites cached analysis records in IndexedDB.

## Current Limitations

1. Full re-analyze of many walks may hit Strava rate limits; batching or throttling may be needed later.
2. No automatic invalidation (e.g., by app version or "analysis schema" version); re-analysis is entirely user-initiated.

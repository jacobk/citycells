# TICKET-003: Re-Analysis

**Related:** ADR 011, PRD Section 2 (Re-Analysis Stories), PRD Section 3.10 (Profile Card – Re-Analyze)  
**Feature:** Re-Analysis ([docs/features/re-analysis.md](../features/re-analysis.md))  
**Status:** Ready for Implementation  
**Created:** 2026-02-06

## Context to Load

Files the implementation agent MUST read first:

1. `docs/ADR/011-re-analysis-strategy.md` — Two modes, entry points, invalidation approach, UI/state
2. `docs/ADR/004-sqlite-storage.md` — Schema for walk_analyses, walks, deviations, area_completions
3. `docs/PRD/001-mvp-mobile-walker.md` Section 2 (Re-Analysis Stories) and Section 3.10 (Profile Card – Re-Analyze)
4. `docs/features/re-analysis.md` — Feature overview, rationale, key files
5. `src/lib/analysis-persistence.ts` — Existing save/load and getActivitiesToAnalyze; add re-analyze helpers
6. `src/components/ProfileCard/ProfileCard.tsx` — Add re-analyze button and mode choice in user-profile popup
7. `src/components/Map/Map.tsx` — Orchestration; accept force re-analyze for selected activities and refresh UI

## Implementation Checklist

### 1. Re-Analysis Persistence Helpers

In `src/lib/analysis-persistence.ts` (or a dedicated module if preferred):

- Add a function to list all walk IDs for the current user that have cached analyses (for "re-analyze all").
- Add a function to invalidate cached analysis for a set of walks: delete from `walk_analyses` and `deviations` for those walks; ensure `area_completions` can be refreshed after re-analysis (or delete affected area_completions rows and let existing save logic repopulate).
- Add a function that, for a given set of walk IDs and mode ("re-score" | "full"):
  - **Re-score:** For each walk, load existing streams from `walks` table, run `analyzeWalk()` (from `src/lib/analysis.ts`), call existing `saveWalkAnalysis()` and update area_completions.
  - **Full:** For each walk, re-fetch streams from API (reuse existing streams API route), then same as re-score. Consider batching or throttling to avoid Strava rate limits.
- Return progress/status so the UI can show "Re-analyzing X of Y…" and handle errors (e.g., API failure for full mode).

### 2. Profile Card UI – Re-Analyze All

In `src/components/ProfileCard/ProfileCard.tsx`:

- Add re-analyze controls inside the expanded profile card (user-profile popup).
- Provide two actions (e.g., buttons or a dropdown): "Re-score all" and "Re-fetch & re-score all". Optional: short tooltips or labels explaining when to use each (see PRD 3.10).
- On click: call the re-analysis persistence layer for all cached walks with the chosen mode; show loading state (e.g., "Re-analyzing 12 walks…"); on success, trigger a refresh of analyses in the app (e.g., callback or context so Map and panels reload data); on error, show message and allow retry or fallback to re-score only if full mode failed.

### 3. Map / Orchestration Integration

In `src/components/Map/Map.tsx` (or wherever analysis state is owned):

- Support a "force re-analyze" path: when re-analysis completes, reload cached analyses (e.g., call `loadCachedAnalyses(userId)` again) and update `areaAnalyses` / `areaDetailsData` and progress so the map and panels show new scores and tiers without a full page reload.
- Ensure the analysis effect does not re-run normal "only analyze new activities" logic for the same activities that were just re-analyzed (e.g., re-analysis writes back to DB so they remain "cached").

### 4. Per-Walk Re-Analyze (Area Details / Walk List)

- From the area details panel or walk list, add a way to trigger re-analyze for a single walk (e.g., "Re-score this walk" / "Re-fetch & re-score this walk").
- Reuse the same persistence helpers for one walk ID; after completion, refresh the area’s data so the panel shows updated metrics and tier.

## Acceptance Criteria

- [ ] User can open the profile popup and see re-analyze options ("Re-score all" and "Re-fetch & re-score all").
- [ ] "Re-score all" re-runs the analysis algorithm on existing cached GPS data for all walks and updates map and panels without a full page reload.
- [ ] "Re-fetch & re-score all" re-fetches stream data from Strava for all walks, re-runs analysis, and updates map and panels; errors (e.g., API failure) are surfaced and user can retry or use re-score only.
- [ ] During re-analysis, a loading/progress state is shown (e.g., "Re-analyzing X walks…").
- [ ] User can trigger re-score or full re-analyze for a single walk from area details or walk list; that walk’s scores and tier update in the UI after completion.

## Files to Modify

| File | Change |
|------|--------|
| `src/lib/analysis-persistence.ts` | Add: list walks with cache, invalidate cache for walks, re-analyze (re-score and full) with progress/error handling |
| `src/components/ProfileCard/ProfileCard.tsx` | Add re-analyze button(s) and mode choice in expanded card; loading state and refresh callback |
| `src/components/Map/Map.tsx` | After re-analysis, reload cached analyses and update state so map/panels refresh |
| Area details / walk list component(s) | Add per-walk re-analyze actions (re-score / full) and refresh area data on completion |

## Notes

- Do not duplicate ADR/PRD content — reference ADR 011 and PRD sections above.
- Reuse `analyzeWalk()` from `src/lib/analysis.ts` and existing `saveWalkAnalysis()`; no schema changes required.
- Consider throttling or batching Strava stream fetches in "full" mode to avoid rate limits.

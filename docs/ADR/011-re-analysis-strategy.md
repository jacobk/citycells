# ADR 011: Re-Analysis Strategy

**Date:** 2026-02-06
**Status:** Accepted
**Supersedes:** N/A

## Context

Analysis results are cached in IndexedDB (see [ADR 026](./026-indexeddb-storage.md), which superseded ADR 004). Once a walk is analyzed and stored in the `walkAnalyses` store, it is never re-computed on page load. This design avoids redundant work but creates two problems:

1. **Source data may change.** Strava data can be edited (privacy zone changes, activity corrections, re-uploads). Cached stream data and derived scores may become stale.
2. **Scoring algorithm may change.** When we ship new metrics, weights, or thresholds (e.g., ADR 003 updates), existing cached scores do not reflect the new formula.

Users have no way to refresh analysis without clearing data or re-importing. We need a user-initiated re-analysis capability that supports both "re-score only" (algorithm change) and "full re-analyze" (source data + algorithm).

## Decision

We will implement a **user-initiated re-analysis** feature with two modes and two entry points.

### Two Re-Analysis Modes

| Mode | Description | When to use |
|------|-------------|-------------|
| **Re-score only** | Delete cached analysis results; re-run the scoring algorithm on existing cached GPS (stream) data. | After an app update that changes scoring (weights, metrics, thresholds). Fast; no Strava API calls. |
| **Full re-analyze** | Re-fetch stream data from Strava, then run the scoring algorithm and overwrite cached results. | When source data may have changed (privacy zones, GPS edits). Slower; uses Strava API. |

The UI will let the user **choose** between these modes (e.g., profile card: "Re-score all" vs "Re-fetch & re-score all").

### Entry Points

1. **Profile card (user-profile popup)**  
   A re-analyze control that applies to **all** of the user's cached walks. Supports both modes. Primary discoverability for "refresh my scores."

2. **Per-walk / per-area context**  
   Ability to re-analyze **individual** walks (e.g., from area details or walk list). Supports both modes for that walk only.

### Invalidation and Persistence

- **Re-score only:** For each target walk, delete records in `walkAnalyses` and `deviations` stores for that walk; recalculate using existing cached streams from the `walkStreams` store; write new records via existing `saveWalkAnalysis()`. Update `areaCompletions` after all affected walk-area pairs are re-scored.
- **Full re-analyze:** For each target walk, optionally clear or refresh the `walkStreams` record (re-fetch from API), then same as re-score: delete analysis records, run `analyzeWalk()` with fresh or existing streams, save via `saveWalkAnalysis()`, refresh `areaCompletions`.
- No schema change required; reuse existing tables and save/load functions.

### UI and State

- Show loading/progress state during re-analysis (e.g., "Re-analyzing 12 walks…").
- On completion, refresh in-memory cached analyses and re-render map and panels so new scores and tiers appear immediately.
- Errors (e.g., Strava API failure for full re-analyze) should be surfaced so the user can retry or fall back to re-score only.

## Consequences

### Positive

- Users can correct stale scores when source data or the algorithm changes.
- Choice of mode balances speed (re-score) vs freshness (full re-analyze).
- Reuses existing analysis and persistence code; no new storage model.

### Negative

- Full re-analyze can hit Strava rate limits if many activities are re-fetched at once; consider batching or throttling.
- Users must understand the difference between the two modes (copy or tooltips in UI can explain).

### Technical

- New functions in `analysis-persistence.ts` (or equivalent) to: list walks to re-analyze, invalidate cache for selection, trigger re-score or re-fetch+re-score, and refresh `area_completions`.
- ProfileCard and any per-walk UI need to call these and handle loading/error state.
- Map/orchestration layer must accept "force re-analyze" for selected activities instead of skipping cached ones.

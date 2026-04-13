# ADR 006: Adopt Strava Activity Streams for High-Fidelity GPS Data

**Date:** 2026-02-03
**Status:** Accepted
**Supersedes:** ADR 005

## Context

CityCells currently relies on Strava's `summary_polyline` from `athlete.listActivities` for GPS paths. This polyline is compressed and may be truncated by privacy zones, which degrades analysis accuracy.

Observed issues in real fixtures/tests:

- `summary_polyline` truncation causes large loop gaps (e.g., ~338m) and false open-path detection.
- Endpoint truncation is often >100m at both start and end.
- Polyline point density is low: 87 points for 2.05km (avg spacing ~23.8m) and 281 points for 4.39km (avg spacing ~15.7m).
- Coarse point spacing reduces alignment precision and can miss smaller deviations.

Strava Streams API provides raw activity data (`latlng`, `time`, `distance`, etc.) with up to 10,000 points per stream and synchronized indices. This yields substantially higher data fidelity and supports time-aware analysis.

Key constraints:

- Streams require per-activity requests, increasing API usage.
- Strava rate limits: non-upload endpoints are 100 requests per 15 minutes and 1,000 per day.
- Privacy zones: streams retrieved with a `public` access token are cropped. The Streams API docs indicate full data requires a token with `view_private` permissions.

Given CityCells' emphasis on accuracy and "best data possible", we need higher-fidelity GPS inputs than summary polylines provide.

## Decision

We will adopt Strava activity streams (`/activities/{id}/streams`) as the primary GPS source for analysis and visualization, using summary polylines only as fallback.

### Data Acquisition

- Request streams for each activity needing analysis:
  - `latlng`, `time`, `distance`
- Use `resolution=high` and `series_type=distance` by default to maximize spatial precision while keeping predictable downsampling.
- If an activity returns no `latlng` stream, fall back to `summary_polyline`.
- Cache stream data locally (IndexedDB `walkStreams` store — see [ADR 026](./026-indexeddb-storage.md)) to avoid repeated API calls.

### OAuth Scopes and Privacy Zones

- Continue requesting `activity:read_all`.
- Add `read_all` (and/or `view_private` if required by Strava's legacy permissions) to obtain complete streams without privacy-zone cropping.
- If privacy-zone cropping persists for some accounts, we will document that streams still reflect Strava's privacy protections and analysis may undercount near masked zones.

### Analysis Integration

- Use stream `latlng` as the canonical coordinate sequence for:
  - Perimeter coverage
  - Alignment RMSE
  - Deviation detection
  - Area coverage (closed-loop derivation)
- Continue to use Strava `distance` for total-walk length to avoid undercounting.
- Retain `summary_polyline` as fallback for activities without streams or when rate limits are hit.

### Rate Limit Mitigation

- Batch and throttle stream requests during initial sync.
- Default to incremental sync: only fetch streams for new activities.
- Persist a per-activity `streamsFetchedAt` marker in the `walkStreams` store to prevent refetching.

## Consequences

### Positive

- Significantly improved GPS fidelity for scoring metrics (perimeter coverage, alignment, deviations).
- Reduced false negatives in loop detection and area coverage.
- Enables time-aware analysis in future (pace anomalies, stop detection).

### Negative

- Increased API calls per activity (list + N stream requests).
- Risk of rate-limit throttling on initial sync for large histories.
- Higher compute cost due to larger point sets.

### Technical

- Requires new API route(s) to fetch and cache streams.
- Requires data model updates to store streams (or decoded coordinates) locally. Streams are now stored in a dedicated `walkStreams` IndexedDB store (see [ADR 026](./026-indexeddb-storage.md)).
- Test fixtures should include stream-based coordinates for regression validation.
- Supersedes ADR 005: data-quality issues from summary polylines are addressed by adopting streams.

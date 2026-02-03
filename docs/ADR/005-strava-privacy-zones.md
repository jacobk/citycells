# ADR 005: Strava Privacy Zones and Truncated Polylines

**Date:** 2026-02-03  
**Status:** Superseded by ADR 006

## Context

Strava's `summary_polyline` returned from `athlete.listActivities` can be truncated near the start and end of an activity due to privacy/anonymization zones. This truncation removes GPS points and causes:

- Under-reported total walk length when calculated from the polyline.
- Incorrect efficiency ratios when using truncated length as the denominator.
- False negatives in loop detection when comparing the first and last polyline points.

We observed missing distance on real activities (e.g., ~350m truncated). Strava provides additional metadata derived from the full GPS stream:

- `distance`: total activity distance in meters.
- `start_latlng` / `end_latlng`: more accurate start and end points.

## Decision

1. **Total Walk Length** uses Strava's `distance` field when available.
2. **Loop Detection** uses `start_latlng` and `end_latlng` when available.
3. **Perimeter Coverage / Alignment / Deviations** still use the decoded polyline, since we do not have full GPS point streams in the current Strava API response.
4. If Strava metadata is missing, fall back to polyline-derived calculations.

## Consequences

- UI shows accurate walk distance even when the polyline is truncated.
- Efficiency uses a reliable denominator, reducing false penalties from privacy zones.
- Some metrics (perimeter coverage, alignment) can still be slightly undercounted near the truncated edges.
- We should document that summary polyline is not a full GPS stream and can be truncated.

## Alternatives Considered

- Fetch full activity streams (`activities/{id}/streams`) to reconstruct exact GPS points.
  - Rejected for MVP: increased API complexity and rate-limit considerations.

## References

- PRD 001 §3.2, §3.3, §3.6
- ADR 003: Multi-Metric Completion Scoring

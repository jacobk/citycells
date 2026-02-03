# ADR 002: Exclusive Activity Matching & Single Walk Enclosure

**Date:** 2026-02-02
**Status:** Accepted

## Context
We are building a gamified "CityCells" app where users walk around the borders of Malmö's sub-areas. We need to decide how Strava activities (walks) are matched to these sub-areas to determine "completion".

Initially, a loose intersection check allowed:
1. One walk to match multiple adjacent areas.
2. Multiple partial walks to potentially sum up to a completed area (though the implementation was vague).

We identified issues where a single walk would falsely mark adjacent areas as green, and the progress tracking was inaccurate.

## Decision
We will implement an **Exclusive Activity Matching** and **Single Walk Enclosure** strategy with the following rules:

1.  **Single Walk Enclosure**: To mark a sub-area as "Completed", a **single** Strava activity must cover at least **75%** of the area's perimeter (within a 25m buffer). We will NOT aggregate multiple walks to achieve this threshold.
2.  **Exclusive Assignment**: Each Strava activity will be assigned to **at most one** sub-area.
    *   The system calculates the coverage percentage of a walk against all intersecting sub-areas.
    *   The walk is assigned *exclusively* to the sub-area where it has the **highest coverage percentage**, provided that percentage is greater than **50%** (the "registration tier").
    *   If a walk does not cover >50% of any area, it is not assigned to any area.

## Consequences
*   **Positive**: Prevents "gaming" the system where one long straight walk matches 5 adjacent areas.
*   **Positive**: Ensures "Green" status represents a true, single-effort achievement for that specific area.
*   **Negative**: Users might feel frustrated if a walk is "split" between two areas and counts for neither, although the >50% threshold mitigates this by forcing a clear winner.
*   **Technical**: Requires slightly more complex analysis (calculating all intersections before assignment) but fits within client-side performance budgets for < 200 activities.

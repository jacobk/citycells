# Analysis Engine

## Overview

The analysis engine calculates multi-metric scores for walks around Malmö's sub-areas. It evaluates how well a walk traces the border of an area and assigns quality tiers (Platinum/Gold/Silver/Bronze). The same pipeline can be re-run on cached walks via the [Re-Analysis](../features/re-analysis.md) feature (user-initiated), so scores stay correct when the algorithm or source data changes.

## User Stories

From [PRD 001](../PRD/001-mvp-mobile-walker.md):
- "As a user, I want to clearly see which areas I have completed and their quality tier"
- "As a user, I want to see a detailed score breakdown for each area"

## Implementation

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/analysis.ts` | Core metric calculations and scoring |
| `src/lib/db.ts` | Storage of analysis results (walk_analyses table) |
| `src/app/api/activities/streams/route.ts` | Fetch Strava streams for high-fidelity GPS |
| `src/components/Map/Map.tsx` | Streams-aware analysis orchestration |
| `src/lib/types/strava-streams.ts` | Stream type definitions |

### Metrics Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Walk Analysis                          │
│                                                             │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │ GPS Coordinates  │  │  Area Polygon    │                │
│  └────────┬─────────┘  └────────┬─────────┘                │
│           │                     │                           │
│           ▼                     ▼                           │
│  ┌────────────────────────────────────────┐                │
│  │         Metric Calculations            │                │
│  │                                        │                │
│  │  ┌─────────────────────────────────┐  │                │
│  │  │ 1. Perimeter Coverage (40%)    │  │                │
│  │  │ 2. Area Coverage (25%)         │  │                │
│  │  │ 3. Alignment Score (20%)       │  │                │
│  │  │ 4. Efficiency (15%)            │  │                │
│  │  └─────────────────────────────────┘  │                │
│  │                                        │                │
│  │  ┌─────────────────────────────────┐  │                │
│  │  │ Deviation Detection             │  │                │
│  │  └─────────────────────────────────┘  │                │
│  └────────────────────────────────────────┘                │
│                        │                                    │
│                        ▼                                    │
│  ┌────────────────────────────────────────┐                │
│  │    Quality Score (0.0 - 1.0)           │                │
│  │    Tier Assignment                     │                │
│  └────────────────────────────────────────┘                │
└─────────────────────────────────────────────────────────────┘
```

## Metric Details

### 1. Perimeter Coverage (Weight: 40%)

**Formula:** `covered_perimeter_length / total_perimeter_length`

**How it works:**
1. Create 25m buffer around area perimeter
2. Find intersection of walk path with buffer
3. Measure length of intersected segments
4. Divide by total perimeter length

**WHY 25m buffer:**
- GPS accuracy is typically 5-15m in urban areas
- Sidewalks may be offset from property boundaries
- Referenced in ADR 002

### 2. Area Coverage (Weight: 25%)

**Formula:** `enclosed_area_intersection / sub_area_total_area`

**Requirements:**
- Walk must form a closed loop (start/end within 100m)
- If open path: area_coverage = 0

**How it works:**
1. Check if walk is closed (start/end within 100m)
2. Convert walk coordinates to polygon by connecting end to start
3. Calculate intersection with sub-area polygon using `turf.intersect()`
4. Compute ratio of enclosed area to total area

**WHY 100m closure threshold:**
- Allows for GPS imprecision at start/end
- Still requires walker to return near starting point

**Strava Metadata Fix:**
The `summary_polyline` from Strava API is often truncated at the beginning and end (up to 200m missing). This caused false negatives in loop detection. The fix:
- Use Strava's `start_latlng` and `end_latlng` metadata for loop detection when available
- These values come from the full GPS stream and are more reliable
- Fallback to polyline coordinates if metadata is unavailable

### Strava Streams Integration (ADR 006)

**Primary GPS source:** Strava activity streams (`latlng`, `time`, `distance`) fetched per-activity and cached locally.

**WHY:** Summary polylines are truncated and low-density; streams provide high-fidelity coordinates for more accurate perimeter coverage, alignment, and deviation detection.

**Behavior:**
1. Attempt to load cached stream data from the local database.
2. If missing, fetch streams via `/api/activities/streams?id=ACTIVITY_ID`.
3. Use stream `latlng` as canonical coordinates for analysis.
4. Continue using Strava `distance` for total walk length to avoid undercounting.

**Caching:**
- Streams are stored in `walks.streams_json` with a `streams_fetched_at` marker.
- Cached streams are reused across sessions to reduce API usage.

### 3. Alignment Score (Weight: 20%)

**Formula:** `1 - min(RMSE / 50m, 1)`

**RMSE Calculation:**
```
RMSE = sqrt(sum(distance_to_border²) / n)
```

For each GPS point, compute perpendicular distance to nearest border segment.

**Additional Metrics (informational):**
- `max_deviation`: Worst-case deviation point
- `p90_deviation`: 90th percentile (robust to GPS glitches)

**WHY 50m normalization:**
- A walk averaging 50m from border gets alignment_score = 0
- Typical good walks are 5-15m from border (score 0.7-0.9)

### 4. Efficiency (Weight: 15%)

**Formula:** `border_aligned_length / total_walk_length`

**How it works:**
- Measure total walk distance
- Measure distance spent within 25m buffer of perimeter
- Compute ratio

**Purpose:** Penalizes unnecessary detours and backtracking.

**Strava privacy zones:**
Strava's `summary_polyline` can be truncated near start/end due to privacy/anonymization zones, which under-reports walk length. The analysis engine uses Strava's `distance` field (full GPS stream) for total walk length when available to keep efficiency and UI distance accurate.

## Quality Score Calculation

```typescript
quality_score = (
  0.40 × perimeter_coverage +
  0.25 × area_coverage +
  0.20 × alignment_score +
  0.15 × efficiency
)
```

**Weight Rationale (from ADR 003):**
- **Perimeter Coverage (40%)**: Primary goal—walk the border
- **Area Coverage (25%)**: Rewards closing the loop
- **Alignment (20%)**: Rewards staying close to border
- **Efficiency (15%)**: Minor penalty for detours

**Note:** Open paths (area_coverage = 0) can achieve max score of 0.75, sufficient for Silver tier.

## Tier System

| Tier | Score Range | Color | Hex |
|------|-------------|-------|-----|
| Platinum | ≥ 0.95 | Purple | `#a855f7` |
| Gold | ≥ 0.85 | Gold | `#eab308` |
| Silver | ≥ 0.70 | Silver | `#9ca3af` |
| Bronze | ≥ 0.50 | Bronze | `#cd7f32` |

**Completion Threshold:** Score ≥ 0.50 (Bronze) marks area as "completed".

## Deviation Detection

Detects "peninsula-shaped" detours where walker left the border.

### Algorithm

```
DEVIATION_THRESHOLD = 30m

for each point P in walk:
    distance = min_distance(P, border)
    
    if not in_deviation AND distance > 30m:
        in_deviation = true
        record start point
    
    if in_deviation AND distance <= 30m:
        in_deviation = false
        record deviation with metrics
```

### Deviation Metrics

| Metric | Description |
|--------|-------------|
| `border_gap` | Distance along border bypassed |
| `detour_distance` | Actual path length during deviation |
| `max_deviation` | Furthest point from border |
| `detour_ratio` | `detour_distance / border_gap` |
| `return_accuracy` | How close end is to start on border |

### Classification Heuristic

```typescript
if (detour_ratio >= 2.0 && return_accuracy < 50m) {
  classification = "obstacle_avoidance";
} else if (detour_ratio < 1.5) {
  classification = "shortcut";
} else {
  classification = "drift";
}
```

**WHY these thresholds:**
- `detour_ratio >= 2.0`: Walker took 2x+ longer path, likely avoiding something
- `return_accuracy < 50m`: Walker returned near where they left
- `detour_ratio < 1.5`: Took shorter path, likely a shortcut

## Magic Numbers Reference

| Value | Meaning | Source |
|-------|---------|--------|
| 25m | Perimeter buffer | ADR 002, GPS accuracy |
| 100m | Loop closure threshold | ADR 003 |
| 50m | RMSE normalization | ADR 003 |
| 30m | Deviation threshold | ADR 003 |
| 0.40/0.25/0.20/0.15 | Score weights | ADR 003 |
| 0.95/0.85/0.70/0.50 | Tier thresholds | ADR 003 |

## ADR References

- [ADR 002: Exclusive Activity Matching](../ADR/002-exclusive-activity-matching.md) - 25m buffer, exclusive assignment
- [ADR 003: Multi-Metric Completion Scoring](../ADR/003-multi-metric-completion-scoring.md) - Full scoring system
- [ADR 005: Strava Privacy Zones and Truncated Polylines](../ADR/005-strava-privacy-zones.md) - Data limitations and distance handling
- [ADR 006: Strava Activity Streams](../ADR/006-strava-activity-streams.md) - High-fidelity GPS source
- [ADR 007: Interactive Metrics Documentation](../ADR/007-interactive-metrics-documentation.md) - User-facing metric explanations

## Testing Infrastructure

A comprehensive test suite exists for the analysis engine in `src/__tests__/analysis/`:

- `real-activity.test.ts` - **103 tests** using all 11 real Strava activities against real area polygons. Covers loop detection, perimeter coverage, area coverage, alignment, efficiency, tier assignment, and deviations. Includes polyline truncation regression tests.
- `loop-detection.test.ts` - Unit tests for the 100m loop closure threshold
- `area-coverage.test.ts` - Unit tests for area coverage calculation with various scenarios

### Test Fixtures

All 11 `#malmödelområde` activities are exported as fixtures in `src/__tests__/fixtures/`:
- Activity fixtures contain base data (polyline, coordinates) plus high-fidelity GPS streams
- Area fixtures are GeoJSON `Feature<Polygon>` objects from `malmo_delomraden.geojson`
- Use `node scripts/export-all-fixtures.mjs` to re-export all fixtures (requires Strava token)
- See `src/__tests__/fixtures/README.md` for fixture format docs and current test results

### Running Tests

```bash
npm run test           # Watch mode
npm run test:run       # Single run
npm run test:ui        # Interactive UI
npm run test:coverage  # With coverage report
```

### Visualization Helpers

Test runs generate SVG visualizations in `src/__tests__/output/` showing:
- **Perimeter coverage**: 25m buffer zone highlighted, covered segments in green
- **Area coverage**: Walk-enclosed polygon, intersection with sub-area
- **Alignment**: Walk path color-coded by distance from border (green=close, red=far)

Use these to debug analysis issues and understand metric behavior.

## Displayed Metrics in UI

The AreaDetailsPanel shows these metrics for each completed area:

| Metric | User-Friendly Name | Description |
|--------|-------------------|-------------|
| Sub-area Circumference | — | Total perimeter length of the sub-area |
| Total Walk Length | — | Distance of the complete walk |
| Perimeter Walked | — | Length of walk within the 25m buffer |
| Walk vs Circumference | — | Difference (positive = detours, negative = efficient) |
| Enclosed Area | — | Area covered by the walk polygon |
| Loop Status | — | Whether start/end are within 100m |

### Score Breakdown Metrics

These metrics are clickable links to in-app documentation (see [Metrics Documentation](./metrics-documentation.md)):

| Internal Name | User-Friendly Name | Weight |
|---------------|-------------------|--------|
| Perimeter Coverage | **Border Traced** | 40% |
| Area Coverage | **Area Enclosed** | 25% |
| Alignment Score | **Path Precision** | 20% |
| Efficiency | **Route Efficiency** | 15% |

## Exemption-Adjusted Scoring

When users mark deviations as exempt (see [Exemption System](./exemption-system.md)), the quality score is recalculated to exclude those deviations:

- **`raw_quality_score`**: Original score calculated from all GPS points
- **`quality_score`**: Adjusted score after exemptions are applied (preferred for display)

The system automatically:
- Stores both scores in `walk_analyses` table
- Prefers `quality_score` when loading cached results (falls back to `raw_quality_score` if no exemptions)
- Selects best walk per area based on adjusted scores
- Updates `area_completions` with adjusted scores and tiers

**WHY:** This ensures displayed scores and tiers match what users see after applying exemptions, preventing score instability across page reloads.

## Current Limitations

1. **Performance with many points**: RMSE calculation is O(n × m) where n = walk points, m = perimeter segments
2. **Self-intersecting walks**: May cause issues with area coverage calculation
3. ~~**No persistence**~~ - ✅ Implemented: Analysis results cached in SQLite (see [Data Persistence](./data-persistence.md))
4. ~~**No exemption adjustment yet**~~ - ✅ Implemented: Exemptions adjust scores automatically

## Planned Improvements

1. **Spatial indexing** - Use R-tree for faster point-to-line distance queries
2. ~~**Debug visualization in app**~~ - ✅ See [Metrics Documentation](./metrics-documentation.md) for in-app D3 visualizations
3. ~~**Caching**~~ - ✅ Implemented: Results cached in SQLite database
4. ~~**Exemption-adjusted scores**~~ - ✅ Implemented: Scores automatically recalculate with exemptions

## Related Features

- [Metrics Documentation](./metrics-documentation.md) - In-app help system with interactive D3 visualizations explaining each metric

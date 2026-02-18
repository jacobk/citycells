# Analysis Engine

## Overview

The analysis engine calculates multi-metric scores for walks around Malmö's sub-areas. It evaluates how well a walk traces the border of an area and assigns quality tiers (Platinum/Gold/Silver/Bronze/Potato). The same pipeline can be re-run on cached walks via the [Re-Analysis](../features/re-analysis.md) feature (user-initiated), so scores stay correct when the algorithm or source data changes.

> **Update (2026-02-17):** The scoring system has been upgraded from binary 25m threshold to a 6-tier distance-based system. See [ADR 021](../ADR/021-tiered-distance-scoring.md) for full details. Phase 1 (core scoring logic) is complete.

## User Stories

From [PRD 001](../PRD/001-mvp-mobile-walker.md):
- "As a user, I want to clearly see which areas I have completed and their quality tier"
- "As a user, I want to see a detailed score breakdown for each area"

## Implementation

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/analysis.ts` | Core metric calculations and scoring (uses tiered scoring) |
| `src/lib/distance-tiers.ts` | **NEW:** 6-tier distance classification and weighted scoring |
| `src/lib/geo-distance.ts` | Distance-to-geometry utilities |
| `src/lib/tiers.ts` | Overall tier assignment (Platinum/Gold/Silver/Bronze/Potato) |
| `src/lib/db.ts` | Storage of analysis results (walk_analyses table) |
| `src/app/api/activities/streams/route.ts` | Fetch Strava streams for high-fidelity GPS |
| `src/components/Map/Map.tsx` | Streams-aware analysis orchestration |
| `src/lib/types/strava-streams.ts` | Stream type definitions |

### Metrics Overview

> **Implemented (Phase 1):** The new tiered scoring formula is active: Tiered Border Score (45%), Area Coverage (25%), Walk Focus (30%).

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
│  │  │ 1. Tiered Border Score (45%)   │  │  ← NEW (ADR 021)
│  │  │ 2. Area Coverage (25%)         │  │                │
│  │  │ 3. Walk Focus (30%)            │  │  ← Renamed    │
│  │  └─────────────────────────────────┘  │                │
│  │                                        │                │
│  │  ┌─────────────────────────────────┐  │                │
│  │  │ Distance Tier Classification    │  │  ← NEW (ADR 021)
│  │  │ Deviation Detection             │  │                │
│  │  └─────────────────────────────────┘  │                │
│  └────────────────────────────────────────┘                │
│                        │                                    │
│                        ▼                                    │
│  ┌────────────────────────────────────────┐                │
│  │    Quality Score (0.0 - 1.0)           │                │
│  │    Tier Assignment + Distribution      │  ← NEW output │
│  └────────────────────────────────────────┘                │
└─────────────────────────────────────────────────────────────┘
```

## Metric Details

### 1. Tiered Border Score (Weight: 45%) — NEW (ADR 021)

**Key Functions:**
- `assignDistanceTier(distanceMeters)` - Returns tier name and point value
- `calculateTieredBorderScore(walkCoordinates, boundaryLines)` - Returns weighted score, tier distribution, and per-segment data
- Located in `src/lib/distance-tiers.ts`

**Replaces:** Perimeter Coverage (40%) + Alignment Score (20%)

**Formula:** `Σ(tier_points × segment_length) / Σ(segment_length)`

**Distance Tiers:**

| Tier | Distance | Points |
|------|----------|--------|
| Platinum | ≤ 10m | 1.00 |
| Gold | ≤ 20m | 0.80 |
| Silver | ≤ 30m | 0.55 |
| Bronze | ≤ 40m | 0.30 |
| Potato | ≤ 50m | 0.10 |
| Missed | > 50m | 0.00 |

**How it works:**
1. For each walk segment, calculate midpoint
2. Find minimum distance from midpoint to any boundary line
3. Assign distance tier based on thresholds above
4. Weight contribution by segment length
5. Aggregate into single 0-1 score

**WHY tiered approach:**
- Rewards precision (walking at 5m scores higher than 24m)
- Provides graduated feedback instead of binary
- Captures both coverage AND precision in single metric
- See ADR 021 for detailed rationale

### 1-LEGACY. Perimeter Coverage (Weight: 40%) — SUPERSEDED

> **Note:** This metric is superseded by Tiered Border Score (ADR 021). Kept for reference.

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

### 4. Walk Focus (Weight: 30%) — RENAMED + REWEIGHTED (ADR 021)

**Implementation:** Uses existing `calculateEfficiency()` function. The value is stored as both `efficiency` (legacy) and `walkFocus` (new name) in `AnalysisMetrics`.

**Previously:** Efficiency (15%)

**Formula:** `border_aligned_length / total_walk_length`

**How it works:**
- Measure total walk distance
- Measure distance spent within qualifying tiers (≤50m from perimeter)
- Compute ratio

**Purpose:** Penalizes unnecessary detours and backtracking. Renamed to "Walk Focus" for clarity—measures what portion of your walk was actually tracing the boundary.

**Weight increase (15% → 30%):**
- With Tiered Border Score absorbing alignment, Walk Focus gets more weight
- Stronger incentive to avoid detours
- See ADR 021 for rationale

**Strava privacy zones:**
Strava's `summary_polyline` can be truncated near start/end due to privacy/anonymization zones, which under-reports walk length. The analysis engine uses Strava's `distance` field (full GPS stream) for total walk length when available to keep efficiency and UI distance accurate.

## Quality Score Calculation

**Key Functions:**
- `calculateTieredQualityScore(tieredBorderScore, areaCoverage, walkFocus)` - NEW formula (ADR 021)
- `calculateQualityScore(...)` - Legacy formula (kept for reference)
- Located in `src/lib/analysis.ts`

### NEW Formula (ADR 021) — ACTIVE

```typescript
quality_score = (
  0.45 × tiered_border_score +
  0.25 × area_coverage +
  0.30 × walk_focus
)
```

**Weight Rationale (from ADR 021):**
- **Tiered Border Score (45%)**: Captures both coverage AND precision
- **Area Coverage (25%)**: Rewards closing the loop (unchanged)
- **Walk Focus (30%)**: Penalizes detours more strongly

**Note:** Open paths (area_coverage = 0) can achieve max score of 0.75, sufficient for Silver tier.

### LEGACY Formula (ADR 003) — SUPERSEDED

```typescript
quality_score = (
  0.40 × perimeter_coverage +
  0.25 × area_coverage +
  0.20 × alignment_score +
  0.15 × efficiency
)
```

## Tier System

| Tier | Score Range | Color | Hex |
|------|-------------|-------|-----|
| Platinum | ≥ 0.95 | Purple | `#a855f7` |
| Gold | ≥ 0.85 | Gold | `#eab308` |
| Silver | ≥ 0.70 | Silver | `#9ca3af` |
| Bronze | ≥ 0.50 | Bronze | `#cd7f32` |
| Potato | < 0.50 | Brown | `#b8936d` |

**Completion Threshold:** Any matched walk marks area as "completed" (minimum Potato tier).

**Potato Tier (Added 2026-02-13):**
- Activities tagged with `#malmödelområde` that match a sub-area but receive very low scores (< 0.50)
- Ensures all user efforts count toward map progress, even with minimal coverage/quality
- Icon: 🥔 (potato emoji)
- Color: Light tan/brown to match potato theme and visually distinguish on map
- **WHY:** Example: The Ellstorp test walk has minimal perimeter coverage but should still appear as completed on the map to acknowledge user effort

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
| 10m/20m/30m/40m/50m | Distance tier thresholds | ADR 021 |
| 1.0/0.8/0.55/0.3/0.1/0 | Tier point values | ADR 021 |
| 100m | Loop closure threshold | ADR 003 |
| 30m | Deviation detection threshold | ADR 003 |
| 0.45/0.25/0.30 | Score weights (NEW) | ADR 021 |
| 0.95/0.85/0.70/0.50 | Overall tier thresholds | ADR 003, ADR 021 |
| < 0.50 | Potato tier threshold | ADR 003 |

### Legacy Values (Superseded)

| Value | Meaning | Source |
|-------|---------|--------|
| 25m | Binary perimeter buffer | ADR 002 (superseded by tiers) |
| 50m | RMSE normalization | ADR 003 (superseded by tiers) |
| 0.40/0.25/0.20/0.15 | Old score weights | ADR 003 (superseded) |

## ADR References

- [ADR 002: Exclusive Activity Matching](../ADR/002-exclusive-activity-matching.md) - Exclusive assignment rules
- [ADR 003: Multi-Metric Completion Scoring](../ADR/003-multi-metric-completion-scoring.md) - Deviation detection, exemption system (scoring formula superseded)
- [ADR 005: Strava Privacy Zones and Truncated Polylines](../ADR/005-strava-privacy-zones.md) - Data limitations and distance handling
- [ADR 006: Strava Activity Streams](../ADR/006-strava-activity-streams.md) - High-fidelity GPS source
- [ADR 007: Interactive Metrics Documentation](../ADR/007-interactive-metrics-documentation.md) - User-facing metric explanations
- **[ADR 021: Tiered Distance-Based Boundary Scoring](../ADR/021-tiered-distance-scoring.md)** - NEW: 6-tier distance scoring system

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
| Tiered Border Score | **Boundary Coverage** | 45% |
| Area Coverage | **Area Enclosed** | 25% |
| Efficiency | **Walk Focus** | 30% |

### Tier Distribution Display

**Implementation:** `src/components/AreaDetailsPanel/AreaDetailsPanel.tsx` (lines ~540-584)

Below the score breakdown, the AreaDetailsPanel displays a "Precision Breakdown" section showing the percentage of walk distance in each distance tier. Each tier is displayed with:
- Color swatch using `DISTANCE_TIER_COLORS` from `src/lib/design-tokens.ts`
- Tier name and threshold label (e.g., "Platinum (≤10m)")
- Progress bar showing percentage
- Numeric percentage value

This visualization shows users exactly where their quality score came from—how much of their walk was GPS-perfect (Platinum) vs. too far from the boundary (Missed).

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

# ADR 003: Multi-Metric Completion Scoring

**Date:** 2026-02-03
**Status:** Accepted
**Supersedes:** Partial update to ADR 002 (completion threshold changes from 75% to 50%)

## Context

ADR 002 established a simple completion model: a walk covering >75% of a sub-area's perimeter marks it as "Completed". However, this binary approach has limitations:

1. **Real-world obstacles**: Fences, highways, private property, and water may prevent walkers from following the exact border, unfairly penalizing good-faith attempts.
2. **No quality incentive**: Once "Completed", there's no motivation to improve the walk.
3. **No distinction**: A 76% coverage walk looks identical to a 99% coverage walk.
4. **Perimeter-only**: Doesn't capture whether the walker actually encircled the area.

We need a scoring system that:
- Marks areas as "done" even with obstacles (lower threshold)
- Incentivizes quality through visible scores and tiers
- Detects and handles obstacle-avoidance deviations
- Allows users to exempt unavoidable deviations

## Decision

We will implement a **Multi-Metric Completion Scoring** system with the following components:

### 1. Core Metrics

#### Metric 1: Perimeter Coverage (Recall)

```
perimeter_coverage = covered_perimeter_length / total_perimeter_length
```

- Uses existing 25m buffer approach from ADR 002
- Measures what percentage of the border was walked

#### Metric 2: Area Coverage (m²)

```
area_coverage = enclosed_area_intersection / sub_area_total_area
```

- Measures what percentage of the sub-area's interior is enclosed by the walk path
- Requires walk to form a closed polygon (start and end within 100m)
- If path is open (start/end > 100m apart): `area_coverage = 0`

**Calculation:**
1. Convert walk GPS points to a polygon by connecting last point to first
2. Calculate intersection with sub-area polygon using `turf.intersect()`
3. Compute ratio: `turf.area(intersection) / turf.area(subArea)`

#### Metric 3: Alignment Error (RMSE)

```
RMSE = sqrt(sum(distance_to_border²) / n)
```

- For each GPS point, compute perpendicular distance to nearest border segment
- Root Mean Square Error penalizes large deviations more than small ones
- Normalized to 0-1 scale: `alignment_score = 1 - min(RMSE / 50m, 1)`

#### Metric 4: Maximum Deviation

```
max_deviation = max(distance_to_border for each point)
```

- Identifies worst-case deviation point
- Informational metric (not in composite score)

#### Metric 5: 90th Percentile Deviation (P90)

```
p90_deviation = percentile(distances, 90)
```

- More robust than max (ignores GPS glitches)
- Informational metric (not in composite score)

#### Metric 6: Efficiency (Precision)

```
efficiency = border_aligned_length / total_walk_length
```

- Penalizes unnecessary detours
- Rewards walkers who stay focused on the border

### 2. Composite Quality Score

```
quality_score = (
  0.40 × perimeter_coverage +
  0.25 × area_coverage +
  0.20 × alignment_score +
  0.15 × efficiency
)
```

**Weight Rationale:**
- **Perimeter Coverage (40%)**: Primary goal—walk the border
- **Area Coverage (25%)**: Rewards closing the loop and encircling the area
- **Alignment (20%)**: Rewards staying close to the border
- **Efficiency (15%)**: Minor penalty for unnecessary detours

**Note:** Open paths (area_coverage = 0) can achieve max score of 0.75, sufficient for Silver tier.

### 3. Tier System

| Tier     | Score Range | Color   | Hex       |
|----------|-------------|---------|-----------|
| Platinum | ≥ 0.95      | Purple  | `#a855f7` |
| Gold     | ≥ 0.85      | Gold    | `#eab308` |
| Silver   | ≥ 0.70      | Silver  | `#9ca3af` |
| Bronze   | ≥ 0.50      | Bronze  | `#cd7f32` |

### 4. Completion Threshold Change

- **Old (ADR 002)**: >75% perimeter coverage required for "Completed"
- **New**: >50% perimeter coverage marks area as "Completed" (Bronze tier)
- **Rationale**: Real-world obstacles may prevent high coverage; any serious attempt should count

### 5. Deviation Detection Algorithm

Detects "peninsula-shaped" detours where the walker left the border to avoid an obstacle.

```
DEVIATION_THRESHOLD = 30m
deviations = []
in_deviation = false

for each point P in walk:
    distance = min_distance(P, border)
    
    if not in_deviation AND distance > DEVIATION_THRESHOLD:
        in_deviation = true
        deviation_start_index = previous_point_index
        deviation_start_border_point = nearest_border_point(previous_point)
    
    if in_deviation AND distance <= DEVIATION_THRESHOLD:
        in_deviation = false
        deviation_end_index = current_point_index
        deviation_end_border_point = nearest_border_point(P)
        
        record_deviation(
            start_index, end_index,
            start_border_point, end_border_point,
            max_deviation_in_segment,
            detour_distance,
            border_gap
        )
```

**Deviation Metrics:**
- `border_gap`: Distance along border between start and end points (border "skipped")
- `detour_distance`: Actual path length during deviation
- `max_deviation`: Furthest point from border during deviation
- `detour_ratio`: `detour_distance / border_gap`
- `return_accuracy`: Distance between deviation end and closest border point to start

**Classification Heuristic:**
```
if detour_ratio >= 2.0 AND return_accuracy < 50m:
    classification = "obstacle_avoidance"
elif detour_ratio < 1.5:
    classification = "shortcut"
else:
    classification = "drift"
```

### 6. Exemption System

Users can mark detected deviations as "exempt"—meaning the deviation was unavoidable.

**Exemption Effect on Scoring:**
1. Bypassed border segment treated as "walked" (interpolated)
2. Detour path excluded from RMSE calculation
3. Perimeter coverage increases by `border_gap` length
4. Efficiency calculation ignores detour distance

**Adjusted Score with Exemptions:**
```
effective_perimeter_coverage = (covered_length + Σ exempt_border_gaps) / perimeter_length
effective_walk_length = total_walk_length - Σ exempt_detour_distances
effective_rmse = rmse_excluding_exempt_segments

quality_score = (
  0.40 × effective_perimeter_coverage +
  0.25 × area_coverage +
  0.20 × (1 - min(effective_rmse / 50m, 1)) +
  0.15 × (border_aligned_length / effective_walk_length)
)
```

**Required Exemption Data:**
- `exemption_reason`: Required text (e.g., "Private property", "Highway", "Construction")
- `exempted_at`: Timestamp

## Consequences

### Positive
- **Fair to obstacles**: Walkers aren't penalized for unavoidable detours
- **Incentivizes quality**: Visible scores and tiers motivate better walks
- **Transparent**: Users see exactly why they got their score
- **Flexible**: Exemption system handles edge cases gracefully
- **Gamification-ready**: Tier system enables leaderboards, badges, achievements

### Negative
- **Complexity**: More metrics to calculate and store
- **Subjectivity**: Users decide what's "exempt" (potential for abuse)
- **Performance**: Deviation detection adds computation per walk

### Technical
- Requires SQLite storage for persisting analysis results and exemptions (see ADR 004)
- All calculations use Turf.js, fitting within client-side performance budgets
- Exemption changes trigger score recalculation

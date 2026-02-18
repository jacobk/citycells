# ADR 021: Tiered Distance-Based Boundary Scoring

**Date:** 2026-02-17
**Status:** Accepted
**Supersedes:** ADR 003 scoring formula sections (Sections 1, 2, 3 related to perimeter coverage and alignment)

## Context

The current scoring system (ADR 003) uses a binary 25-meter threshold for boundary matching:
- Segments within 25m = "covered" (full credit)
- Segments outside 25m = "not covered" (no credit)

This approach has significant limitations:

1. **No precision reward**: A walk at 5m from the boundary gets the same credit as one at 24m.
2. **User confusion**: "Border Traced" and "Route Efficiency" both use the 25m buffer but measure different things (boundary-centric vs walk-centric), leading to confusion.
3. **Binary feedback**: Route visualization shows only green (within buffer) or red (outside), providing no gradual feedback.
4. **Hidden quality**: Users achieve high scores without understanding that precision could be better.

User feedback indicates difficulty understanding:
- Why Border Traced and Route Efficiency differ
- What "good" walking actually looks like
- How to improve their scores

We need a scoring system that:
- Rewards precision with graduated tiers
- Provides clear visual feedback during and after walks
- Makes the relationship between distance and quality intuitive
- Maintains backward compatibility with existing tier system

## Decision

We will implement a **Tiered Distance-Based Boundary Scoring** system that replaces the binary 25m threshold with a 6-tier distance classification.

### 1. Distance Tiers

| Tier | Max Distance | Points | Description |
|------|-------------|--------|-------------|
| Platinum | ≤ 10m | 1.00 | GPS-perfect tracking |
| Gold | ≤ 20m | 0.80 | Excellent precision |
| Silver | ≤ 30m | 0.55 | Good precision |
| Bronze | ≤ 40m | 0.30 | Acceptable |
| Potato | ≤ 50m | 0.10 | Minimal credit |
| Missed | > 50m | 0.00 | Too far to count |

**Point values rationale (non-linear):**
- Platinum→Gold (-0.20): Small penalty; both excellent
- Gold→Silver (-0.25): Moderate; crossing excellence threshold
- Silver→Bronze (-0.25): Moderate; from good to marginal
- Bronze→Potato (-0.20): Small; both marginal
- Potato→Missed (-0.10): Full elimination

This creates an S-curve distribution that rewards precision while not over-penalizing typical GPS drift.

### 2. Per-Segment Distance Calculation

For each walk segment:

```
1. Calculate segment midpoint
2. Find minimum distance from midpoint to any perimeter line segment
3. Assign tier based on distance
4. Weight by segment length
```

**Pseudocode:**
```typescript
function calculateTieredBorderScore(walkCoords, areaPolygon) {
  const boundaryLines = polygonToPerimeterLines(areaPolygon);
  let totalLength = 0;
  let weightedPointsSum = 0;
  const tierDistribution = { platinum: 0, gold: 0, silver: 0, bronze: 0, potato: 0, missed: 0 };
  
  for (let i = 0; i < walkCoords.length - 1; i++) {
    const midpoint = segmentMidpoint(walkCoords[i], walkCoords[i + 1]);
    const distance = minDistanceToLines(midpoint, boundaryLines);
    const { tier, points } = assignDistanceTier(distance);
    const segmentLength = haversineDistance(walkCoords[i], walkCoords[i + 1]);
    
    totalLength += segmentLength;
    weightedPointsSum += points * segmentLength;
    tierDistribution[tier] += segmentLength;
  }
  
  return {
    score: weightedPointsSum / totalLength,  // 0.0 - 1.0
    tierDistribution,  // For UI display
  };
}
```

### 3. Aggregation Method: Weighted Mean by Segment Length

The tiered border score uses **segment-length-weighted mean**:

```
score = Σ(tier_points × segment_length) / Σ(segment_length)
```

**Why weighted mean over alternatives:**
- Simple mean: GPS point density varies, causing unfair weighting
- Median: Ignores magnitude of good/bad sections
- Percentile: Same issue as median
- **Weighted by length**: Fair—100m of Gold counts more than 10m of Gold

### 4. Updated Composite Quality Score

The tiered border score replaces both "Perimeter Coverage" and "Alignment Score":

```typescript
// OLD (ADR 003)
quality_score = (
  0.40 × perimeter_coverage +   // Binary 25m
  0.25 × area_coverage +
  0.20 × alignment_score +      // RMSE-based
  0.15 × efficiency
)

// NEW (ADR 021)
quality_score = (
  0.45 × tiered_border_score +  // Captures both coverage AND precision
  0.25 × area_coverage +
  0.30 × efficiency             // Renamed to "Walk Focus"
)
```

**Weight rationale:**
- **Tiered Border Score (45%)**: Now captures both "did you walk the border" AND "how close". Increased from 40% since it absorbs alignment.
- **Area Coverage (25%)**: Unchanged—rewards closing the loop.
- **Walk Focus (30%)**: Increased from 15%—stronger penalty for detours, clearer name.

**Note:** `alignment_score` (RMSE-based) is removed since tiered scoring inherently captures precision.

### 5. Metric Renaming for Clarity

| Old Name | New Name | Why |
|----------|----------|-----|
| Border Traced | **Boundary Coverage** | "What % of the edge did you walk" |
| Route Efficiency | **Walk Focus** | "What % of your walk was on the edge" |
| Perimeter Coverage (internal) | Tiered Border Score | Technical accuracy |

### 6. Tier Visualization Colors (Route Segments)

Per-segment route coloring replaces binary green/red:

| Tier | Color | Hex | Pattern |
|------|-------|-----|---------|
| Platinum | Deep Violet | `#7c3aed` | Solid |
| Gold | Vibrant Purple | `#a855f7` | Solid |
| Silver | Magenta Pink | `#d946ef` | Solid |
| Bronze | Soft Pink | `#f0abfc` | Solid |
| Potato | Warm Gray | `#a1a1aa` | Solid |
| Missed | Light Red | `#fca5a5` | Dashed |

**Design rationale:**
- Extends existing purple-pink gradient (ADR 010)
- Maintains visual hierarchy (darker = better)
- Colorblind accessible (no red-green dependency)
- Dashed pattern for "Missed" provides additional visual distinction

### 7. User-Facing Documentation Structure

New hamburger menu section:

```
Hamburger Menu
├── Areas
├── Stats
├── Achievements
└── How Scoring Works (NEW)
    ├── Understanding Metrics
    │   ├── Boundary Coverage
    │   ├── Area Enclosed
    │   └── Walk Focus
    └── Precision Tiers
        ├── What Are Tiers?
        ├── Tier Colors Explained
        └── Tips for Better Precision
```

**Location:** `/docs/scoring/` app routes with interactive explanations.

### 8. Score Display Updates

**Area Details Panel - Tier Distribution:**

```
Border Score: 72%
├── Platinum (≤10m): 15%  ████░░░░░░
├── Gold (≤20m):     28%  ███████░░░
├── Silver (≤30m):   22%  ██████░░░░
├── Bronze (≤40m):   12%  ███░░░░░░░
├── Potato (≤50m):    8%  ██░░░░░░░░
└── Missed (>50m):   15%  ████░░░░░░
```

### 9. GPS Accuracy Handling

To mitigate GPS noise:

1. **Minimum segment length**: Ignore segments < 5m
2. **Smoothing window**: Optional 3-5 point moving average
3. **Tier hysteresis**: Require sustained deviation before downgrading (prevents flicker in live mode)

### 10. Backward Compatibility

- Existing walks retain their stored scores; re-analysis required for new scoring
- Overall tier thresholds (Platinum ≥0.95, Gold ≥0.85, etc.) remain unchanged
- New score column added alongside old; migration path via re-analyze feature

## Consequences

### Positive

- **Precision incentive**: Clear motivation to walk closer to boundaries
- **Better feedback**: Graduated colors show quality in real-time
- **Reduced confusion**: Single "Border Score" replaces two overlapping metrics
- **Transparent**: Tier distribution shows exactly where quality was gained/lost
- **Gamification ready**: Achievements for Platinum precision become meaningful

### Negative

- **Recalculation required**: Existing walks need re-analysis for new scores
- **Slightly more complex**: 6 tiers vs binary threshold
- **Score changes**: Some users may see score changes (up or down) after migration

### Technical

- New `distance_tiers.ts` module for tier logic
- Updates to `analysis.ts` composite score calculation
- Updates to `route-visualization.ts` for multi-color rendering
- New documentation routes in `/docs/scoring/`
- Database migration to store tier distribution

### Maintainability

- **Consolidation**: Removes RMSE alignment metric (absorbed into tiered scoring)
- **Centralized thresholds**: All tier thresholds in single `distance_tiers.ts` file
- **Testing**: Tier assignment is pure function, easily unit tested
- **Modularity**: Tier coloring reusable across main map, mini-map, and live mode

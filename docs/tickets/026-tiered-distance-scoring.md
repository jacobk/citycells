# TICKET-026: Tiered Distance-Based Boundary Scoring

**Related:** ADR 021, PRD Sections 3.3, 3.4, 3.7, 3.10  
**Feature:** [Analysis Engine](../features/analysis-engine.md)  
**Status:** Ready for Implementation  
**Created:** 2026-02-17

## Context to Load

Files the implementation agent MUST read first:

1. `docs/ADR/021-tiered-distance-scoring.md` - Full specification of tiered scoring system, formulas, and colors
2. `docs/PRD/001-mvp-mobile-walker.md` Sections 3.3, 3.4, 3.7, 3.10 - Updated functional requirements
3. `docs/features/analysis-engine.md` - Current implementation details (marked with `[TO BE UPDATED]`)
4. `src/lib/analysis.ts` - Current scoring implementation
5. `src/lib/geo-distance.ts` - Current 25m threshold constant
6. `src/lib/design-tokens.ts` - Current route colors
7. `src/lib/route-visualization.ts` - Current binary route coloring

## Implementation Checklist

### 1. Create Distance Tier Module

Create `src/lib/distance-tiers.ts` with:
- `DISTANCE_TIER_THRESHOLDS` constant (10, 20, 30, 40, 50)
- `TIER_POINTS` constant (1.0, 0.8, 0.55, 0.3, 0.1, 0)
- `DistanceTier` type
- `assignDistanceTier(distanceMeters: number)` function
- `TieredSegment` interface

Reference: ADR 021, Section 1-2

### 2. Implement Tiered Border Score Calculation

Update `src/lib/analysis.ts`:
- Add `calculateTieredBorderScore()` function
- Return `{ score, tierDistribution, segments }`
- Use segment-length-weighted mean aggregation
- Integrate with existing `polygonToPerimeterLines()` and `distanceToLine()` functions

Reference: ADR 021, Section 2-3

### 3. Update Composite Score Formula

Update `src/lib/analysis.ts`:
- Change `SCORE_WEIGHTS` to new values (0.45, 0.25, 0.30)
- Remove `alignment_score` from calculation
- Rename efficiency references to "walk_focus" in code comments
- Update `analyzeWalk()` to use `tiered_border_score`

Reference: ADR 021, Section 4

### 4. Update AnalysisMetrics Interface

Update `src/lib/analysis.ts`:
- Add `tieredBorderScore: number`
- Add `tierDistribution: Record<DistanceTier, number>`
- Keep legacy fields for backward compatibility during transition

### 5. Add Tier Visualization Colors

Update `src/lib/design-tokens.ts`:
- Add `DISTANCE_TIER_COLORS` constant with 6 tier colors
- Add `getRouteSegmentColorByTier(distanceMeters: number)` function
- Keep legacy `ROUTE_DEVIATION_COLORS` for reference

Reference: ADR 021, Section 6

### 6. Update Route Visualization

Update `src/lib/route-visualization.ts`:
- Modify `prepareDeviationColoredRoute()` to use tiered colors
- Add dashed pattern support for "Missed" tier
- Ensure segments group correctly for performance

### 7. Update Score Display UI

Update `src/components/AreaDetailsPanel/AreaDetailsPanel.tsx`:
- Update metric names (Border Traced → Boundary Coverage, Route Efficiency → Walk Focus)
- Update weights displayed (40%/25%/20%/15% → 45%/25%/30%)
- Add tier distribution display with progress bars

### 8. Add "How Scoring Works" Menu Item

Update hamburger menu component:
- Add "How Scoring Works" option
- Route to new `/docs/scoring/` pages

### 9. Create Scoring Documentation Pages

Create documentation routes:
- `/docs/scoring/index` - Overview
- `/docs/scoring/precision-tiers` - Tier explanation with interactive slider
- Update existing metric docs for new names/formulas

### 10. Update Database Schema

Add tier distribution storage:
- Add `tier_distribution` JSON column to `walk_analyses` table
- Ensure backward compatibility with existing data

## Maintainability

Before implementing, review for:

- [x] **Refactor opportunity?** Remove RMSE alignment calculation (absorbed into tiers)
- [x] **DRY check** - Centralize all tier thresholds in `distance-tiers.ts`
- [x] **Modularity** - Tier assignment is pure function, easily testable
- [x] **Debt impact** - Reduces complexity by removing overlapping metrics

**Specific refactoring tasks:**
- Remove or deprecate `calculateAlignmentError()` RMSE logic (keep if needed for debug/info only)
- Consolidate route coloring logic to use single tier-based approach
- Consider extracting tier colors into design tokens for reuse across components

## Testing Requirements

**Reference:** [AGENTS.md Section 2](../../AGENTS.md#2-build-verification-checklist-required), [ADR 020](../ADR/020-agent-build-verification.md)

### Unit Tests Required

Tests are REQUIRED for these new/modified functions:

| Function | Test File | Test Cases |
|----------|-----------|------------|
| `assignDistanceTier()` | `src/lib/__tests__/distance-tiers.test.ts` | Boundary values (10, 20, 30, 40, 50), edge cases (0, 51, 100) |
| `calculateTieredBorderScore()` | `src/lib/__tests__/distance-tiers.test.ts` | Simple path, mixed tiers, all missed, all platinum |
| `getRouteSegmentColorByTier()` | `src/lib/__tests__/design-tokens.test.ts` | Each tier returns correct color |

### Existing Test Updates

- Update `src/__tests__/analysis/real-activity.test.ts` to verify new scoring formula produces expected results
- Scores will change; update expected values based on new formula

### Verification Checklist

Implementation agent MUST run before marking complete:
```bash
npm run lint   # Must pass
npm run build  # Must pass
npm run test   # Must pass
```

## Acceptance Criteria

- [ ] Distance tier calculation produces correct tier for each threshold value
- [ ] Tiered border score aggregates correctly using segment-length weighting
- [ ] Composite quality score uses new weights (0.45, 0.25, 0.30)
- [ ] Route visualization shows 6 distinct colors based on distance tier
- [ ] "Missed" segments render with dashed pattern
- [ ] Score breakdown panel shows updated metric names and weights
- [ ] Tier distribution displays with progress bars in details panel
- [ ] "How Scoring Works" menu item opens documentation
- [ ] All existing walks can be re-analyzed to get new scores
- [ ] All unit tests pass
- [ ] Build completes without errors

## Files to Modify

| File | Change |
|------|--------|
| NEW: `src/lib/distance-tiers.ts` | Tier constants, types, and `assignDistanceTier()` function |
| `src/lib/analysis.ts` | Add tiered scoring, update weights, modify `AnalysisMetrics` interface |
| `src/lib/design-tokens.ts` | Add `DISTANCE_TIER_COLORS` and tier color function |
| `src/lib/route-visualization.ts` | Use tiered colors instead of binary green/red |
| `src/components/AreaDetailsPanel/AreaDetailsPanel.tsx` | Update metric names, weights, add tier distribution |
| `src/components/HamburgerMenu/HamburgerMenu.tsx` | Add "How Scoring Works" menu item |
| NEW: `src/app/docs/scoring/page.tsx` | Scoring documentation index |
| NEW: `src/app/docs/scoring/precision-tiers/page.tsx` | Tier explanation page |
| `src/lib/db.ts` | Add tier_distribution column to walk_analyses |
| NEW: `src/lib/__tests__/distance-tiers.test.ts` | Unit tests for tier functions |
| `src/__tests__/analysis/real-activity.test.ts` | Update expected scores for new formula |
| `docs/features/analysis-engine.md` | Update `[TO BE UPDATED]` sections with actual code references |

## Notes

- Do NOT duplicate ADR/PRD content - reference them
- Existing scores will change after re-analysis; this is expected
- Keep backward compatibility - existing data should still load
- Consider adding a migration prompt to re-analyze all walks after deployment
- The dashed pattern for "Missed" segments may require Leaflet `dashArray` option

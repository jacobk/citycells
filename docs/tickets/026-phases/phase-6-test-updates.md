# Phase 6: Test Updates & Score Impact Analysis

**Parent Ticket:** [TICKET-026](../026-tiered-distance-scoring.md)  
**Priority:** High  
**Estimated Complexity:** Medium

## Overview

This phase updates the test suite to work with the new scoring formula and provides a comprehensive analysis showing how scores change for all 11 real activity test fixtures. This directly addresses the requirement to "understand how the scoring impacts all existing walks."

## Context Files to Read First

1. `docs/ADR/021-tiered-distance-scoring.md` - New scoring formula
2. `src/__tests__/analysis/real-activity.test.ts` - Existing test suite (103 tests)
3. `src/__tests__/fixtures/README.md` - Test fixture documentation
4. `src/lib/analysis.ts` - Updated scoring implementation (from Phase 1)
5. `src/lib/distance-tiers.ts` - Tiered scoring functions (from Phase 1)

## Prerequisites

- **Phase 1 must be complete** (new scoring functions implemented)

## Tasks

### Task 6.1: Create Score Comparison Utility

Create `src/__tests__/utils/score-comparison.ts`:

```typescript
/**
 * Score Comparison Utility
 * 
 * Compares old (ADR 003) vs new (ADR 021) scoring formulas
 * to show impact of the tiered scoring change.
 */

import type { FullAnalysisResult } from '@/lib/analysis';

export interface ScoreComparison {
  activityName: string;
  activityId: number;
  
  // Old formula (ADR 003)
  oldScore: number;
  oldTier: string;
  oldComponents: {
    perimeterCoverage: number;
    areaCoverage: number;
    alignment: number;
    efficiency: number;
  };
  
  // New formula (ADR 021)
  newScore: number;
  newTier: string;
  newComponents: {
    tieredBorder: number;
    areaCoverage: number;
    walkFocus: number;
  };
  
  // Delta
  scoreDelta: number;
  tierChanged: boolean;
}

/**
 * Calculate score using the OLD formula (ADR 003).
 * Used for comparison purposes only.
 */
export function calculateOldScore(
  perimeterCoverage: number,
  areaCoverage: number,
  alignmentScore: number,
  efficiency: number
): number {
  return (
    0.40 * perimeterCoverage +
    0.25 * areaCoverage +
    0.20 * alignmentScore +
    0.15 * efficiency
  );
}

/**
 * Format comparison table for console output.
 */
export function formatComparisonTable(comparisons: ScoreComparison[]): string {
  const header = `
┌───────────────────┬───────────┬───────────┬─────────┬────────────┐
│ Activity          │ Old Score │ New Score │ Change  │ Tier       │
├───────────────────┼───────────┼───────────┼─────────┼────────────┤`;

  const rows = comparisons.map(c => {
    const name = c.activityName.padEnd(17).slice(0, 17);
    const oldScore = `${(c.oldScore * 100).toFixed(1)}%`.padStart(9);
    const newScore = `${(c.newScore * 100).toFixed(1)}%`.padStart(9);
    const delta = `${c.scoreDelta >= 0 ? '+' : ''}${(c.scoreDelta * 100).toFixed(1)}%`.padStart(7);
    const tier = c.tierChanged 
      ? `${c.oldTier}→${c.newTier}`.padEnd(10)
      : c.newTier.padEnd(10);
    return `│ ${name} │ ${oldScore} │ ${newScore} │ ${delta} │ ${tier} │`;
  });

  const footer = `└───────────────────┴───────────┴───────────┴─────────┴────────────┘`;

  return [header, ...rows, footer].join('\n');
}
```

### Task 6.2: Add Comparison Test to `real-activity.test.ts`

Add a new describe block at the end of the file:

```typescript
// ============================================
// Score Impact Analysis (ADR 003 → ADR 021)
// ============================================

describe('Score Impact Analysis: Old vs New Formula', () => {
  const comparisons: ScoreComparison[] = [];

  // Run analysis on all activities and collect comparisons
  for (const config of ALL_ACTIVITIES) {
    const { result } = runAnalysis(config);
    const m = result.metrics;

    // Calculate old score using legacy formula
    const oldScore = calculateOldScore(
      m.perimeterCoveragePercent,
      m.areaCoveragePercent,
      m.alignmentScore,
      m.efficiency
    );
    const oldTier = assignTierFromScore(oldScore); // Use old thresholds

    comparisons.push({
      activityName: config.name,
      activityId: config.id,
      oldScore,
      oldTier,
      oldComponents: {
        perimeterCoverage: m.perimeterCoveragePercent,
        areaCoverage: m.areaCoveragePercent,
        alignment: m.alignmentScore,
        efficiency: m.efficiency,
      },
      newScore: m.rawQualityScore,
      newTier: m.tier || 'none',
      newComponents: {
        tieredBorder: m.tieredBorderScore,
        areaCoverage: m.areaCoveragePercent,
        walkFocus: m.walkFocus,
      },
      scoreDelta: m.rawQualityScore - oldScore,
      tierChanged: (m.tier || 'none') !== oldTier,
    });
  }

  it('should output score comparison table', () => {
    console.log('\n\n========================================');
    console.log('SCORE IMPACT ANALYSIS: ADR 003 → ADR 021');
    console.log('========================================\n');
    console.log(formatComparisonTable(comparisons));
    console.log('\n');

    // Summary statistics
    const avgDelta = comparisons.reduce((sum, c) => sum + c.scoreDelta, 0) / comparisons.length;
    const tierChanges = comparisons.filter(c => c.tierChanged).length;
    const improvements = comparisons.filter(c => c.scoreDelta > 0).length;
    const declines = comparisons.filter(c => c.scoreDelta < 0).length;

    console.log('Summary:');
    console.log(`  Average score change: ${avgDelta >= 0 ? '+' : ''}${(avgDelta * 100).toFixed(2)}%`);
    console.log(`  Tier changes: ${tierChanges} of ${comparisons.length}`);
    console.log(`  Scores improved: ${improvements}`);
    console.log(`  Scores declined: ${declines}`);
    console.log('\n');

    // This test always passes - it's for information only
    expect(true).toBe(true);
  });

  it('should show detailed breakdown for each activity', () => {
    for (const c of comparisons) {
      console.log(`\n--- ${c.activityName} (${c.activityId}) ---`);
      console.log('Old formula (ADR 003):');
      console.log(`  Perimeter Coverage: ${(c.oldComponents.perimeterCoverage * 100).toFixed(1)}% × 40% = ${(c.oldComponents.perimeterCoverage * 0.40 * 100).toFixed(1)}%`);
      console.log(`  Area Coverage:      ${(c.oldComponents.areaCoverage * 100).toFixed(1)}% × 25% = ${(c.oldComponents.areaCoverage * 0.25 * 100).toFixed(1)}%`);
      console.log(`  Alignment:          ${(c.oldComponents.alignment * 100).toFixed(1)}% × 20% = ${(c.oldComponents.alignment * 0.20 * 100).toFixed(1)}%`);
      console.log(`  Efficiency:         ${(c.oldComponents.efficiency * 100).toFixed(1)}% × 15% = ${(c.oldComponents.efficiency * 0.15 * 100).toFixed(1)}%`);
      console.log(`  TOTAL:              ${(c.oldScore * 100).toFixed(1)}% → ${c.oldTier}`);
      
      console.log('New formula (ADR 021):');
      console.log(`  Tiered Border:      ${(c.newComponents.tieredBorder * 100).toFixed(1)}% × 45% = ${(c.newComponents.tieredBorder * 0.45 * 100).toFixed(1)}%`);
      console.log(`  Area Coverage:      ${(c.newComponents.areaCoverage * 100).toFixed(1)}% × 25% = ${(c.newComponents.areaCoverage * 0.25 * 100).toFixed(1)}%`);
      console.log(`  Walk Focus:         ${(c.newComponents.walkFocus * 100).toFixed(1)}% × 30% = ${(c.newComponents.walkFocus * 0.30 * 100).toFixed(1)}%`);
      console.log(`  TOTAL:              ${(c.newScore * 100).toFixed(1)}% → ${c.newTier}`);
      
      console.log(`Change: ${c.scoreDelta >= 0 ? '+' : ''}${(c.scoreDelta * 100).toFixed(1)}%${c.tierChanged ? ' (TIER CHANGED)' : ''}`);
    }

    expect(true).toBe(true);
  });
});
```

### Task 6.3: Update Expected Values in Existing Tests

The existing tests have hardcoded expected thresholds. These need to be updated based on the new formula results.

**Process:**
1. Run tests with `npm run test:run -- --reporter=verbose`
2. Note which tests fail and their new actual values
3. Update `expected` object in `ALL_ACTIVITIES` array with new thresholds

**Example update:**
```typescript
// Before (old formula expectations)
{
  name: 'Håkanstorp',
  expected: {
    minQuality: 0.95,  // Based on old formula
    tier: 'platinum',
    // ...
  },
}

// After (new formula expectations)
{
  name: 'Håkanstorp',
  expected: {
    minQuality: 0.XX,  // Update based on actual new formula result
    tier: 'platinum',  // May or may not change
    // ...
  },
}
```

**Note:** Run the comparison test first to see all new scores, then update thresholds.

### Task 6.4: Add Tier Distribution Tests

Add tests verifying tier distribution is calculated correctly:

```typescript
describe('Tier Distribution', () => {
  for (const config of ALL_ACTIVITIES) {
    it(`${config.name} should have tier distribution summing to ~100%`, () => {
      const { result } = runAnalysis(config);
      const dist = result.metrics.tierDistribution;
      
      const total = Object.values(dist).reduce((sum, val) => sum + val, 0);
      
      // Should sum to 1.0 (100%) within floating point tolerance
      expect(total).toBeCloseTo(1.0, 2);
    });
  }
});
```

## Expected Output Format

When running `npm run test`, the comparison analysis should output:

```
========================================
SCORE IMPACT ANALYSIS: ADR 003 → ADR 021
========================================

┌───────────────────┬───────────┬───────────┬─────────┬────────────┐
│ Activity          │ Old Score │ New Score │ Change  │ Tier       │
├───────────────────┼───────────┼───────────┼─────────┼────────────┤
│ Håkanstorp        │    95.2%  │    93.1%  │  -2.1%  │ platinum   │
│ Fågelbacken       │    94.0%  │    91.5%  │  -2.5%  │ gold       │
│ Hästhagen         │    93.0%  │    90.8%  │  -2.2%  │ gold       │
│ ...               │           │           │         │            │
└───────────────────┴───────────┴───────────┴─────────┴────────────┘

Summary:
  Average score change: -1.85%
  Tier changes: 2 of 11
  Scores improved: 3
  Scores declined: 8
```

## Acceptance Criteria

- [ ] Score comparison utility created and exported
- [ ] Comparison test outputs formatted table to console
- [ ] Detailed breakdown shows component contributions for each formula
- [ ] Summary statistics calculated (avg delta, tier changes, improvements/declines)
- [ ] Expected values in ALL_ACTIVITIES updated for new formula
- [ ] All existing tests pass with updated thresholds
- [ ] Tier distribution tests verify sum to 100%
- [ ] Test output clearly shows impact of formula change

## Verification

```bash
npm run test:run -- --reporter=verbose  # See full output
npm run test                            # All tests pass
```

## Dependencies

- Phase 1 must be complete (new scoring functions)

## Notes

- The comparison tests are primarily for information - they help you understand the impact
- Some tier changes are expected - the new formula rewards precision differently
- Keep a copy of the comparison output for documentation/changelog
- The old formula calculation is for comparison only - it's not used in production
- This phase is crucial for validating the scoring change before deploying

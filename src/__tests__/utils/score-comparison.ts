/**
 * Score Comparison Utilities
 * 
 * WHY: Provides tools to compare ADR 003 (legacy) vs ADR 021 (tiered) scoring.
 * This helps understand how the scoring change impacts existing walks.
 * 
 * @see docs/ADR/003-multi-metric-completion-scoring.md - Legacy formula
 * @see docs/ADR/021-tiered-distance-scoring.md - New tiered formula
 */

import { assignTier, type Tier } from '@/lib/tiers';

// ============================================
// Types
// ============================================

/**
 * Non-null tier type for comparison purposes.
 * WHY: All test activities have scores > 0, so null tier isn't expected.
 */
type NonNullTier = Exclude<Tier, null>;

/**
 * Score comparison for a single activity.
 */
export interface ScoreComparison {
  name: string;
  activityId: number;
  oldScore: number;
  newScore: number;
  delta: number;
  percentChange: number;
  oldTier: NonNullTier;
  newTier: NonNullTier;
  tierChanged: boolean;
  // Component scores for detailed comparison
  components: {
    perimeterCoverage: number;
    areaCoverage: number;
    alignment: number;
    efficiency: number;
    tieredBorderScore: number;
  };
}

/**
 * Summary statistics for score comparisons.
 */
export interface ComparisonSummary {
  totalActivities: number;
  avgDelta: number;
  maxImprovement: number;
  maxDecline: number;
  tierChanges: {
    upgrades: number;
    downgrades: number;
    same: number;
  };
  byOldTier: Record<NonNullTier, { count: number; avgDelta: number }>;
}

// ============================================
// Legacy Scoring Formula (ADR 003)
// ============================================

/**
 * Legacy score weights from ADR 003.
 * 
 * WHY: Preserved here for comparison analysis.
 * The old formula used separate perimeter coverage and alignment metrics.
 */
const LEGACY_WEIGHTS = {
  perimeterCoverage: 0.40,
  areaCoverage: 0.25,
  alignment: 0.20,
  efficiency: 0.15,
} as const;

/**
 * Calculate quality score using legacy ADR 003 formula.
 * 
 * WHY: This allows us to compare what scores would have been under the old
 * system. The legacy formula had separate perimeter coverage (40%) and
 * alignment (20%) components that are now merged into tiered border score.
 * 
 * @param perimeterCoverage - Perimeter coverage (0-1), binary 25m threshold
 * @param areaCoverage - Area enclosed as percentage of total (0-1)
 * @param alignmentScore - RMSE-based alignment (0-1, normalized to 50m)
 * @param efficiency - Border-aligned distance / total walk distance (0-1)
 */
export function calculateOldScore(
  perimeterCoverage: number,
  areaCoverage: number,
  alignmentScore: number,
  efficiency: number
): { score: number; tier: Tier } {
  const score = 
    LEGACY_WEIGHTS.perimeterCoverage * perimeterCoverage +
    LEGACY_WEIGHTS.areaCoverage * areaCoverage +
    LEGACY_WEIGHTS.alignment * alignmentScore +
    LEGACY_WEIGHTS.efficiency * efficiency;
  
  return { score, tier: assignTier(score) };
}

// ============================================
// Comparison Utilities
// ============================================

/**
 * Create a comparison record between old and new scores.
 */
export function createComparison(
  name: string,
  activityId: number,
  components: ScoreComparison['components'],
  newScore: number
): ScoreComparison {
  const { score: oldScore, tier: oldTier } = calculateOldScore(
    components.perimeterCoverage,
    components.areaCoverage,
    components.alignment,
    components.efficiency
  );
  
  const newTier = assignTier(newScore);
  const delta = newScore - oldScore;
  const percentChange = oldScore > 0 ? (delta / oldScore) * 100 : 0;
  
  // WHY: Test activities always have scores > 0, so null tier shouldn't occur.
  // This assertion ensures type safety while handling the theoretical edge case.
  if (!oldTier || !newTier) {
    throw new Error(`Unexpected null tier for ${name}: oldTier=${oldTier}, newTier=${newTier}`);
  }
  
  return {
    name,
    activityId,
    oldScore,
    newScore,
    delta,
    percentChange,
    oldTier,
    newTier,
    tierChanged: oldTier !== newTier,
    components,
  };
}

/**
 * Calculate summary statistics from comparisons.
 */
export function calculateSummary(comparisons: ScoreComparison[]): ComparisonSummary {
  if (comparisons.length === 0) {
    return {
      totalActivities: 0,
      avgDelta: 0,
      maxImprovement: 0,
      maxDecline: 0,
      tierChanges: { upgrades: 0, downgrades: 0, same: 0 },
      byOldTier: {} as ComparisonSummary['byOldTier'],
    };
  }

  // Calculate deltas
  const deltas = comparisons.map(c => c.delta);
  const avgDelta = deltas.reduce((a, b) => a + b, 0) / deltas.length;
  const maxImprovement = Math.max(...deltas);
  const maxDecline = Math.min(...deltas);

  // Count tier changes
  const tierOrder: NonNullTier[] = ['platinum', 'gold', 'silver', 'bronze', 'potato'];
  let upgrades = 0, downgrades = 0, same = 0;
  
  for (const c of comparisons) {
    const oldIdx = tierOrder.indexOf(c.oldTier);
    const newIdx = tierOrder.indexOf(c.newTier);
    if (newIdx < oldIdx) upgrades++;
    else if (newIdx > oldIdx) downgrades++;
    else same++;
  }

  // Group by old tier
  const byOldTier = {} as ComparisonSummary['byOldTier'];
  for (const tier of tierOrder) {
    const tierComparisons = comparisons.filter(c => c.oldTier === tier);
    if (tierComparisons.length > 0) {
      const tierDeltas = tierComparisons.map(c => c.delta);
      byOldTier[tier] = {
        count: tierComparisons.length,
        avgDelta: tierDeltas.reduce((a, b) => a + b, 0) / tierDeltas.length,
      };
    }
  }

  return {
    totalActivities: comparisons.length,
    avgDelta,
    maxImprovement,
    maxDecline,
    tierChanges: { upgrades, downgrades, same },
    byOldTier,
  };
}

// ============================================
// Formatting Utilities
// ============================================

/**
 * Format a percentage value with sign indicator.
 */
function formatDelta(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${(value * 100).toFixed(1)}%`;
}

/**
 * Pad a string to a fixed width.
 */
function pad(str: string, width: number, align: 'left' | 'right' | 'center' = 'left'): string {
  const padding = width - str.length;
  if (padding <= 0) return str.slice(0, width);
  
  switch (align) {
    case 'right':
      return ' '.repeat(padding) + str;
    case 'center':
      const leftPad = Math.floor(padding / 2);
      const rightPad = padding - leftPad;
      return ' '.repeat(leftPad) + str + ' '.repeat(rightPad);
    default:
      return str + ' '.repeat(padding);
  }
}

/**
 * Format comparison table for console output.
 * 
 * WHY: Provides clear visual summary of scoring impact across all activities.
 * 
 * @example
 * ========================================
 * SCORE IMPACT ANALYSIS: ADR 003 → ADR 021
 * ========================================
 * 
 * | Activity      | Old Score | New Score | Change  | Old Tier | New Tier |
 * |---------------|-----------|-----------|---------|----------|----------|
 * | Hakanstorp    |    96.7%  |    97.2%  |  +0.5%  | platinum | platinum |
 * | ...           |           |           |         |          |          |
 */
export function formatComparisonTable(comparisons: ScoreComparison[]): string {
  const lines: string[] = [];
  
  // Header
  lines.push('');
  lines.push('========================================');
  lines.push('SCORE IMPACT ANALYSIS: ADR 003 → ADR 021');
  lines.push('========================================');
  lines.push('');
  
  // Column widths
  const cols = {
    activity: 17,
    oldScore: 11,
    newScore: 11,
    change: 9,
    oldTier: 10,
    newTier: 10,
  };
  
  // Table header
  const header = [
    pad('Activity', cols.activity),
    pad('Old Score', cols.oldScore, 'right'),
    pad('New Score', cols.newScore, 'right'),
    pad('Change', cols.change, 'right'),
    pad('Old Tier', cols.oldTier, 'center'),
    pad('New Tier', cols.newTier, 'center'),
  ].join(' | ');
  
  const separator = [
    '-'.repeat(cols.activity),
    '-'.repeat(cols.oldScore),
    '-'.repeat(cols.newScore),
    '-'.repeat(cols.change),
    '-'.repeat(cols.oldTier),
    '-'.repeat(cols.newTier),
  ].join('-+-');
  
  lines.push(`| ${header} |`);
  lines.push(`|-${separator}-|`);
  
  // Data rows
  for (const c of comparisons) {
    const tierChangeIndicator = c.tierChanged 
      ? (c.newTier === 'platinum' || comparisons.indexOf(c) < comparisons.length - 1 ? ' *' : ' *')
      : '';
    
    const row = [
      pad(c.name, cols.activity),
      pad(`${(c.oldScore * 100).toFixed(1)}%`, cols.oldScore, 'right'),
      pad(`${(c.newScore * 100).toFixed(1)}%`, cols.newScore, 'right'),
      pad(formatDelta(c.delta), cols.change, 'right'),
      pad(c.oldTier, cols.oldTier, 'center'),
      pad(c.newTier + tierChangeIndicator, cols.newTier, 'center'),
    ].join(' | ');
    
    lines.push(`| ${row} |`);
  }
  
  lines.push('');
  lines.push('* = tier changed from ADR 003 to ADR 021');
  lines.push('');
  
  return lines.join('\n');
}

/**
 * Format summary statistics for console output.
 */
export function formatSummaryStats(summary: ComparisonSummary): string {
  const lines: string[] = [];
  
  lines.push('----------------------------------------');
  lines.push('SUMMARY STATISTICS');
  lines.push('----------------------------------------');
  lines.push('');
  lines.push(`Total Activities: ${summary.totalActivities}`);
  lines.push(`Average Score Change: ${formatDelta(summary.avgDelta)}`);
  lines.push(`Max Improvement: ${formatDelta(summary.maxImprovement)}`);
  lines.push(`Max Decline: ${formatDelta(summary.maxDecline)}`);
  lines.push('');
  lines.push('Tier Changes:');
  lines.push(`  Upgrades:   ${summary.tierChanges.upgrades}`);
  lines.push(`  Downgrades: ${summary.tierChanges.downgrades}`);
  lines.push(`  Same Tier:  ${summary.tierChanges.same}`);
  lines.push('');
  
  // Per-tier breakdown
  const tiers: NonNullTier[] = ['platinum', 'gold', 'silver', 'bronze', 'potato'];
  lines.push('By Original Tier:');
  for (const tier of tiers) {
    const data = summary.byOldTier[tier];
    if (data) {
      lines.push(`  ${pad(tier, 8)}: ${data.count} activities, avg change ${formatDelta(data.avgDelta)}`);
    }
  }
  lines.push('');
  
  return lines.join('\n');
}

/**
 * Format complete comparison report.
 */
export function formatComparisonReport(comparisons: ScoreComparison[]): string {
  const summary = calculateSummary(comparisons);
  return formatComparisonTable(comparisons) + formatSummaryStats(summary);
}

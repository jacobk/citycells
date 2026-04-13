/**
 * CityCells Exemption Service (IndexedDB)
 *
 * Manages exemptions for detected deviations and recalculates scores.
 * See ADR 003 section 6 for exemption system design.
 *
 * WHY: Replaces the sql.js implementation with async IndexedDB operations.
 * All functions are now async. Score recalculation uses a multi-store
 * transaction for atomicity. See ADR 026.
 *
 * @module exemptions
 */

import {
  get,
  put,
  getAllFromIndex,
  openTransaction,
  txGet,
  txGetAllFromIndex,
  txPut,
  txDone,
  type WalkAnalysisRecord,
  type DeviationRecord,
  type AreaCompletionRecord,
  type WalkRecord,
} from '@/lib/db';
import { assignTier, type Tier } from '@/lib/tiers';

// WHY: Import constants directly to avoid HMR issues with large analysis.ts module.
// The exemptions system still uses the legacy 4-metric formula for adjusted scores.
// TODO: Update to use TIERED_SCORE_WEIGHTS when exemptions are reworked for ADR 021
const SCORE_WEIGHTS = {
  perimeterCoverage: 0.40,
  areaCoverage: 0.25,
  alignment: 0.20,
  efficiency: 0.15,
} as const;

const RMSE_NORMALIZATION_METERS = 50;

// Re-export types from exemption-types.ts for convenience
export {
  EXEMPTION_REASONS,
  type ExemptionReason,
  type Exemption,
  type DeviationWithExemption,
} from '@/lib/exemption-types';

import type { ExemptionReason, DeviationWithExemption } from '@/lib/exemption-types';

export interface AdjustedMetrics {
  // Original metrics
  originalPerimeterCoverage: number;
  originalRmse: number;
  originalEfficiency: number;
  originalQualityScore: number;
  originalTier: Tier;

  // Adjusted metrics (after exemptions)
  effectivePerimeterCoverage: number;
  effectiveRmse: number;
  effectiveEfficiency: number;
  adjustedQualityScore: number;
  adjustedTier: Tier;

  // Exemption totals
  totalExemptBorderGap: number;
  totalExemptDetourDistance: number;
  exemptionCount: number;
}

// ============================================
// Exemption Management
// ============================================

/**
 * Add an exemption to a deviation.
 *
 * WHY: Users can mark unavoidable deviations (e.g., private property) as exempt
 * to improve their score fairly. See ADR 003 section 6.
 *
 * @param deviationId - The deviation to exempt
 * @param reason - Predefined reason from EXEMPTION_REASONS
 * @param customReason - Required if reason is 'Other'
 */
export async function addExemption(
  deviationId: number,
  reason: ExemptionReason,
  customReason?: string,
): Promise<void> {
  if (reason === 'Other' && !customReason) {
    throw new Error('Custom reason is required when reason is "Other"');
  }

  const fullReason = reason === 'Other' ? `Other: ${customReason}` : reason;
  const now = new Date().toISOString();

  const deviation = await get<DeviationRecord>('deviations', deviationId);
  if (!deviation) {
    throw new Error(`Deviation ${deviationId} not found`);
  }

  deviation.isExempt = true;
  deviation.exemptionReason = fullReason;
  deviation.exemptedAt = now;
  await put('deviations', deviation);

  // WHY: Trigger score recalculation after exemption change
  await recalculateScoreWithExemptions(deviation.walkAnalysisId);
}

/**
 * Remove an exemption from a deviation.
 */
export async function removeExemption(deviationId: number): Promise<void> {
  const deviation = await get<DeviationRecord>('deviations', deviationId);
  if (!deviation) {
    throw new Error(`Deviation ${deviationId} not found`);
  }

  // WHY: Capture walkAnalysisId before clearing exemption fields
  const { walkAnalysisId } = deviation;

  deviation.isExempt = false;
  deviation.exemptionReason = null;
  deviation.exemptedAt = null;
  await put('deviations', deviation);

  // WHY: Trigger score recalculation after exemption removal
  await recalculateScoreWithExemptions(walkAnalysisId);
}

/**
 * Get all deviations for a walk analysis with exemption status.
 */
export async function getDeviationsForAnalysis(
  walkAnalysisId: number,
): Promise<DeviationWithExemption[]> {
  const records = await getAllFromIndex<DeviationRecord>(
    'deviations',
    'walkAnalysisId',
    walkAnalysisId,
  );

  // WHY: Sort by startPointIndex for consistent ordering (same as old SQL ORDER BY)
  const sorted = records.sort((a, b) => a.startPointIndex - b.startPointIndex);

  return sorted.map((r) => ({
    id: r.id!,
    walkAnalysisId: r.walkAnalysisId,
    startPointIndex: r.startPointIndex,
    endPointIndex: r.endPointIndex,
    borderGapMeters: r.borderGapMeters,
    detourDistanceMeters: r.detourDistanceMeters,
    maxDeviationMeters: r.maxDeviationMeters,
    classification: r.classification as 'obstacle_avoidance' | 'shortcut' | 'drift',
    isExempt: r.isExempt,
    exemptionReason: r.exemptionReason,
    exemptedAt: r.exemptedAt,
  }));
}

// ============================================
// Score Recalculation
// ============================================

/**
 * Recalculate the quality score for a walk analysis considering exemptions.
 *
 * WHY: When exemptions change, the score needs to be recalculated with:
 * - Exempt border gaps added to perimeter coverage
 * - Exempt detour distances removed from efficiency calculation
 * - Exempt segments excluded from RMSE
 * See ADR 003 section 6 for formulas.
 *
 * Uses a multi-store transaction for atomicity across walkAnalyses,
 * deviations, areaCompletions, and walks stores.
 */
export async function recalculateScoreWithExemptions(
  walkAnalysisId: number,
): Promise<AdjustedMetrics | null> {
  // WHY: Use a multi-store transaction so the walkAnalysis update and the
  // areaCompletion update are atomic. Reads from walks are needed to resolve
  // userId for the area completion lookup.
  const tx = await openTransaction(
    ['walkAnalyses', 'deviations', 'areaCompletions', 'walks'],
    'readwrite',
  );
  const done = txDone(tx);

  try {
    // 1. Read the walk analysis
    const analysis = await txGet<WalkAnalysisRecord>(tx, 'walkAnalyses', walkAnalysisId);
    if (!analysis) {
      // WHY: Must still await done — the transaction auto-commits on success,
      // but we need to wait for it to settle to avoid dangling promises.
      await done;
      return null;
    }

    const originalPerimeterCoverage = analysis.perimeterCoveragePercent;
    const coveredDistanceMeters = analysis.coveredDistanceMeters;
    const originalRmse = analysis.rmseMeters ?? 0;
    const originalEfficiency = analysis.efficiency ?? 0;
    const areaCoverage = analysis.areaCoveragePercent ?? 0;
    const originalQualityScore = analysis.rawQualityScore ?? 0;
    const originalTier = assignTier(originalQualityScore);

    // 2. Read all deviations for this analysis
    const allDeviations = await txGetAllFromIndex<DeviationRecord>(
      tx,
      'deviations',
      'walkAnalysisId',
      walkAnalysisId,
    );
    const exemptDeviations = allDeviations.filter((d) => d.isExempt);

    // 3. Calculate exemption adjustments
    const totalExemptBorderGap = exemptDeviations.reduce(
      (sum, d) => sum + d.borderGapMeters,
      0,
    );
    const totalExemptDetourDistance = exemptDeviations.reduce(
      (sum, d) => sum + d.detourDistanceMeters,
      0,
    );

    // WHY: We need the perimeter length to compute adjusted coverage.
    // In IndexedDB, areas come from GeoJSON at runtime (not from a DB table).
    // We approximate by inverting: perimeterMeters = coveredDistance / coveragePercent.
    // This is accurate when coveredDistance was computed against the true perimeter.
    const perimeterMeters =
      originalPerimeterCoverage > 0
        ? coveredDistanceMeters / originalPerimeterCoverage
        : coveredDistanceMeters;

    // WHY: Adjusted perimeter coverage adds exempt border gaps
    // Formula: (covered_length + sum(exempt_border_gaps)) / perimeter_length
    const effectiveCoveredMeters = coveredDistanceMeters + totalExemptBorderGap;
    const effectivePerimeterCoverage = Math.min(
      perimeterMeters > 0 ? effectiveCoveredMeters / perimeterMeters : 0,
      1.0,
    );

    // WHY: Adjusted efficiency removes exempt detour distance
    // efficiency = border_aligned / total_walk
    // total_walk approx= border_aligned / efficiency (when efficiency > 0)
    const borderAlignedLength = coveredDistanceMeters;
    const originalTotalWalk =
      originalEfficiency > 0
        ? borderAlignedLength / originalEfficiency
        : borderAlignedLength;
    const effectiveTotalWalk = Math.max(
      originalTotalWalk - totalExemptDetourDistance,
      borderAlignedLength,
    );
    const effectiveEfficiency = Math.min(
      borderAlignedLength / effectiveTotalWalk,
      1.0,
    );

    // WHY: RMSE adjustment is approximate — proportional reduction based on
    // the ratio of exempt detour to total detour. Full implementation would
    // re-calculate from GPS points, but that data isn't available here.
    const totalDetourDistance = allDeviations.reduce(
      (sum, d) => sum + d.detourDistanceMeters,
      0,
    );
    const exemptRatio =
      totalDetourDistance > 0 ? totalExemptDetourDistance / totalDetourDistance : 0;
    // WHY: Conservative 50% reduction factor to avoid over-crediting exemptions
    const effectiveRmse = originalRmse * (1 - exemptRatio * 0.5);

    // Calculate adjusted alignment score
    const effectiveAlignmentScore = Math.max(
      0,
      1 - effectiveRmse / RMSE_NORMALIZATION_METERS,
    );

    // Calculate adjusted quality score using same weights as original
    const adjustedQualityScore =
      SCORE_WEIGHTS.perimeterCoverage * effectivePerimeterCoverage +
      SCORE_WEIGHTS.areaCoverage * areaCoverage +
      SCORE_WEIGHTS.alignment * effectiveAlignmentScore +
      SCORE_WEIGHTS.efficiency * effectiveEfficiency;

    // WHY: Use centralized assignTier() to ensure consistency (TICKET-016 fix)
    const adjustedTier = assignTier(adjustedQualityScore);

    // 4. Update the walkAnalysis with new adjusted score and tier
    analysis.qualityScore = adjustedQualityScore;
    analysis.tier = adjustedTier;
    await txPut(tx, 'walkAnalyses', analysis);

    // 5. Update areaCompletion if this analysis affects the best score
    const { areaFid, walkId } = analysis;

    // WHY: Resolve userId from the walks store (walkAnalyses don't store userId)
    const walk = await txGet<WalkRecord>(tx, 'walks', walkId);
    if (walk) {
      const userId = walk.userId;

      // WHY: Find the best analysis across all walks for this area+user.
      // We need all user walks first, then filter analyses by those walk IDs.
      const userWalks = await txGetAllFromIndex<WalkRecord>(tx, 'walks', 'userId', userId);
      const userWalkIds = new Set(userWalks.map((w) => w.stravaActivityId));

      const allAreaAnalyses = await txGetAllFromIndex<WalkAnalysisRecord>(
        tx,
        'walkAnalyses',
        'areaFid',
        areaFid,
      );
      const userAreaAnalyses = allAreaAnalyses.filter((a) =>
        userWalkIds.has(a.walkId),
      );

      if (userAreaAnalyses.length > 0) {
        // WHY: Pick the best by adjusted quality_score, falling back to rawQualityScore
        const best = userAreaAnalyses.reduce((a, b) =>
          (b.qualityScore ?? b.rawQualityScore ?? 0) >
          (a.qualityScore ?? a.rawQualityScore ?? 0)
            ? b
            : a,
        );
        const bestScore = best.qualityScore ?? best.rawQualityScore ?? 0;
        // WHY: Coalesce null to 'potato' — if we have analyses for this area,
        // the score must be > 0 so assignTier won't actually return null.
        // The fallback satisfies AreaCompletionRecord.tier: string.
        const bestTier = assignTier(bestScore) ?? 'potato';

        // Count total exemptions across all analyses for this area
        let totalExemptions = 0;
        for (const a of userAreaAnalyses) {
          if (a.id != null) {
            const devs = await txGetAllFromIndex<DeviationRecord>(
              tx,
              'deviations',
              'walkAnalysisId',
              a.id,
            );
            totalExemptions += devs.filter((d) => d.isExempt).length;
          }
        }

        const existingCompletion = await txGet<AreaCompletionRecord>(
          tx,
          'areaCompletions',
          areaFid,
        );

        if (existingCompletion) {
          // WHY: Update existing completion with recalculated best score
          existingCompletion.bestWalkAnalysisId = best.id!;
          existingCompletion.bestQualityScore = bestScore;
          existingCompletion.tier = bestTier;
          existingCompletion.totalExemptions = totalExemptions;
          existingCompletion.bestCompletedAt = new Date().toISOString();

          // WHY: Update cachedMetrics so loadCachedAnalyses reflects the new score
          if (existingCompletion.cachedMetrics) {
            existingCompletion.cachedMetrics.rawQualityScore = bestScore;
            existingCompletion.cachedMetrics.tier = bestTier;
          }

          await txPut(tx, 'areaCompletions', existingCompletion);
        } else {
          // WHY: Create area completion if it doesn't exist yet.
          // Build denormalized fields for zero-join loadCachedAnalyses.
          const activityIds = [
            ...new Set(userAreaAnalyses.map((a) => a.walkId)),
          ];
          const activityPolylines: Record<number, string> = {};
          for (const aid of activityIds) {
            const w = userWalks.find((uw) => uw.stravaActivityId === aid);
            if (w?.polyline) activityPolylines[aid] = w.polyline;
          }

          const completionRecord: AreaCompletionRecord = {
            areaFid,
            userId,
            bestWalkAnalysisId: best.id!,
            bestQualityScore: bestScore,
            tier: bestTier,
            totalWalks: userAreaAnalyses.length,
            totalExemptions,
            firstCompletedAt: new Date().toISOString(),
            bestCompletedAt: new Date().toISOString(),
            activityIds,
            activityPolylines,
            cachedMetrics: {
              perimeterCoveragePercent: best.perimeterCoveragePercent,
              areaCoveragePercent: best.areaCoveragePercent ?? 0,
              rawQualityScore: bestScore,
              tier: bestTier,
              isClosedLoop: best.isClosedLoop,
              coveredDistanceMeters: best.coveredDistanceMeters,
              rmseMeters: best.rmseMeters ?? 0,
              maxDeviationMeters: best.maxDeviationMeters ?? 0,
              p90DeviationMeters: best.p90DeviationMeters ?? 0,
              efficiency: best.efficiency ?? 0,
              enclosedAreaSqm: best.enclosedAreaSqm ?? 0,
              loopGapMeters: best.loopGapMeters ?? 0,
              tieredBorderScore: best.tieredBorderScore ?? 0,
              tierDistribution: best.tierDistribution ?? {
                platinum: 0,
                gold: 0,
                silver: 0,
                bronze: 0,
                potato: 0,
                missed: 0,
              },
              walkFocus: best.efficiency ?? 0,
            },
          };
          await txPut(tx, 'areaCompletions', completionRecord);
        }
      }
    }

    // WHY: Await transaction completion to ensure all writes are committed atomically
    await done;

    return {
      originalPerimeterCoverage,
      originalRmse,
      originalEfficiency,
      originalQualityScore,
      originalTier,
      effectivePerimeterCoverage,
      effectiveRmse,
      effectiveEfficiency,
      adjustedQualityScore,
      adjustedTier,
      totalExemptBorderGap,
      totalExemptDetourDistance,
      exemptionCount: exemptDeviations.length,
    };
  } catch (error) {
    // WHY: If anything throws, the transaction auto-aborts. We still await
    // done so the abort error surfaces cleanly instead of an unhandled rejection.
    try {
      await done;
    } catch {
      // Expected — transaction was aborted by the thrown error
    }
    throw error;
  }
}

/**
 * Get adjusted metrics for a walk analysis.
 * Returns both original and exemption-adjusted values.
 */
export async function getAdjustedMetrics(
  walkAnalysisId: number,
): Promise<AdjustedMetrics | null> {
  const analysis = await get<WalkAnalysisRecord>('walkAnalyses', walkAnalysisId);
  if (!analysis) {
    return null;
  }

  const deviations = await getDeviationsForAnalysis(walkAnalysisId);
  const exemptDeviations = deviations.filter((d) => d.isExempt);

  // WHY: Use centralized assignTier() to ensure consistency (TICKET-016 fix)
  const rawScore = analysis.rawQualityScore ?? 0;
  const originalTier = assignTier(rawScore);

  return {
    originalPerimeterCoverage: analysis.perimeterCoveragePercent,
    originalRmse: analysis.rmseMeters ?? 0,
    originalEfficiency: analysis.efficiency ?? 0,
    originalQualityScore: rawScore,
    originalTier,
    // WHY: Effective metrics would need full recalculation; return originals
    // as a reasonable approximation when not recalculating
    effectivePerimeterCoverage: analysis.perimeterCoveragePercent,
    effectiveRmse: analysis.rmseMeters ?? 0,
    effectiveEfficiency: analysis.efficiency ?? 0,
    adjustedQualityScore: analysis.qualityScore ?? rawScore,
    adjustedTier: assignTier(analysis.qualityScore ?? rawScore),
    totalExemptBorderGap: exemptDeviations.reduce(
      (sum, d) => sum + d.borderGapMeters,
      0,
    ),
    totalExemptDetourDistance: exemptDeviations.reduce(
      (sum, d) => sum + d.detourDistanceMeters,
      0,
    ),
    exemptionCount: exemptDeviations.length,
  };
}

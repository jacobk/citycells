/**
 * CityCells Exemption Service
 * 
 * Manages exemptions for detected deviations and recalculates scores.
 * See ADR 003 section 6 for exemption system design.
 * 
 * @module exemptions
 */

import { getDatabase, executeWrite, persistDatabase } from './db';
import { 
  SCORE_WEIGHTS, 
  RMSE_NORMALIZATION_METERS,
  TIER_THRESHOLDS,
  type Tier,
  type AnalysisMetrics 
} from './analysis';

// Re-export types from exemption-types.ts for convenience
export { 
  EXEMPTION_REASONS, 
  type ExemptionReason, 
  type Exemption, 
  type DeviationWithExemption 
} from './exemption-types';

import type { ExemptionReason, DeviationWithExemption } from './exemption-types';

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
  customReason?: string
): Promise<void> {
  if (reason === 'Other' && !customReason) {
    throw new Error('Custom reason is required when reason is "Other"');
  }

  const fullReason = reason === 'Other' ? `Other: ${customReason}` : reason;
  const now = new Date().toISOString();

  await executeWrite(
    `UPDATE deviations 
     SET is_exempt = 1, 
         exemption_reason = ?, 
         exempted_at = ?
     WHERE id = ?`,
    [fullReason, now, deviationId]
  );

  // Get the walk_analysis_id to trigger recalculation
  const db = getDatabase();
  const result = db.exec(
    'SELECT walk_analysis_id FROM deviations WHERE id = ?',
    [deviationId]
  );

  if (result.length > 0 && result[0].values.length > 0) {
    const walkAnalysisId = result[0].values[0][0] as number;
    await recalculateScoreWithExemptions(walkAnalysisId);
  }
}

/**
 * Remove an exemption from a deviation.
 */
export async function removeExemption(deviationId: number): Promise<void> {
  // Get walk_analysis_id before removing
  const db = getDatabase();
  const result = db.exec(
    'SELECT walk_analysis_id FROM deviations WHERE id = ?',
    [deviationId]
  );

  await executeWrite(
    `UPDATE deviations 
     SET is_exempt = 0, 
         exemption_reason = NULL, 
         exempted_at = NULL
     WHERE id = ?`,
    [deviationId]
  );

  if (result.length > 0 && result[0].values.length > 0) {
    const walkAnalysisId = result[0].values[0][0] as number;
    await recalculateScoreWithExemptions(walkAnalysisId);
  }
}

/**
 * Get all deviations for a walk analysis with exemption status.
 */
export function getDeviationsForAnalysis(walkAnalysisId: number): DeviationWithExemption[] {
  const db = getDatabase();
  const result = db.exec(`
    SELECT 
      id,
      walk_analysis_id,
      start_point_index,
      end_point_index,
      border_gap_meters,
      detour_distance_meters,
      max_deviation_meters,
      classification,
      is_exempt,
      exemption_reason,
      exempted_at
    FROM deviations
    WHERE walk_analysis_id = ?
    ORDER BY start_point_index
  `, [walkAnalysisId]);

  if (result.length === 0) {
    return [];
  }

  return result[0].values.map(row => ({
    id: row[0] as number,
    walkAnalysisId: row[1] as number,
    startPointIndex: row[2] as number,
    endPointIndex: row[3] as number,
    borderGapMeters: row[4] as number,
    detourDistanceMeters: row[5] as number,
    maxDeviationMeters: row[6] as number,
    classification: row[7] as 'obstacle_avoidance' | 'shortcut' | 'drift',
    isExempt: row[8] === 1,
    exemptionReason: row[9] as string | null,
    exemptedAt: row[10] as string | null,
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
 */
export async function recalculateScoreWithExemptions(walkAnalysisId: number): Promise<AdjustedMetrics | null> {
  const db = getDatabase();

  // Get the original analysis
  const analysisResult = db.exec(`
    SELECT 
      perimeter_coverage_percent,
      covered_distance_meters,
      rmse_meters,
      efficiency,
      area_coverage_percent,
      raw_quality_score,
      tier
    FROM walk_analyses
    WHERE id = ?
  `, [walkAnalysisId]);

  if (analysisResult.length === 0 || analysisResult[0].values.length === 0) {
    return null;
  }

  const row = analysisResult[0].values[0];
  const originalPerimeterCoverage = row[0] as number;
  const coveredDistanceMeters = row[1] as number;
  const originalRmse = row[2] as number;
  const originalEfficiency = row[3] as number;
  const areaCoverage = row[4] as number;
  const originalQualityScore = row[5] as number;
  const originalTier = row[6] as Tier;

  // Get area info for perimeter length
  const areaResult = db.exec(`
    SELECT a.perimeter_meters
    FROM walk_analyses wa
    JOIN areas a ON wa.area_id = a.id
    WHERE wa.id = ?
  `, [walkAnalysisId]);

  if (areaResult.length === 0) {
    return null;
  }

  const perimeterMeters = areaResult[0].values[0][0] as number;

  // Get exempt deviations
  const deviations = getDeviationsForAnalysis(walkAnalysisId);
  const exemptDeviations = deviations.filter(d => d.isExempt);

  // Calculate exemption totals
  const totalExemptBorderGap = exemptDeviations.reduce(
    (sum, d) => sum + d.borderGapMeters, 0
  );
  const totalExemptDetourDistance = exemptDeviations.reduce(
    (sum, d) => sum + d.detourDistanceMeters, 0
  );

  // WHY: Adjusted perimeter coverage adds exempt border gaps
  // Formula: (covered_length + Σ exempt_border_gaps) / perimeter_length
  const effectiveCoveredMeters = coveredDistanceMeters + totalExemptBorderGap;
  const effectivePerimeterCoverage = Math.min(effectiveCoveredMeters / perimeterMeters, 1.0);

  // WHY: Adjusted efficiency removes exempt detour distance
  // We need original total walk length - for now approximate from efficiency
  // efficiency = border_aligned / total_walk
  // total_walk ≈ border_aligned / efficiency (if efficiency > 0)
  const borderAlignedLength = originalEfficiency > 0 
    ? coveredDistanceMeters // Approximation: covered ≈ border-aligned for good walks
    : coveredDistanceMeters;
  const originalTotalWalk = originalEfficiency > 0 
    ? borderAlignedLength / originalEfficiency 
    : borderAlignedLength;
  const effectiveTotalWalk = Math.max(originalTotalWalk - totalExemptDetourDistance, borderAlignedLength);
  const effectiveEfficiency = Math.min(borderAlignedLength / effectiveTotalWalk, 1.0);

  // WHY: RMSE adjustment is complex - for now we use a proportional reduction
  // based on the ratio of exempt detour to total detour
  // This is an approximation; full implementation would re-calculate from GPS points
  const totalDetourDistance = deviations.reduce((sum, d) => sum + d.detourDistanceMeters, 0);
  const exemptRatio = totalDetourDistance > 0 
    ? totalExemptDetourDistance / totalDetourDistance 
    : 0;
  // Reduce RMSE proportionally to exempt ratio (approximation)
  const effectiveRmse = originalRmse * (1 - exemptRatio * 0.5); // Conservative reduction

  // Calculate adjusted alignment score
  const effectiveAlignmentScore = Math.max(0, 1 - effectiveRmse / RMSE_NORMALIZATION_METERS);

  // Calculate adjusted quality score using same weights as original
  const adjustedQualityScore = 
    SCORE_WEIGHTS.perimeterCoverage * effectivePerimeterCoverage +
    SCORE_WEIGHTS.areaCoverage * areaCoverage +
    SCORE_WEIGHTS.alignment * effectiveAlignmentScore +
    SCORE_WEIGHTS.efficiency * effectiveEfficiency;

  // Determine adjusted tier
  let adjustedTier: Tier = null;
  if (adjustedQualityScore >= TIER_THRESHOLDS.platinum) {
    adjustedTier = 'platinum';
  } else if (adjustedQualityScore >= TIER_THRESHOLDS.gold) {
    adjustedTier = 'gold';
  } else if (adjustedQualityScore >= TIER_THRESHOLDS.silver) {
    adjustedTier = 'silver';
  } else if (adjustedQualityScore >= TIER_THRESHOLDS.bronze) {
    adjustedTier = 'bronze';
  }

  // Update the database with adjusted score
  db.run(`
    UPDATE walk_analyses
    SET quality_score = ?,
        tier = ?
    WHERE id = ?
  `, [adjustedQualityScore, adjustedTier, walkAnalysisId]);

  // Update area_completions if this is the best walk
  db.run(`
    UPDATE area_completions
    SET best_quality_score = ?,
        tier = ?,
        total_exemptions = (
          SELECT COUNT(*) FROM deviations d
          JOIN walk_analyses wa ON d.walk_analysis_id = wa.id
          WHERE wa.area_id = area_completions.area_id
            AND d.is_exempt = 1
        )
    WHERE best_walk_analysis_id = ?
  `, [adjustedQualityScore, adjustedTier, walkAnalysisId]);

  await persistDatabase();

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
}

/**
 * Get adjusted metrics for a walk analysis.
 * Returns both original and exemption-adjusted values.
 */
export function getAdjustedMetrics(walkAnalysisId: number): AdjustedMetrics | null {
  const db = getDatabase();

  const result = db.exec(`
    SELECT 
      perimeter_coverage_percent,
      rmse_meters,
      efficiency,
      raw_quality_score,
      quality_score,
      tier
    FROM walk_analyses
    WHERE id = ?
  `, [walkAnalysisId]);

  if (result.length === 0 || result[0].values.length === 0) {
    return null;
  }

  const row = result[0].values[0];
  const deviations = getDeviationsForAnalysis(walkAnalysisId);
  const exemptDeviations = deviations.filter(d => d.isExempt);

  // Get original tier from raw score
  const rawScore = row[3] as number;
  let originalTier: Tier = null;
  if (rawScore >= TIER_THRESHOLDS.platinum) originalTier = 'platinum';
  else if (rawScore >= TIER_THRESHOLDS.gold) originalTier = 'gold';
  else if (rawScore >= TIER_THRESHOLDS.silver) originalTier = 'silver';
  else if (rawScore >= TIER_THRESHOLDS.bronze) originalTier = 'bronze';

  return {
    originalPerimeterCoverage: row[0] as number,
    originalRmse: row[1] as number,
    originalEfficiency: row[2] as number,
    originalQualityScore: rawScore,
    originalTier,
    effectivePerimeterCoverage: row[0] as number, // Would need full recalc
    effectiveRmse: row[1] as number,
    effectiveEfficiency: row[2] as number,
    adjustedQualityScore: row[4] as number,
    adjustedTier: row[5] as Tier,
    totalExemptBorderGap: exemptDeviations.reduce((sum, d) => sum + d.borderGapMeters, 0),
    totalExemptDetourDistance: exemptDeviations.reduce((sum, d) => sum + d.detourDistanceMeters, 0),
    exemptionCount: exemptDeviations.length,
  };
}

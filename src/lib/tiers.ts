/**
 * Centralized Tier Assignment Logic for CityCells
 * 
 * WHY: Tier assignment logic was duplicated in 5 places (analysis.ts, 
 * analysis-persistence.ts x2, exemptions.ts x2), leading to bugs where
 * some locations were missing the potato tier check.
 * 
 * This module provides a single source of truth for:
 * - TIER_THRESHOLDS constants
 * - assignTier() function for score-to-tier conversion
 * 
 * See ADR 003 for tier system rationale.
 * See TICKET-016 for the potato tier persistence bug fix.
 * 
 * @module tiers
 */

// Re-export types from types/tiers for convenience
export { type TierCounts, type TierKey, TIER_ORDER, TIER_LABELS } from './types/tiers';

// ============================================
// Tier Type
// ============================================

/**
 * Tier type representing all valid tier values.
 * WHY: Includes 'potato' and null for unscored areas.
 * - null: Area has not been walked or score is 0
 * - 'potato': Any positive score below bronze threshold (< 0.50)
 */
export type Tier = 'platinum' | 'gold' | 'silver' | 'bronze' | 'potato' | null;

// ============================================
// Constants - See ADR 003 for rationale
// ============================================

/**
 * Tier score thresholds.
 * WHY: Platinum is exceptional (95%+), Gold is excellent (85%+),
 * Silver is good (70%+), Bronze is completion (50%+).
 * Scores below bronze but > 0 are assigned 'potato' tier.
 */
export const TIER_THRESHOLDS = {
  platinum: 0.95,
  gold: 0.85,
  silver: 0.70,
  bronze: 0.50,
} as const;

// ============================================
// Functions
// ============================================

/**
 * Assign a tier based on a quality score.
 * 
 * WHY: Centralized tier assignment prevents bugs where tier logic
 * is inconsistently implemented across the codebase. The potato tier
 * bug (TICKET-016) was caused by this logic being duplicated in 5 places
 * with 3 of them missing the potato tier check.
 * 
 * @param score - Quality score from 0.0 to 1.0
 * @returns Tier assignment: 'platinum' | 'gold' | 'silver' | 'bronze' | 'potato' | null
 * 
 * @example
 * assignTier(0.96) // 'platinum'
 * assignTier(0.75) // 'silver'
 * assignTier(0.30) // 'potato'
 * assignTier(0)    // null
 */
export function assignTier(score: number): Tier {
  if (score >= TIER_THRESHOLDS.platinum) {
    return 'platinum';
  } else if (score >= TIER_THRESHOLDS.gold) {
    return 'gold';
  } else if (score >= TIER_THRESHOLDS.silver) {
    return 'silver';
  } else if (score >= TIER_THRESHOLDS.bronze) {
    return 'bronze';
  } else if (score > 0) {
    // WHY: Potato tier for any positive score < 0.50
    // Ensures all matched walks count toward progress per ADR 003 (Updated 2026-02-13)
    // This was the root cause of TICKET-016 - potato tier areas disappeared after refresh
    return 'potato';
  }
  return null;
}

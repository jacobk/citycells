/**
 * Tier-related types for CityCells.
 * See ADR 003 for tier system rationale.
 * 
 * @module types/tiers
 */

/**
 * Counts of completed areas by tier.
 * Used in ProgressInfo, ProgressDashboard, and ProfileCard.
 * 
 * WHY: Centralized type to ensure consistency across components
 * that display tier statistics. Previously duplicated in Map.tsx
 * and ProgressDashboard.tsx (as TierStats).
 */
export interface TierCounts {
  platinum: number;
  gold: number;
  silver: number;
  bronze: number;
  potato: number;
}

/**
 * Tier keys in display order (highest to lowest).
 * WHY: Single source of truth for tier iteration order.
 * Used by ProgressDashboard for rendering tier breakdown.
 */
export const TIER_ORDER = ['platinum', 'gold', 'silver', 'bronze', 'potato'] as const;

/**
 * Type representing valid tier keys.
 * Derived from TIER_ORDER for type safety.
 */
export type TierKey = typeof TIER_ORDER[number];

/**
 * Display labels for each tier.
 * WHY: Centralized labels for consistent UI rendering.
 */
export const TIER_LABELS: Record<TierKey, string> = {
  platinum: 'Platinum',
  gold: 'Gold',
  silver: 'Silver',
  bronze: 'Bronze',
  potato: 'Potato',
};

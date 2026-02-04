/**
 * Map Visual Design System - Centralized Design Tokens
 * 
 * WHY: Centralizes all map visualization colors per ADR 010.
 * These tokens are specific to map rendering - non-map contexts (badges, text)
 * continue to use getTierColor() from analysis.ts per ADR 003.
 * 
 * @see docs/ADR/010-map-visual-design-system.md
 */

import type { Tier } from '@/lib/analysis';

// =============================================================================
// TIER FILL COLORS (Purple-Pink Gradient)
// WHY: Bold gradient creates visual excitement and modern appeal.
// Darker = higher tier (Platinum deepest, Bronze softest)
// =============================================================================

export const TIER_FILL_COLORS = {
  platinum: '#7c3aed', // Deep Violet
  gold: '#a855f7',     // Vibrant Purple
  silver: '#d946ef',   // Magenta Pink
  bronze: '#f0abfc',   // Soft Pink
} as const;

// =============================================================================
// TIER OPACITIES
// WHY: Higher opacities for better tiers ensure colors are bold and visible.
// Range 0.50-0.65 per ADR 010 accessibility requirements.
// =============================================================================

export const TIER_OPACITIES = {
  platinum: 0.65,
  gold: 0.60,
  silver: 0.55,
  bronze: 0.50,
} as const;

// =============================================================================
// TIER BORDER COLORS (Slightly Darker for Definition)
// WHY: Distinct border color provides visual separation between adjacent areas.
// =============================================================================

export const TIER_BORDER_COLORS = {
  platinum: '#6d28d9', // Dark Violet
  gold: '#9333ea',     // Medium Purple
  silver: '#c026d3',   // Hot Pink
  bronze: '#e879f9',   // Light Pink
} as const;

// =============================================================================
// UNWALKED AREA STYLING
// WHY: Subtle styling for unwalked areas so they don't compete with completed ones.
// =============================================================================

export const UNWALKED_AREA_STYLE = {
  borderColor: '#64748b', // Slate-500
  borderWeight: 1,
  borderOpacity: 0.8,
  fillColor: '#94a3b8',   // Slate-400
  fillOpacity: 0.1,
} as const;

// =============================================================================
// ROUTE TRIPLE-LAYER STYLING (Cyan Glow Effect)
// WHY: Electric cyan is complementary to purple-pink (maximum contrast).
// Triple-layer (glow + outline + core) creates premium, modern look.
// Layers render bottom-to-top: glow → outline → core
// =============================================================================

export const ROUTE_STYLES = {
  glow: {
    color: '#22d3ee',  // Cyan Glow
    weight: 7,
    opacity: 0.3,
    lineCap: 'round' as const,
    lineJoin: 'round' as const,
  },
  outline: {
    color: '#0f766e',  // Deep Teal
    weight: 5,
    opacity: 0.6,
    lineCap: 'round' as const,
    lineJoin: 'round' as const,
  },
  core: {
    color: '#06b6d4',  // Electric Cyan
    weight: 3,
    opacity: 0.9,
    lineCap: 'round' as const,
    lineJoin: 'round' as const,
  },
} as const;

// =============================================================================
// TIER ICON CONFIGURATION
// WHY: Medal icons provide instant tier recognition without hovering.
// Icons scale with tier importance (Platinum largest).
// =============================================================================

export const TIER_ICONS = {
  platinum: { emoji: '🏆', size: 20 },
  gold: { emoji: '🥇', size: 18 },
  silver: { emoji: '🥈', size: 16 },
  bronze: { emoji: '🥉', size: 14 },
} as const;

// WHY: Icons only visible at zoom 13+ to avoid clutter at lower zoom levels
export const TIER_ICON_MIN_ZOOM = 13;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get map fill color for a tier.
 * Returns undefined for null tier (unwalked areas use UNWALKED_AREA_STYLE).
 */
export function getMapTierFillColor(tier: Tier): string | undefined {
  if (!tier) return undefined;
  return TIER_FILL_COLORS[tier];
}

/**
 * Get map border color for a tier.
 */
export function getMapTierBorderColor(tier: Tier): string | undefined {
  if (!tier) return undefined;
  return TIER_BORDER_COLORS[tier];
}

/**
 * Get map fill opacity for a tier.
 */
export function getMapTierOpacity(tier: Tier): number | undefined {
  if (!tier) return undefined;
  return TIER_OPACITIES[tier];
}

/**
 * Get tier icon configuration.
 */
export function getTierIconConfig(tier: Tier): { emoji: string; size: number } | undefined {
  if (!tier) return undefined;
  return TIER_ICONS[tier];
}

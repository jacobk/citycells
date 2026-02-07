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
// ROUTE DEVIATION COLORS (ADR 010 Section 3)
// WHY: Binary threshold coloring provides clear visual feedback on walk quality.
// Green = on-track (within 25m buffer), Red = deviation (outside 25m buffer).
// 25m threshold matches perimeter coverage buffer in ADR 002/003.
// =============================================================================

export const ROUTE_DEVIATION_COLORS = {
  onTrack: '#22c55e',    // Green - within 25m buffer
  deviation: '#ef4444',   // Red - outside 25m buffer
  unmatched: '#94a3b8',   // Slate - activity not assigned to any area
} as const;

// WHY: 25m threshold matches the buffer used for perimeter coverage calculation
// See ADR 002 and ADR 003 for rationale
export const ROUTE_DEVIATION_THRESHOLD_METERS = 25;

// WHY: Thinner, cleaner lines (3px) reduce visual clutter compared to old glow effect
export const ROUTE_SEGMENT_STYLE = {
  weight: 3,
  opacity: 0.85,
  lineCap: 'round' as const,
  lineJoin: 'round' as const,
} as const;

// =============================================================================
// ROUTE TRIPLE-LAYER STYLING (Cyan Glow Effect)
// @deprecated Use ROUTE_DEVIATION_COLORS and ROUTE_SEGMENT_STYLE instead (ADR 010)
// WHY: Electric cyan is complementary to purple-pink (maximum contrast).
// Triple-layer (glow + outline + core) creates premium, modern look.
// Layers render bottom-to-top: glow → outline → core
// =============================================================================

/** @deprecated Use ROUTE_DEVIATION_COLORS and ROUTE_SEGMENT_STYLE instead (ADR 010) */
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

/**
 * Get route segment color based on distance from boundary.
 * WHY: Binary threshold provides clear visual feedback (green = good, red = deviation).
 */
export function getRouteSegmentColor(distanceMeters: number): string {
  return distanceMeters <= ROUTE_DEVIATION_THRESHOLD_METERS
    ? ROUTE_DEVIATION_COLORS.onTrack
    : ROUTE_DEVIATION_COLORS.deviation;
}

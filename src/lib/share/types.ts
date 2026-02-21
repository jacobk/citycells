/**
 * Share Walk Types
 * 
 * WHY: Defines the data schema for shareable walk URLs.
 * The schema includes a version field to enable backwards-compatible evolution.
 * All shared URLs must remain functional indefinitely - users bookmark and share links.
 * 
 * @see docs/ADR/023-share-walk-feature.md - Technical decisions
 * @see docs/tickets/029-share-walk.md - Implementation requirements
 * 
 * @module share/types
 */

import type { DistanceTier } from '@/lib/distance-tiers';

// =============================================================================
// Schema Version
// =============================================================================

/**
 * Current schema version for encoding.
 * 
 * WHY: Version field enables non-breaking schema evolution.
 * When encoding, always use CURRENT_SHARE_VERSION.
 * When decoding, use version-specific decoders.
 * 
 * CRITICAL: Increment this when making breaking changes to ShareableWalkData.
 * See ADR 023 Section 1.1 for versioning rules.
 */
export const CURRENT_SHARE_VERSION = 1;

// =============================================================================
// URL Configuration
// =============================================================================

/**
 * Maximum recommended URL length.
 * 
 * WHY: Most browsers/platforms support up to ~2000 chars.
 * Beyond this, URLs may be truncated or rejected.
 */
export const MAX_URL_LENGTH = 2000;

/**
 * URL path for shared walk viewer.
 */
export const SHARE_WALK_PATH = '/share/walk';

// =============================================================================
// Shareable Data Types
// =============================================================================

/**
 * Compact tier segment representation for URL encoding.
 * 
 * WHY: Uses short property names to minimize encoded size.
 * - s: start index in walk path
 * - e: end index in walk path
 * - t: tier name (first letter or 'm' for missed)
 */
export interface CompactTierSegment {
  s: number;  // Start index
  e: number;  // End index
  t: string;  // Tier abbreviation: 'p', 'g', 's', 'b', 'o' (potato), 'm' (missed)
}

/**
 * Tier distribution as percentages (0-1).
 * 
 * WHY: Shows exactly where quality was gained/lost.
 * Values sum to 1.0 within floating point tolerance.
 */
export type ShareableTierDistribution = Record<DistanceTier, number>;

/**
 * Score breakdown for the shared walk.
 */
export interface ShareableScores {
  /** Tiered border score (0-1) - weighted by segment length */
  tieredBorderScore: number;
  /** Area coverage (0-1) - enclosed area vs total area */
  areaCoverage: number;
  /** Walk focus (0-1) - % of walk on boundary */
  walkFocus: number;
  /** Composite quality score (0-1) */
  qualityScore: number;
  /** Assigned tier based on quality score */
  tier: string;
}

/**
 * Walk statistics for display.
 */
export interface ShareableStats {
  /** Sub-area circumference in meters */
  circumference: number;
  /** Total walk distance in meters (from Strava) */
  walkDistance: number;
  /** Distance walked within perimeter buffer in meters */
  perimeterWalked: number;
  /** Sub-area total area in square meters */
  area: number;
  /** Actual walk duration in seconds (optional) */
  actualWalkTime?: number;
}

/**
 * Complete shareable walk data payload.
 * 
 * WHY: Self-contained data structure that can be encoded in URL.
 * No database lookups needed to render the shared view.
 * 
 * CRITICAL: The 'v' field must be first for version detection.
 * When adding new optional fields, they can be added without version bump.
 * When adding required fields or changing types, increment CURRENT_SHARE_VERSION.
 * 
 * @see ADR 023 Section 1.1 for versioning rules
 */
export interface ShareableWalkData {
  // ==========================================================================
  // Version (REQUIRED - must be first field checked)
  // ==========================================================================
  
  /** 
   * Schema version number.
   * WHY: Enables backwards-compatible evolution of the data format.
   * Decoder uses this to select appropriate parsing logic.
   */
  v: number;
  
  // ==========================================================================
  // Area Identification
  // ==========================================================================
  
  /** Sub-area ID (matches areas table) */
  areaId: string;
  
  /** Sub-area display name */
  areaName: string;
  
  // ==========================================================================
  // Walk Metadata
  // ==========================================================================
  
  /** Walk date in ISO format (YYYY-MM-DD) */
  walkDate: string;
  
  /** Strava activity ID (optional - may not be available) */
  stravaActivityId?: number;
  
  // ==========================================================================
  // Geometry (Compressed)
  // ==========================================================================
  
  /**
   * Sub-area boundary as encoded polyline.
   * WHY: Google Polyline Algorithm provides ~50% compression over coordinate arrays.
   */
  boundary: string;
  
  /**
   * Walk route as encoded polyline.
   */
  walkPath: string;
  
  /**
   * Tier classification for each walk segment.
   * WHY: Enables per-segment coloring in route visualization.
   */
  tierSegments: CompactTierSegment[];
  
  // ==========================================================================
  // Scoring Data
  // ==========================================================================
  
  /** Score breakdown */
  scores: ShareableScores;
  
  /** Distribution of walk distance across tiers */
  tierDistribution: ShareableTierDistribution;
  
  // ==========================================================================
  // Stats
  // ==========================================================================
  
  /** Walk statistics for display */
  stats: ShareableStats;
}

// =============================================================================
// Error Types
// =============================================================================

/**
 * Error thrown when decoding a URL with an unsupported future version.
 * 
 * WHY: Users may receive links created with a newer app version.
 * We need a specific error type to show a helpful message.
 */
export class UnsupportedVersionError extends Error {
  public readonly version: number;
  
  constructor(version: number) {
    super(`This link was created with a newer version of CityCells (v${version}). Please refresh the page or try again later.`);
    this.name = 'UnsupportedVersionError';
    this.version = version;
  }
}

/**
 * Error thrown when the encoded data is malformed or corrupted.
 */
export class InvalidShareDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidShareDataError';
  }
}

// =============================================================================
// Tier Abbreviation Helpers
// =============================================================================

/**
 * Map full tier names to single-character abbreviations for compact encoding.
 */
export const TIER_ABBREVIATIONS: Record<DistanceTier, string> = {
  platinum: 'p',
  gold: 'g',
  silver: 's',
  bronze: 'b',
  potato: 'o',  // 'p' taken by platinum
  missed: 'm',
};

/**
 * Map abbreviations back to full tier names.
 */
export const TIER_FROM_ABBREVIATION: Record<string, DistanceTier> = {
  p: 'platinum',
  g: 'gold',
  s: 'silver',
  b: 'bronze',
  o: 'potato',
  m: 'missed',
};

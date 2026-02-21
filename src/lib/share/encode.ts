/**
 * Share Walk Encoding
 * 
 * WHY: Encodes walk data for self-contained shareable URLs.
 * Pipeline: Walk Data → JSON → gzip compress → base64url encode
 * 
 * @see docs/ADR/023-share-walk-feature.md - Encoding pipeline specification
 * @see docs/tickets/029-share-walk.md - Implementation requirements
 * 
 * @module share/encode
 */

import pako from 'pako';
import {
  type ShareableWalkData,
  type CompactTierSegment,
  CURRENT_SHARE_VERSION,
  MAX_URL_LENGTH,
  SHARE_WALK_PATH,
  TIER_ABBREVIATIONS,
} from './types';
import type { TieredSegment, TierDistribution } from '@/lib/distance-tiers';
import type { AnalysisMetrics, Tier } from '@/lib/analysis';

// =============================================================================
// Base64url Encoding
// =============================================================================

/**
 * Encode bytes to base64url format.
 * 
 * WHY: Standard base64 uses +/= which are not URL-safe.
 * base64url replaces: + → -, / → _, removes padding (=).
 */
function base64urlEncode(bytes: Uint8Array): string {
  // Convert to regular base64
  const base64 = btoa(String.fromCharCode(...bytes));
  
  // Convert to URL-safe format
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');  // Remove padding
}

// =============================================================================
// Compression
// =============================================================================

/**
 * Compress and encode walk data to a URL-safe string.
 * 
 * WHY: Walk data (especially polylines) can be large.
 * gzip typically achieves 60-70% compression on JSON.
 * base64url adds ~33% overhead, net result is usually smaller.
 * 
 * @param data - ShareableWalkData to encode
 * @returns URL-safe encoded string
 */
export function encodeWalkData(data: ShareableWalkData): string {
  // WHY: Ensure version is set (should always be, but defensive)
  const dataWithVersion = {
    ...data,
    v: data.v ?? CURRENT_SHARE_VERSION,
  };
  
  // Serialize to JSON
  const json = JSON.stringify(dataWithVersion);
  
  // Compress with gzip
  const compressed = pako.gzip(json);
  
  // Encode to base64url
  return base64urlEncode(compressed);
}

// =============================================================================
// URL Generation
// =============================================================================

/**
 * Generate a complete shareable URL for walk data.
 * 
 * WHY: Creates a self-contained URL that can be shared anywhere.
 * The URL contains all data needed to render the walk view.
 * 
 * @param data - ShareableWalkData to encode
 * @param baseUrl - Optional base URL (defaults to current origin in browser)
 * @returns Object with URL and warning if too long
 */
export function generateShareUrl(
  data: ShareableWalkData,
  baseUrl?: string
): { url: string; isLong: boolean; length: number } {
  const encoded = encodeWalkData(data);
  
  // Determine base URL
  const origin = baseUrl ?? (typeof window !== 'undefined' ? window.location.origin : 'https://citycells.app');
  
  const url = `${origin}${SHARE_WALK_PATH}?d=${encoded}`;
  
  return {
    url,
    isLong: url.length > MAX_URL_LENGTH,
    length: url.length,
  };
}

// =============================================================================
// Data Conversion Helpers
// =============================================================================

/**
 * Convert TieredSegment[] to compact format for encoding.
 * 
 * WHY: Full TieredSegment objects are verbose.
 * Compact format uses short keys and tier abbreviations.
 */
export function compactTierSegments(segments: TieredSegment[]): CompactTierSegment[] {
  return segments.map(seg => ({
    s: seg.startIndex,
    e: seg.endIndex,
    t: TIER_ABBREVIATIONS[seg.tier],
  }));
}

/**
 * Build ShareableWalkData from analysis results and area info.
 * 
 * WHY: Convenience function to construct the shareable payload
 * from the data structures already available in the app.
 * 
 * @param params - Components of the shareable data
 * @returns Complete ShareableWalkData ready for encoding
 */
export function buildShareableWalkData(params: {
  areaId: number | string;
  areaName: string;
  walkDate: string | Date;
  stravaActivityId?: number;
  boundaryPolyline: string;
  walkPathPolyline: string;
  metrics: AnalysisMetrics;
  tier: Tier;
  circumferenceMeters: number;
  areaSqm: number;
}): ShareableWalkData {
  const {
    areaId,
    areaName,
    walkDate,
    stravaActivityId,
    boundaryPolyline,
    walkPathPolyline,
    metrics,
    tier,
    circumferenceMeters,
    areaSqm,
  } = params;
  
  // Format date as ISO date string
  const dateStr = walkDate instanceof Date
    ? walkDate.toISOString().split('T')[0]
    : walkDate;
  
  // Convert tier distribution to shareable format
  const tierDistribution = metrics.tierDistribution as TierDistribution;
  
  return {
    v: CURRENT_SHARE_VERSION,
    areaId: String(areaId),
    areaName,
    walkDate: dateStr,
    stravaActivityId,
    boundary: boundaryPolyline,
    walkPath: walkPathPolyline,
    tierSegments: compactTierSegments(metrics.tieredSegments),
    scores: {
      tieredBorderScore: metrics.tieredBorderScore,
      areaCoverage: metrics.areaCoveragePercent,
      walkFocus: metrics.walkFocus,
      qualityScore: metrics.rawQualityScore,
      tier: tier ?? 'potato',
    },
    tierDistribution,
    stats: {
      circumference: circumferenceMeters,
      walkDistance: metrics.totalWalkLengthMeters,
      perimeterWalked: metrics.coveredDistanceMeters,
      area: areaSqm,
    },
  };
}

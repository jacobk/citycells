/**
 * Share Walk Decoding
 * 
 * WHY: Version-aware decoder for shareable walk URLs.
 * Supports all previous versions to ensure old URLs remain functional.
 * Pipeline: base64url decode → gzip decompress → JSON parse → version-specific decode
 * 
 * CRITICAL: Never delete old version decoders (decodeV1, decodeV2, etc.)
 * Old URLs must work forever - users bookmark and share links.
 * 
 * @see docs/ADR/023-share-walk-feature.md - Versioning strategy
 * @see docs/tickets/029-share-walk.md - Implementation requirements
 * 
 * @module share/decode
 */

import pako from 'pako';
import {
  type ShareableWalkData,
  type CompactTierSegment,
  type ShareableTierDistribution,
  type ShareableScores,
  type ShareableStats,
  CURRENT_SHARE_VERSION,
  UnsupportedVersionError,
  InvalidShareDataError,
  TIER_FROM_ABBREVIATION,
} from './types';
import type { TieredSegment, DistanceTier } from '@/lib/distance-tiers';

// =============================================================================
// Base64url Decoding
// =============================================================================

/**
 * Decode base64url string to bytes.
 * 
 * WHY: Reverses the URL-safe encoding done during share URL generation.
 * Converts - → +, _ → /, adds padding if needed.
 */
function base64urlDecode(str: string): Uint8Array {
  // Add padding if needed
  let padded = str;
  const remainder = str.length % 4;
  if (remainder === 2) {
    padded += '==';
  } else if (remainder === 3) {
    padded += '=';
  }
  
  // Convert from URL-safe format
  const base64 = padded
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  
  // Decode base64 to binary string
  const binary = atob(base64);
  
  // Convert to Uint8Array
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  
  return bytes;
}

// =============================================================================
// Version-Specific Decoders
// =============================================================================

/**
 * Raw V1 data structure (as stored in URL).
 * 
 * WHY: Type for the parsed JSON before conversion to ShareableWalkData.
 * This interface should NEVER be modified after release - it documents
 * the frozen V1 schema.
 */
interface V1RawData {
  v: 1;
  areaId: string;
  areaName: string;
  walkDate: string;
  stravaActivityId?: number;
  boundary: string;
  walkPath: string;
  tierSegments: CompactTierSegment[];
  scores: ShareableScores;
  tierDistribution: ShareableTierDistribution;
  stats: ShareableStats;
}

/**
 * Decode V1 format data.
 * 
 * WHY: Version 1 is the initial release format.
 * This function must NEVER be deleted or modified in a breaking way.
 * 
 * Future versions may add fields with defaults, but must not remove
 * or change the meaning of existing fields.
 */
function decodeV1(raw: V1RawData): ShareableWalkData {
  // V1 maps directly to current ShareableWalkData
  // When V2+ is added, this function will handle migrations
  return {
    v: 1,
    areaId: raw.areaId,
    areaName: raw.areaName,
    walkDate: raw.walkDate,
    stravaActivityId: raw.stravaActivityId,
    boundary: raw.boundary,
    walkPath: raw.walkPath,
    tierSegments: raw.tierSegments,
    scores: raw.scores,
    tierDistribution: raw.tierDistribution,
    stats: raw.stats,
  };
}

// =============================================================================
// Main Decoder
// =============================================================================

/**
 * Decode shareable walk data from URL-encoded string.
 * 
 * WHY: Version-aware decoder that supports all historical formats.
 * This is the main entry point for decoding share URLs.
 * 
 * @param encoded - base64url-encoded compressed data from URL param 'd'
 * @returns Decoded ShareableWalkData
 * @throws UnsupportedVersionError if version is newer than supported
 * @throws InvalidShareDataError if data is malformed or corrupted
 */
export function decodeWalkData(encoded: string): ShareableWalkData {
  if (!encoded || typeof encoded !== 'string') {
    throw new InvalidShareDataError('Missing or invalid share data');
  }
  
  try {
    // Step 1: Base64url decode
    const compressed = base64urlDecode(encoded);
    
    // Step 2: gzip decompress
    const json = pako.ungzip(compressed, { to: 'string' });
    
    // Step 3: Parse JSON
    const raw = JSON.parse(json);
    
    // Step 4: Version-aware decoding
    if (typeof raw.v !== 'number') {
      throw new InvalidShareDataError('Missing or invalid version field');
    }
    
    // Select decoder based on version
    switch (raw.v) {
      case 1:
        return decodeV1(raw as V1RawData);
      
      // Future versions:
      // case 2:
      //   return decodeV2(raw as V2RawData);
      
      default:
        if (raw.v > CURRENT_SHARE_VERSION) {
          throw new UnsupportedVersionError(raw.v);
        }
        // Unknown past version (shouldn't happen)
        throw new InvalidShareDataError(`Unknown version: ${raw.v}`);
    }
  } catch (e) {
    // Re-throw our custom errors
    if (e instanceof UnsupportedVersionError || e instanceof InvalidShareDataError) {
      throw e;
    }
    
    // Wrap other errors (decompression failures, JSON parse errors, etc.)
    console.error('[decodeWalkData] Decoding failed:', e);
    throw new InvalidShareDataError('This link appears to be damaged or invalid');
  }
}

// =============================================================================
// Data Conversion Helpers
// =============================================================================

/**
 * Expand compact tier segments to full TieredSegment format.
 * 
 * WHY: The compact format saves URL space but the app uses the full format.
 * This converts back for use in route visualization.
 * 
 * @param compact - Compact tier segments from share data
 * @returns Full TieredSegment array for visualization
 */
export function expandTierSegments(compact: CompactTierSegment[]): TieredSegment[] {
  return compact.map(seg => ({
    startIndex: seg.s,
    endIndex: seg.e,
    tier: TIER_FROM_ABBREVIATION[seg.t] ?? 'missed',
    // These values aren't stored in compact format but may be needed
    // Set to 0 as they're only used for calculations, not display
    distanceMeters: 0,
    segmentLengthMeters: 0,
  }));
}

/**
 * Get tier from abbreviation.
 * 
 * WHY: Utility for converting single-letter tier codes back to full names.
 */
export function getTierFromAbbreviation(abbr: string): DistanceTier {
  return TIER_FROM_ABBREVIATION[abbr] ?? 'missed';
}

/**
 * Validate that decoded data has all required fields.
 * 
 * WHY: Additional runtime validation beyond TypeScript types.
 * Catches corrupted or tampered data.
 */
export function validateShareData(data: ShareableWalkData): boolean {
  try {
    // Required string fields
    if (!data.areaId || typeof data.areaId !== 'string') return false;
    if (!data.areaName || typeof data.areaName !== 'string') return false;
    if (!data.walkDate || typeof data.walkDate !== 'string') return false;
    if (!data.boundary || typeof data.boundary !== 'string') return false;
    if (!data.walkPath || typeof data.walkPath !== 'string') return false;
    
    // Required objects
    if (!data.scores || typeof data.scores !== 'object') return false;
    if (!data.tierDistribution || typeof data.tierDistribution !== 'object') return false;
    if (!data.stats || typeof data.stats !== 'object') return false;
    
    // Required arrays
    if (!Array.isArray(data.tierSegments)) return false;
    
    // Version
    if (typeof data.v !== 'number' || data.v < 1) return false;
    
    return true;
  } catch {
    return false;
  }
}

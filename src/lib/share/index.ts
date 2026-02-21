/**
 * Share Walk Module
 * 
 * Provides functionality for sharing walk achievements via URL and image export.
 * 
 * @see docs/ADR/023-share-walk-feature.md - Technical decisions
 * @see docs/features/share-walk.md - Feature documentation
 * 
 * @module share
 */

// Types
export {
  type ShareableWalkData,
  type CompactTierSegment,
  type ShareableTierDistribution,
  type ShareableScores,
  type ShareableStats,
  CURRENT_SHARE_VERSION,
  MAX_URL_LENGTH,
  SHARE_WALK_PATH,
  UnsupportedVersionError,
  InvalidShareDataError,
  TIER_ABBREVIATIONS,
  TIER_FROM_ABBREVIATION,
} from './types';

// Encoding
export {
  encodeWalkData,
  generateShareUrl,
  compactTierSegments,
  buildShareableWalkData,
} from './encode';

// Decoding
export {
  decodeWalkData,
  expandTierSegments,
  getTierFromAbbreviation,
  validateShareData,
} from './decode';

// Image Generation
export {
  generateShareImage,
  downloadImage,
  copyImageToClipboard,
  isClipboardImageSupported,
  FORMAT_DIMENSIONS,
  type ImageGenerationResult,
  type ImageGenerationOptions,
} from './image';

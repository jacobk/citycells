/**
 * Map Configuration - Shared Map Settings
 * 
 * WHY: Centralizes map configuration to ensure consistency across
 * Map, AreaMiniMap, and WalkingMode components.
 * 
 * @see docs/ADR/017-live-walking-mode.md (DRY check)
 */

// =============================================================================
// TILE LAYER CONFIGURATION
// WHY: Single source of truth for tile provider URL and attribution.
// OpenStreetMap provides reliable, free street-level tiles.
// =============================================================================

export const TILE_LAYER_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

export const TILE_LAYER_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

// =============================================================================
// DEFAULT MAP CENTER (Malmö, Sweden)
// WHY: App is focused on Malmö sub-areas. Default center provides
// reasonable initial view before user location or area bounds are set.
// =============================================================================

export const MALMO_CENTER: [number, number] = [55.59, 13.00];

export const DEFAULT_ZOOM = 12;

// =============================================================================
// WALKING MODE MAP SETTINGS
// WHY: Walking mode needs different defaults for outdoor navigation use.
// Higher zoom shows more street detail for following boundaries.
// =============================================================================

export const WALKING_MODE_DEFAULT_ZOOM = 16;

// WHY: Padding ensures boundary isn't clipped at map edges when fitting bounds
export const FIT_BOUNDS_PADDING: [number, number] = [20, 20];

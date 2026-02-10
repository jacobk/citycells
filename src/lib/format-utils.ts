/**
 * Format Utilities
 * 
 * Shared formatting functions for consistent UI display.
 */

/**
 * Format distance in meters to human-readable string.
 * WHY: Consistent distance formatting across the app (X.XX km for >= 1000m, rounded meters otherwise).
 * Used in ProgressDashboard, AreaDetailsPanel, ExemptionModal, and other components.
 * 
 * @param meters - Distance in meters
 * @returns Formatted string (e.g., "2.35 km" or "450 m")
 */
export function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(2)} km`;
  }
  return `${Math.round(meters)} m`;
}

'use client';

/**
 * LivePositionMarker Component
 * 
 * Displays the user's live GPS position on the map with an accuracy circle.
 * Uses the useGeolocationTracking hook for continuous position updates.
 * 
 * WHY: Users need clear visual feedback of their position relative to the
 * sub-area boundary they're trying to walk.
 * 
 * Marker color changes based on distance tier (ADR 021/TICKET-028):
 * - Platinum (#7c3aed) Deep Violet - ≤10m
 * - Gold (#a855f7) Vibrant Purple - ≤20m
 * - Silver (#d946ef) Magenta Pink - ≤30m
 * - Bronze (#f0abfc) Soft Pink - ≤40m
 * - Potato (#a1a1aa) Warm Gray - ≤50m
 * - Missed (#fca5a5) Light Red - >50m
 * 
 * @see docs/ADR/017-live-walking-mode.md
 * @see docs/ADR/021-tiered-distance-scoring.md
 * @see docs/tickets/028-tiered-walking-indicator.md
 */

import { useEffect } from 'react';
import { Circle, CircleMarker, useMap } from 'react-leaflet';
import type { GeolocationPosition } from '@/hooks/useGeolocationTracking';
import type { DistanceTier } from '@/lib/distance-tiers';
import { DISTANCE_TIER_COLORS } from '@/lib/design-tokens';

// =============================================================================
// Types
// =============================================================================

interface LivePositionMarkerProps {
  /** Current position from geolocation tracking */
  position: GeolocationPosition | null;
  /** Whether to automatically center map on position updates */
  autoCenter: boolean;
  /** Callback when position is first acquired (for initial centering) */
  onFirstPosition?: () => void;
  /** Current distance tier - determines marker color per ADR 021 */
  tier?: DistanceTier | null;
}

// =============================================================================
// Constants
// =============================================================================

// WHY: Blue dot matches native map apps (Google Maps, Apple Maps)
// Used when tier is unknown (GPS acquiring)
const POSITION_DOT_COLOR_DEFAULT = '#3b82f6'; // blue-500 (matches PRD 3.13)

// WHY: Standard marker size - consistent with native map apps
const POSITION_DOT_RADIUS = 8;

// WHY: Accuracy circle shows GPS uncertainty - helps user understand precision
const ACCURACY_CIRCLE_COLOR = '#3b82f6'; // blue-500
const ACCURACY_CIRCLE_FILL_OPACITY = 0.15;
const ACCURACY_CIRCLE_STROKE_OPACITY = 0.4;

// =============================================================================
// Component
// =============================================================================

export default function LivePositionMarker({
  position,
  autoCenter,
  onFirstPosition,
  tier,
}: LivePositionMarkerProps) {
  // WHY: Marker color reflects distance tier per ADR 021/TICKET-028
  // Uses 6-tier gradient from violet (best) to red (missed)
  const markerColor = tier ? DISTANCE_TIER_COLORS[tier] : POSITION_DOT_COLOR_DEFAULT;
  const map = useMap();
  
  // WHY: Center map on position when autoCenter is enabled
  useEffect(() => {
    if (!position || !autoCenter) return;
    
    map.setView([position.latitude, position.longitude], map.getZoom(), {
      animate: true,
      duration: 0.5,
    });
  }, [position, autoCenter, map]);
  
  // WHY: Trigger callback on first position for initial setup
  useEffect(() => {
    if (position && onFirstPosition) {
      onFirstPosition();
    }
    // Only run once when position first becomes available
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position !== null]);
  
  if (!position) {
    return null;
  }
  
  const latLng: [number, number] = [position.latitude, position.longitude];
  
  return (
    <>
      {/* Accuracy Circle - shows GPS uncertainty radius */}
      <Circle
        center={latLng}
        radius={position.accuracy}
        pathOptions={{
          color: ACCURACY_CIRCLE_COLOR,
          fillColor: ACCURACY_CIRCLE_COLOR,
          fillOpacity: ACCURACY_CIRCLE_FILL_OPACITY,
          opacity: ACCURACY_CIRCLE_STROKE_OPACITY,
          weight: 1,
        }}
      />
      
      {/* Position Dot - user's current location */}
      {/* WHY: Color indicates distance tier per ADR 021/TICKET-028 */}
      <CircleMarker
        center={latLng}
        radius={POSITION_DOT_RADIUS}
        pathOptions={{
          color: '#ffffff',
          fillColor: markerColor,
          fillOpacity: 1,
          opacity: 1,
          weight: 3,
        }}
      />
    </>
  );
}

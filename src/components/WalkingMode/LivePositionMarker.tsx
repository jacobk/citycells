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
 * @see docs/ADR/017-live-walking-mode.md
 * @see docs/tickets/017-live-walking-mode.md
 */

import { useEffect } from 'react';
import { Circle, CircleMarker, useMap } from 'react-leaflet';
import type { GeolocationPosition } from '@/hooks/useGeolocationTracking';

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
}

// =============================================================================
// Constants
// =============================================================================

// WHY: Blue dot matches native map apps (Google Maps, Apple Maps)
const POSITION_DOT_COLOR = '#2563eb'; // blue-600
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
}: LivePositionMarkerProps) {
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
      <CircleMarker
        center={latLng}
        radius={POSITION_DOT_RADIUS}
        pathOptions={{
          color: '#ffffff',
          fillColor: POSITION_DOT_COLOR,
          fillOpacity: 1,
          opacity: 1,
          weight: 3,
        }}
      />
    </>
  );
}

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
 * Marker color changes based on distance to boundary:
 * - Green (#22c55e) when within 25m tolerance
 * - Blue (#3b82f6) when outside tolerance
 * 
 * @see docs/ADR/017-live-walking-mode.md
 * @see docs/tickets/017-live-walking-mode.md
 * @see docs/tickets/018-distance-indicator.md
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
  /** Whether within 25m tolerance of boundary - changes marker color */
  withinTolerance?: boolean;
}

// =============================================================================
// Constants
// =============================================================================

// WHY: Blue dot matches native map apps (Google Maps, Apple Maps)
// Used when outside tolerance or tolerance state unknown
const POSITION_DOT_COLOR_DEFAULT = '#3b82f6'; // blue-500 (matches PRD 3.13)
const POSITION_DOT_RADIUS = 8;

// WHY: Green indicates "on track" - within 25m tolerance per ADR 002/003
// Matches ROUTE_DEVIATION_COLORS.onTrack from design-tokens.ts
const POSITION_DOT_COLOR_ON_TRACK = '#22c55e'; // green-500

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
  withinTolerance,
}: LivePositionMarkerProps) {
  // WHY: Marker color indicates boundary proximity - green = on track, blue = needs adjustment
  // See TICKET-018 for distance indicator requirements
  const markerColor = withinTolerance ? POSITION_DOT_COLOR_ON_TRACK : POSITION_DOT_COLOR_DEFAULT;
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
      {/* WHY: Color indicates boundary proximity - see TICKET-018 */}
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

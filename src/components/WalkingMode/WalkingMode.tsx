'use client';

/**
 * WalkingMode Component
 * 
 * Full-screen overlay for real-time GPS navigation while walking sub-area boundaries.
 * Displays the boundary polygon, user's live position, and navigation controls.
 * 
 * WHY: Users need a dedicated, distraction-free view for outdoor navigation.
 * Full-screen maximizes map visibility and provides larger touch targets.
 * 
 * @see docs/ADR/017-live-walking-mode.md
 * @see docs/PRD/001-mvp-mobile-walker.md Section 3.13
 * @see docs/features/live-walking-mode.md
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import { useGeolocationTracking } from '@/hooks/useGeolocationTracking';
import { useWakeLock, isIOSSafari } from '@/hooks/useWakeLock';
import { TILE_LAYER_URL, WALKING_MODE_DEFAULT_ZOOM, FIT_BOUNDS_PADDING } from '@/lib/map-config';
import {
  TIER_FILL_COLORS,
  TIER_BORDER_COLORS,
  UNWALKED_AREA_STYLE,
} from '@/lib/design-tokens';
import type { Tier } from '@/lib/analysis';

import LivePositionMarker from './LivePositionMarker';
import WalkingControls from './WalkingControls';

// =============================================================================
// Types
// =============================================================================

interface WalkingModeProps {
  /** GeoJSON geometry of the sub-area boundary */
  geometry: GeoJSON.Geometry;
  /** Name of the sub-area being walked */
  areaName: string;
  /** Tier of the area (for boundary styling) */
  tier?: Tier;
  /** Callback when user exits walking mode */
  onExit: () => void;
}

// =============================================================================
// Constants
// =============================================================================

// WHY: Walking mode needs prominent boundary styling for outdoor visibility
const WALKING_BOUNDARY_STROKE_WEIGHT = 4;
const WALKING_BOUNDARY_FILL_OPACITY = 0.15;

// WHY: LocalStorage key for iOS tip dismissal
const IOS_TIP_DISMISSED_KEY = 'citycells_ios_wake_tip_dismissed';

// =============================================================================
// Sub-components
// =============================================================================

/**
 * Fits map bounds to geometry on mount.
 */
function FitBoundsOnMount({ geometry }: { geometry: GeoJSON.Geometry }) {
  const map = useMap();
  
  useEffect(() => {
    try {
      const geoJsonLayer = L.geoJSON(geometry as GeoJSON.GeoJsonObject);
      const bounds = geoJsonLayer.getBounds();
      
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: FIT_BOUNDS_PADDING });
      }
    } catch (e) {
      console.warn('[WalkingMode] Failed to fit bounds:', e);
    }
  }, [geometry, map]);
  
  return null;
}

/**
 * Map controller component for zoom and center actions.
 */
function MapController({ 
  mapRef 
}: { 
  mapRef: React.MutableRefObject<L.Map | null>;
}) {
  const map = useMap();
  
  useEffect(() => {
    mapRef.current = map;
  }, [map, mapRef]);
  
  return null;
}

// =============================================================================
// Main Component
// =============================================================================

export default function WalkingMode({
  geometry,
  areaName,
  tier,
  onExit,
}: WalkingModeProps) {
  const mapRef = useRef<L.Map | null>(null);
  const [autoCenter, setAutoCenter] = useState(true);
  const [showIOSTip, setShowIOSTip] = useState(false);
  const [trackingStartTime, setTrackingStartTime] = useState<number | null>(null);
  
  // Geolocation tracking
  const {
    position,
    accuracy,
    error: geoError,
    // WHY: permissionState and isTracking available for future enhancements
    // (e.g., showing permission prompt, tracking duration display)
    isAcquiring,
    startTracking,
    stopTracking,
  } = useGeolocationTracking();
  
  // Wake lock management
  const {
    isSupported: wakeLockSupported,
    isActive: wakeLockActive,
    request: requestWakeLock,
    release: releaseWakeLock,
  } = useWakeLock();
  
  // WHY: Check for iOS Safari to show tip about screen timeout
  useEffect(() => {
    if (isIOSSafari()) {
      const dismissed = localStorage.getItem(IOS_TIP_DISMISSED_KEY);
      if (!dismissed) {
        setShowIOSTip(true);
      }
    }
  }, []);
  
  // WHY: Start tracking and wake lock when component mounts
  useEffect(() => {
    startTracking();
    setTrackingStartTime(Date.now());
    
    if (wakeLockSupported) {
      requestWakeLock();
    }
    
    return () => {
      stopTracking();
      releaseWakeLock();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // WHY: Wrap geometry in GeoJSON Feature for the GeoJSON component
  const featureData = useMemo<GeoJSON.FeatureCollection>(() => ({
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: {},
      geometry,
    }],
  }), [geometry]);
  
  // WHY: Use tier colors for fill/stroke, fall back to unwalked style (matches AreaMiniMap)
  const fillColor = tier ? TIER_FILL_COLORS[tier] : UNWALKED_AREA_STYLE.borderColor;
  const borderColor = tier ? TIER_BORDER_COLORS[tier] : UNWALKED_AREA_STYLE.borderColor;
  
  const boundaryStyle = useMemo(() => ({
    color: borderColor,
    weight: WALKING_BOUNDARY_STROKE_WEIGHT,
    opacity: 1,
    fillColor,
    fillOpacity: WALKING_BOUNDARY_FILL_OPACITY,
  }), [fillColor, borderColor]);
  
  // ==========================================================================
  // Event Handlers
  // ==========================================================================
  
  const handleExit = useCallback(() => {
    // WHY: Show confirmation if user has been tracking for more than 1 minute
    const trackingDuration = trackingStartTime ? Date.now() - trackingStartTime : 0;
    const oneMinute = 60 * 1000;
    
    if (trackingDuration > oneMinute) {
      const confirmed = window.confirm('Exit walking mode? Your walk is being recorded by Strava separately.');
      if (!confirmed) return;
    }
    
    stopTracking();
    releaseWakeLock();
    onExit();
  }, [trackingStartTime, stopTracking, releaseWakeLock, onExit]);
  
  const handleCenterOnMe = useCallback(() => {
    if (mapRef.current && position) {
      mapRef.current.setView([position.latitude, position.longitude], mapRef.current.getZoom(), {
        animate: true,
        duration: 0.5,
      });
      setAutoCenter(true);
    }
  }, [position]);
  
  const handleZoomIn = useCallback(() => {
    if (mapRef.current) {
      mapRef.current.zoomIn();
    }
  }, []);
  
  const handleZoomOut = useCallback(() => {
    if (mapRef.current) {
      mapRef.current.zoomOut();
    }
  }, []);
  
  const handleDismissIOSTip = useCallback(() => {
    localStorage.setItem(IOS_TIP_DISMISSED_KEY, 'true');
    setShowIOSTip(false);
  }, []);
  
  // WHY: When user drags map, disable auto-center to respect their view choice
  const handleMapDrag = useCallback(() => {
    setAutoCenter(false);
  }, []);
  
  // ==========================================================================
  // Render
  // ==========================================================================
  
  return (
    <div className="fixed inset-0 z-[600] bg-white">
      {/* Map Container */}
      <MapContainer
        center={[55.59, 13.00]} // Default center, will be overridden by FitBounds
        zoom={WALKING_MODE_DEFAULT_ZOOM}
        className="h-full w-full"
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer url={TILE_LAYER_URL} />
        
        {/* Area Boundary */}
        <GeoJSON
          key={JSON.stringify(geometry)}
          data={featureData}
          style={boundaryStyle}
        />
        
        {/* Live Position Marker */}
        <LivePositionMarker
          position={position}
          autoCenter={autoCenter}
        />
        
        {/* Map utilities */}
        <FitBoundsOnMount geometry={geometry} />
        <MapController mapRef={mapRef} />
        
        {/* WHY: Detect user dragging map to disable auto-center */}
        <MapDragDetector onDrag={handleMapDrag} />
      </MapContainer>
      
      {/* Controls Overlay */}
      <WalkingControls
        onExit={handleExit}
        onCenterOnMe={handleCenterOnMe}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        wakeLockActive={wakeLockActive}
        wakeLockSupported={wakeLockSupported}
        isAcquiringGPS={isAcquiring}
        gpsAccuracy={accuracy}
        areaName={areaName}
      />
      
      {/* Permission Error Overlay */}
      {geoError?.type === 'permission_denied' && (
        <div className="absolute inset-0 z-[620] bg-black/70 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl p-6 max-w-sm text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Location Access Denied</h2>
            <p className="text-gray-600 mb-4">
              To use walking mode, please enable location access in your browser settings.
            </p>
            <button
              onClick={onExit}
              className="w-full bg-gray-900 text-white py-3 rounded-lg font-medium hover:bg-gray-800 transition-colors"
            >
              Go Back
            </button>
          </div>
        </div>
      )}
      
      {/* iOS Safari Tip */}
      {showIOSTip && (
        <div className="absolute bottom-24 left-4 right-4 z-[620]">
          <div className="bg-blue-600 rounded-xl p-4 text-white shadow-lg">
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
              </svg>
              <div className="flex-1">
                <p className="font-medium">Screen may turn off</p>
                <p className="text-sm text-blue-100 mt-1">
                  iOS Safari cannot keep the screen on. Go to Settings → Display & Brightness → Auto-Lock to increase screen timeout.
                </p>
              </div>
              <button
                onClick={handleDismissIOSTip}
                className="shrink-0 text-blue-200 hover:text-white"
                aria-label="Dismiss tip"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Map Drag Detector
// =============================================================================

/**
 * Detects when user drags the map to disable auto-centering.
 */
function MapDragDetector({ onDrag }: { onDrag: () => void }) {
  const map = useMap();
  
  useEffect(() => {
    map.on('dragstart', onDrag);
    return () => {
      map.off('dragstart', onDrag);
    };
  }, [map, onDrag]);
  
  return null;
}

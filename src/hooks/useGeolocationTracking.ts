'use client';

/**
 * useGeolocationTracking Hook
 * 
 * Manages continuous GPS position tracking using the browser Geolocation API.
 * Provides permission state handling, error management, and automatic cleanup.
 * 
 * WHY: Live Walking Mode requires continuous position updates to show user
 * location relative to sub-area boundaries. watchPosition() is more efficient
 * than repeated getCurrentPosition() calls.
 * 
 * @see docs/ADR/017-live-walking-mode.md
 * @see docs/tickets/017-live-walking-mode.md
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// =============================================================================
// Types
// =============================================================================

export type PermissionState = 'prompt' | 'granted' | 'denied' | null;

export interface GeolocationError {
  code: number;
  message: string;
  type: 'permission_denied' | 'position_unavailable' | 'timeout' | 'unknown';
}

export interface GeolocationPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude: number | null;
  altitudeAccuracy: number | null;
  heading: number | null;
  speed: number | null;
  timestamp: number;
}

export interface UseGeolocationTrackingReturn {
  /** Current position, or null if not yet acquired */
  position: GeolocationPosition | null;
  /** Current accuracy in meters, or null if not yet acquired */
  accuracy: number | null;
  /** Current error, or null if no error */
  error: GeolocationError | null;
  /** Permission state: 'prompt', 'granted', 'denied', or null if not yet queried */
  permissionState: PermissionState;
  /** Whether tracking is currently active */
  isTracking: boolean;
  /** Whether we're waiting for the first position fix */
  isAcquiring: boolean;
  /** Start tracking position updates */
  startTracking: () => void;
  /** Stop tracking position updates */
  stopTracking: () => void;
}

// =============================================================================
// Constants
// =============================================================================

// WHY: High accuracy required for GPS precision during walking navigation
// maximumAge: 0 ensures no cached positions (real-time updates)
// timeout: 10000ms gives GPS time to acquire lock in challenging conditions
const GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 0,
  timeout: 10000,
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Convert GeolocationPositionError to our typed error format.
 */
function mapGeolocationError(error: GeolocationPositionError): GeolocationError {
  let type: GeolocationError['type'];
  
  switch (error.code) {
    case error.PERMISSION_DENIED:
      type = 'permission_denied';
      break;
    case error.POSITION_UNAVAILABLE:
      type = 'position_unavailable';
      break;
    case error.TIMEOUT:
      type = 'timeout';
      break;
    default:
      type = 'unknown';
  }
  
  return {
    code: error.code,
    message: error.message,
    type,
  };
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useGeolocationTracking(): UseGeolocationTrackingReturn {
  const [position, setPosition] = useState<GeolocationPosition | null>(null);
  const [error, setError] = useState<GeolocationError | null>(null);
  const [permissionState, setPermissionState] = useState<PermissionState>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [isAcquiring, setIsAcquiring] = useState(false);
  
  // WHY: Use ref to store watch ID for cleanup
  const watchIdRef = useRef<number | null>(null);
  
  // WHY: Check permission state on mount (where Permissions API is available)
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.permissions) {
      // Permissions API not available (e.g., older browsers, iOS Safari)
      // We'll determine permission state when user starts tracking
      return;
    }
    
    navigator.permissions.query({ name: 'geolocation' }).then((result) => {
      setPermissionState(result.state as PermissionState);
      
      // WHY: Listen for permission changes (user can change in settings)
      result.addEventListener('change', () => {
        setPermissionState(result.state as PermissionState);
      });
    }).catch(() => {
      // Permissions API query failed - not critical
      console.warn('[useGeolocationTracking] Permissions API query failed');
    });
  }, []);
  
  /**
   * Handle successful position update.
   */
  const handlePositionSuccess = useCallback((pos: globalThis.GeolocationPosition) => {
    const coords = pos.coords;
    const mappedPosition: GeolocationPosition = {
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy: coords.accuracy,
      altitude: coords.altitude,
      altitudeAccuracy: coords.altitudeAccuracy,
      heading: coords.heading,
      speed: coords.speed,
      timestamp: pos.timestamp,
    };
    
    setPosition(mappedPosition);
    setError(null);
    setIsAcquiring(false);
  }, []);
  
  /**
   * Handle position error.
   */
  const handlePositionError = useCallback((err: GeolocationPositionError) => {
    const mappedError = mapGeolocationError(err);
    setError(mappedError);
    setIsAcquiring(false);
    
    // WHY: Update permission state if permission was denied
    if (mappedError.type === 'permission_denied') {
      setPermissionState('denied');
    }
    
    console.warn('[useGeolocationTracking] Position error:', mappedError);
  }, []);
  
  /**
   * Start continuous position tracking.
   */
  const startTracking = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError({
        code: 0,
        message: 'Geolocation is not supported by this browser',
        type: 'unknown',
      });
      return;
    }
    
    // WHY: Clear any existing watch before starting a new one
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    
    setIsTracking(true);
    setIsAcquiring(true);
    setError(null);
    
    // WHY: watchPosition provides continuous updates without manual polling
    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePositionSuccess,
      handlePositionError,
      GEOLOCATION_OPTIONS
    );
  }, [handlePositionSuccess, handlePositionError]);
  
  /**
   * Stop position tracking.
   */
  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    
    setIsTracking(false);
    setIsAcquiring(false);
  }, []);
  
  // WHY: Clean up watch on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);
  
  return {
    position,
    accuracy: position?.accuracy ?? null,
    error,
    permissionState,
    isTracking,
    isAcquiring,
    startTracking,
    stopTracking,
  };
}

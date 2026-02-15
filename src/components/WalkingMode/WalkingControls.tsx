'use client';

/**
 * WalkingControls Component
 * 
 * Control buttons for Walking Mode: exit, center-on-me, zoom, and status indicators.
 * Positioned as floating controls over the full-screen map.
 * 
 * @see docs/ADR/017-live-walking-mode.md
 * @see docs/tickets/017-live-walking-mode.md
 */



// =============================================================================
// Types
// =============================================================================

interface WalkingControlsProps {
  /** Callback when user taps exit button */
  onExit: () => void;
  /** Callback when user taps center-on-me button */
  onCenterOnMe: () => void;
  /** Callback when user taps zoom in */
  onZoomIn: () => void;
  /** Callback when user taps zoom out */
  onZoomOut: () => void;
  /** Whether wake lock is currently active */
  wakeLockActive: boolean;
  /** Whether wake lock is supported in this browser */
  wakeLockSupported: boolean;
  /** Whether we're currently acquiring GPS position */
  isAcquiringGPS: boolean;
  /** Current GPS accuracy in meters, or null if not available */
  gpsAccuracy: number | null;
  /** Area name being walked */
  areaName: string;
}

// =============================================================================
// Component
// =============================================================================

export default function WalkingControls({
  onExit,
  onCenterOnMe,
  onZoomIn,
  onZoomOut,
  wakeLockActive,
  wakeLockSupported,
  isAcquiringGPS,
  gpsAccuracy,
  areaName,
}: WalkingControlsProps) {
  return (
    <>
      {/* Top Bar - Exit button and area name */}
      <div className="absolute top-0 left-0 right-0 z-[610] bg-gradient-to-b from-black/50 to-transparent pt-safe">
        <div className="flex items-center gap-3 p-4">
          {/* Exit Button */}
          <button
            onClick={onExit}
            className="w-12 h-12 bg-white/90 backdrop-blur-sm rounded-full shadow-lg flex items-center justify-center text-gray-700 hover:bg-white active:bg-gray-100 transition-colors"
            aria-label="Exit walking mode"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          {/* Area Name */}
          <div className="flex-1 min-w-0">
            <h1 className="text-white font-semibold text-lg truncate drop-shadow-lg">
              {areaName}
            </h1>
            <p className="text-white/80 text-sm drop-shadow">Walking Mode</p>
          </div>
          
          {/* Status Indicators */}
          <div className="flex items-center gap-2">
            {/* GPS Acquiring Indicator */}
            {isAcquiringGPS && (
              <div className="bg-yellow-500/90 backdrop-blur-sm rounded-full px-3 py-1.5 flex items-center gap-2">
                <svg className="w-4 h-4 text-white animate-pulse" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0013 3.06V1h-2v2.06A8.994 8.994 0 003.06 11H1v2h2.06A8.994 8.994 0 0011 20.94V23h2v-2.06A8.994 8.994 0 0020.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/>
                </svg>
                <span className="text-white text-xs font-medium">GPS...</span>
              </div>
            )}
            
            {/* Wake Lock Indicator */}
            {wakeLockSupported && wakeLockActive && (
              <div 
                className="bg-green-600/90 backdrop-blur-sm rounded-full p-2"
                title="Screen will stay on"
              >
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17 1H7c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-2-2-2zm0 18H7V5h10v14z"/>
                </svg>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Right Side Controls - Zoom and Center */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 z-[610] flex flex-col gap-2">
        {/* Center on Me Button */}
        <button
          onClick={onCenterOnMe}
          className="w-12 h-12 bg-white/90 backdrop-blur-sm rounded-full shadow-lg flex items-center justify-center text-blue-600 hover:bg-white active:bg-gray-100 transition-colors"
          aria-label="Center on my position"
        >
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0013 3.06V1h-2v2.06A8.994 8.994 0 003.06 11H1v2h2.06A8.994 8.994 0 0011 20.94V23h2v-2.06A8.994 8.994 0 0020.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/>
          </svg>
        </button>
        
        {/* Zoom In Button */}
        <button
          onClick={onZoomIn}
          className="w-12 h-12 bg-white/90 backdrop-blur-sm rounded-full shadow-lg flex items-center justify-center text-gray-700 hover:bg-white active:bg-gray-100 transition-colors"
          aria-label="Zoom in"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </button>
        
        {/* Zoom Out Button */}
        <button
          onClick={onZoomOut}
          className="w-12 h-12 bg-white/90 backdrop-blur-sm rounded-full shadow-lg flex items-center justify-center text-gray-700 hover:bg-white active:bg-gray-100 transition-colors"
          aria-label="Zoom out"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6" />
          </svg>
        </button>
      </div>
      
      {/* Bottom Status Bar - GPS Accuracy */}
      {gpsAccuracy !== null && !isAcquiringGPS && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[610]">
          <div className="bg-black/60 backdrop-blur-sm rounded-full px-4 py-2 text-white text-sm">
            GPS accuracy: ±{Math.round(gpsAccuracy)}m
          </div>
        </div>
      )}
    </>
  );
}

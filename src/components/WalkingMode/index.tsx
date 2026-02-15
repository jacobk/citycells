'use client';

/**
 * WalkingMode Component Barrel Export
 * 
 * WHY: Uses dynamic import with ssr: false because Leaflet requires window
 * to be defined. Same pattern as Map and AreaMiniMap components.
 * 
 * Note: LivePositionMarker and WalkingControls are internal to WalkingMode
 * and are not exported here because they use react-leaflet which requires
 * browser APIs.
 * 
 * @see docs/ADR/017-live-walking-mode.md
 */

import dynamic from 'next/dynamic';

// WHY: Dynamic import with ssr: false to avoid "window is not defined" error
// Leaflet requires browser APIs that don't exist during server-side rendering
const WalkingMode = dynamic(() => import('./WalkingMode'), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 z-[600] bg-gray-100 animate-pulse flex items-center justify-center">
      <div className="text-gray-500 text-center">
        <div className="text-lg font-medium">Starting Walking Mode...</div>
        <div className="text-sm mt-1">Initializing GPS</div>
      </div>
    </div>
  ),
});

export { WalkingMode };

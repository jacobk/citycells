'use client';

import dynamic from 'next/dynamic';

/**
 * MaximizedMapModal dynamic import wrapper
 * 
 * WHY: Dynamic import required because Leaflet accesses `window` which
 * is not available during SSR. Same pattern as Map/index.tsx and AreaMiniMap/index.tsx.
 */
const MaximizedMapModal = dynamic(() => import('./MaximizedMapModal'), {
  ssr: false,
  loading: () => null, // Modal loading state handled internally
});

export default MaximizedMapModal;

// Re-export types for consumers
export type { WalkData } from './MaximizedMapModal';

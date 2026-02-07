'use client';

import dynamic from 'next/dynamic';

// WHY: Dynamic import required because Leaflet accesses `window` which
// is not available during SSR. Same pattern as Map/index.tsx.
const AreaMiniMap = dynamic(() => import('./AreaMiniMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[200px] rounded-lg bg-gray-100 animate-pulse flex items-center justify-center text-gray-400 text-xs">
      Loading map...
    </div>
  ),
});

export default AreaMiniMap;

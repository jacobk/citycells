'use client';
import dynamic from 'next/dynamic';

// Re-export types for use in other components
export type { AreaClickData, ProgressInfo } from './Map';

const Map = dynamic(() => import('./Map'), {
  ssr: false,
  loading: () => (
    <div className="h-screen w-full bg-gray-100 animate-pulse flex items-center justify-center text-gray-500">
      Loading CityCells Map...
    </div>
  )
});

export default Map;

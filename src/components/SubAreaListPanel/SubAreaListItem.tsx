'use client';

import { getTierColor, type Tier } from '@/lib/analysis';

// ============================================
// Types
// ============================================

export interface SubAreaListItemData {
  areaId: number;
  areaName: string;
  perimeterMeters: number;
  tier: Tier;
  walkCount: number;
}

interface SubAreaListItemProps {
  data: SubAreaListItemData;
  onClick: (areaId: number) => void;
}

// ============================================
// Component
// ============================================

/**
 * SubAreaListItem Component
 * 
 * Individual row in the sub-area list showing area name, circumference,
 * completion status, and walk count.
 * 
 * See PRD 001 Section 3.10 for list item display requirements.
 */
export default function SubAreaListItem({ data, onClick }: SubAreaListItemProps) {
  const { areaId, areaName, perimeterMeters, tier, walkCount } = data;
  
  // Format circumference in km
  const circumferenceKm = (perimeterMeters / 1000).toFixed(1);
  
  const tierColor = tier ? getTierColor(tier) : undefined;

  return (
    <button
      onClick={() => onClick(areaId)}
      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-secondary transition-colors border-b border-border last:border-b-0 text-left cursor-pointer"
    >
      {/* Status Indicator - Tier badge or empty circle */}
      <div className="flex-shrink-0">
        {tier ? (
          <div 
            className="w-4 h-4 rounded-full"
            style={{ backgroundColor: tierColor }}
            title={`${tier.charAt(0).toUpperCase() + tier.slice(1)} tier`}
          />
        ) : (
          <div 
            className="w-4 h-4 rounded-full border-2 border-muted-foreground/30"
            title="Not completed"
          />
        )}
      </div>

      {/* Area Info */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground truncate">
          {areaName}
        </div>
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <span>{circumferenceKm} km</span>
          {walkCount > 0 && (
            <>
              <span className="text-muted-foreground/50">•</span>
              <span>{walkCount} {walkCount === 1 ? 'walk' : 'walks'}</span>
            </>
          )}
        </div>
      </div>

      {/* Chevron */}
      <div className="flex-shrink-0 text-muted-foreground">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </button>
  );
}

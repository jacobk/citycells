'use client';

/**
 * DistanceTierLegend Component
 * 
 * Displays a legend explaining the distance tier color system used for
 * walk route visualization. Shows all 6 tiers from Platinum (0-10m) to
 * Missed (>50m) with their corresponding colors.
 * 
 * WHY: Users need to understand what the walk segment colors mean.
 * ADR 022 requires a legend in the maximized map modal, and ADR 021
 * defines the tiered distance scoring system.
 * 
 * @see docs/ADR/022-scrollable-minimap-with-maximize.md
 * @see docs/ADR/021-tiered-distance-scoring.md
 */

import { DISTANCE_TIER_COLORS } from '@/lib/design-tokens';
import { DISTANCE_TIER_THRESHOLDS, type DistanceTier } from '@/lib/distance-tiers';

interface DistanceTierLegendProps {
  className?: string;
  // WHY: Compact mode for space-constrained contexts (e.g., modal control panel)
  compact?: boolean;
}

// WHY: Ordered array for consistent rendering from best (platinum) to worst (missed)
const TIER_ORDER: DistanceTier[] = ['platinum', 'gold', 'silver', 'bronze', 'potato', 'missed'];

// WHY: Human-readable labels for each tier
const TIER_LABELS: Record<DistanceTier, string> = {
  platinum: 'Platinum',
  gold: 'Gold',
  silver: 'Silver',
  bronze: 'Bronze',
  potato: 'Potato',
  missed: 'Missed',
};

// WHY: Distance range descriptions for user understanding
function getTierDistanceLabel(tier: DistanceTier): string {
  switch (tier) {
    case 'platinum':
      return `0-${DISTANCE_TIER_THRESHOLDS.platinum}m`;
    case 'gold':
      return `${DISTANCE_TIER_THRESHOLDS.platinum + 1}-${DISTANCE_TIER_THRESHOLDS.gold}m`;
    case 'silver':
      return `${DISTANCE_TIER_THRESHOLDS.gold + 1}-${DISTANCE_TIER_THRESHOLDS.silver}m`;
    case 'bronze':
      return `${DISTANCE_TIER_THRESHOLDS.silver + 1}-${DISTANCE_TIER_THRESHOLDS.bronze}m`;
    case 'potato':
      return `${DISTANCE_TIER_THRESHOLDS.bronze + 1}-${DISTANCE_TIER_THRESHOLDS.potato}m`;
    case 'missed':
      return `>${DISTANCE_TIER_THRESHOLDS.potato}m`;
  }
}

export default function DistanceTierLegend({ className, compact = false }: DistanceTierLegendProps) {
  if (compact) {
    // WHY: Compact horizontal layout for control panels
    return (
      <div className={`flex flex-wrap gap-x-3 gap-y-1 ${className ?? ''}`}>
        {TIER_ORDER.map(tier => (
          <div key={tier} className="flex items-center gap-1.5">
            <div 
              className="w-3 h-3 rounded-sm shrink-0"
              style={{ backgroundColor: DISTANCE_TIER_COLORS[tier] }}
            />
            <span className="text-xs text-muted-foreground">
              {getTierDistanceLabel(tier)}
            </span>
          </div>
        ))}
      </div>
    );
  }

  // WHY: Full vertical layout with tier names and distance ranges
  return (
    <div className={`space-y-1.5 ${className ?? ''}`}>
      <h4 className="text-xs font-semibold text-muted-foreground mb-2">
        Distance from Boundary
      </h4>
      {TIER_ORDER.map(tier => (
        <div key={tier} className="flex items-center gap-2">
          {/* Color swatch */}
          <div 
            className="w-4 h-4 rounded-sm shrink-0"
            style={{ backgroundColor: DISTANCE_TIER_COLORS[tier] }}
          />
          {/* Tier name */}
          <span className="text-xs font-medium text-foreground min-w-[60px]">
            {TIER_LABELS[tier]}
          </span>
          {/* Distance range */}
          <span className="text-xs text-muted-foreground">
            {getTierDistanceLabel(tier)}
          </span>
        </div>
      ))}
    </div>
  );
}

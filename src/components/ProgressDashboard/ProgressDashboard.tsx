'use client';

import { getTierColor } from '@/lib/analysis';
import { formatDistance } from '@/lib/format-utils';
import { TIER_ORDER, TIER_LABELS, type TierCounts, type TierKey } from '@/lib/types/tiers';

interface ProgressDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  completedCount: number;
  totalAreas: number;
  tierCounts: TierCounts;
  athleteName?: string;
  athleteProfile?: string;
  // WHY: Distance metrics for progress tracking (Ticket 012)
  // Undefined means metrics haven't been loaded yet, 0 means no distance
  theoreticalDistance?: number;
  totalPerimeterDistance?: number;
  actualWalkedDistance?: number;
}

/**
 * ProgressDashboard Component
 * 
 * A slide-out drawer showing detailed progress statistics.
 * See PRD 001 section 3.5 and PROJECT_PLAN Phase 5.5.
 * 
 * Features:
 * - Overall completion percentage
 * - Tier breakdown with counts and visual bars
 * - Loading states handled by parent
 */
export default function ProgressDashboard({
  isOpen,
  onClose,
  completedCount,
  totalAreas,
  tierCounts,
  athleteName,
  athleteProfile,
  theoreticalDistance,
  totalPerimeterDistance,
  actualWalkedDistance,
}: ProgressDashboardProps) {
  const percentage = totalAreas > 0 ? (completedCount / totalAreas) * 100 : 0;
  const remainingAreas = totalAreas - completedCount;

  // WHY: Check if distance metrics are available (not undefined)
  const hasDistanceMetrics = theoreticalDistance !== undefined && 
                              totalPerimeterDistance !== undefined && 
                              actualWalkedDistance !== undefined;

  // WHY: Calculate distance progress percentage (theoretical vs total perimeter)
  // Cap at 100% to handle edge case where theoretical equals total
  const distanceProgressPercentage = hasDistanceMetrics && totalPerimeterDistance > 0
    ? Math.min((theoreticalDistance! / totalPerimeterDistance!) * 100, 100)
    : 0;

  // WHY: Calculate difference between actual and theoretical distance
  // Positive = detours/multiple walks, negative = rare GPS errors
  const distanceDifference = hasDistanceMetrics 
    ? actualWalkedDistance! - theoreticalDistance!
    : 0;

  // WHY: Use shared TIER_ORDER for consistent tier iteration across components
  // Maps tier keys to objects with key and label for rendering
  const tiers: Array<{ key: TierKey; label: string }> = TIER_ORDER.map(key => ({
    key,
    label: TIER_LABELS[key],
  }));

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/30 z-[500] transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Drawer */}
      {/* WHY: Using design system tokens for dark mode support */}
      <div
        className={`fixed top-0 right-0 h-full w-80 bg-card shadow-2xl z-[501] transform transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Progress Dashboard</h2>
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground -mr-2"
            aria-label="Close dashboard"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content - scrollable on small displays */}
        {/* WHY: max-h-[calc(100vh-65px)] accounts for header height (~57px) plus padding */}
        <div className="p-5 space-y-6 overflow-y-auto max-h-[calc(100vh-65px)]">
          
          {/* User Info */}
          {athleteName && (
            <div className="flex items-center gap-3">
              {athleteProfile && (
                <img 
                  src={athleteProfile} 
                  alt={athleteName}
                  className="w-12 h-12 rounded-full border border-border"
                />
              )}
              <div>
                <div className="font-semibold text-foreground">{athleteName}</div>
                <div className="text-sm text-muted-foreground">Explorer</div>
              </div>
            </div>
          )}

          {/* Overall Progress */}
          <div className="bg-secondary rounded-xl p-4">
            <div className="text-sm text-muted-foreground mb-1">Overall Progress</div>
            <div className="text-3xl font-bold text-foreground mb-2">
              {percentage.toFixed(1)}%
            </div>
            <div className="text-sm text-muted-foreground mb-3">
              {completedCount} of {totalAreas} areas completed
            </div>
            
            {/* Progress bar */}
            <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-orange-500 to-orange-400 transition-all duration-1000"
                style={{ width: `${percentage}%` }}
              />
            </div>
            
            {remainingAreas > 0 && (
              <div className="text-xs text-muted-foreground mt-2">
                {remainingAreas} areas remaining
              </div>
            )}
          </div>

          {/* Distance Progress (Ticket 012) */}
          {hasDistanceMetrics && (
            <div className="bg-blue-500/10 dark:bg-blue-500/20 rounded-xl p-4">
              <div className="text-sm text-muted-foreground mb-1">Distance Progress</div>
              <div className="text-sm text-muted-foreground mb-3">
                Walked {formatDistance(theoreticalDistance!)} of {formatDistance(totalPerimeterDistance!)}
              </div>
              
              {/* Distance progress bar */}
              <div className="w-full bg-muted rounded-full h-3 overflow-hidden mb-3">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-1000"
                  style={{ width: `${distanceProgressPercentage}%` }}
                />
              </div>

              {/* Secondary stats */}
              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Actual walked:</span>
                  <span className="font-medium">{formatDistance(actualWalkedDistance!)}</span>
                </div>
                {distanceDifference !== 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Difference:</span>
                    <span className={`font-medium ${distanceDifference > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'}`}>
                      {distanceDifference > 0 ? '+' : ''}{formatDistance(Math.abs(distanceDifference))}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tier Breakdown */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Tier Breakdown</h3>
            <div className="space-y-3">
              {tiers.map(({ key, label }) => {
                const count = tierCounts[key];
                const tierPercentage = completedCount > 0 ? (count / completedCount) * 100 : 0;
                const color = getTierColor(key);

                return (
                  <div key={key} className="flex items-center gap-3">
                    <div 
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-muted-foreground">{label}</span>
                        <span className="text-sm font-medium text-foreground">{count}</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1.5">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ 
                            width: `${tierPercentage}%`,
                            backgroundColor: color
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-secondary rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-foreground">{completedCount}</div>
              <div className="text-xs text-muted-foreground">Completed</div>
            </div>
            <div className="bg-secondary rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-foreground">{remainingAreas}</div>
              <div className="text-xs text-muted-foreground">Remaining</div>
            </div>
            <div className="bg-secondary rounded-lg p-3 text-center">
              <div className="text-2xl font-bold" style={{ color: getTierColor('platinum') }}>
                {tierCounts.platinum}
              </div>
              <div className="text-xs text-muted-foreground">Platinum</div>
            </div>
            <div className="bg-secondary rounded-lg p-3 text-center">
              <div className="text-2xl font-bold" style={{ color: getTierColor('gold') }}>
                {tierCounts.gold}
              </div>
              <div className="text-xs text-muted-foreground">Gold</div>
            </div>
          </div>

          {/* Motivation Message */}
          {completedCount > 0 && completedCount < totalAreas && (
            <div className="text-center py-4 text-muted-foreground text-sm">
              {percentage < 25 && "Great start! Keep exploring Malmö! 🚶"}
              {percentage >= 25 && percentage < 50 && "You're making progress! 💪"}
              {percentage >= 50 && percentage < 75 && "Over halfway there! Amazing! 🎯"}
              {percentage >= 75 && percentage < 100 && "So close to conquering Malmö! 🏆"}
            </div>
          )}
          
          {completedCount === totalAreas && totalAreas > 0 && (
            <div className="text-center py-4 bg-orange-500/10 dark:bg-orange-500/20 rounded-xl">
              <div className="text-2xl mb-2">🏆</div>
              <div className="font-bold text-foreground">Malmö Conquered!</div>
              <div className="text-sm text-muted-foreground">You&apos;ve walked every sub-area!</div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

'use client';

import { getTierColor } from '@/lib/analysis';

interface TierStats {
  platinum: number;
  gold: number;
  silver: number;
  bronze: number;
}

interface ProgressDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  completedCount: number;
  totalAreas: number;
  tierCounts: TierStats;
  athleteName?: string;
  athleteProfile?: string;
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
}: ProgressDashboardProps) {
  const percentage = totalAreas > 0 ? (completedCount / totalAreas) * 100 : 0;
  const remainingAreas = totalAreas - completedCount;

  // WHY: Explicit non-null tier keys for iteration
  type NonNullTier = 'platinum' | 'gold' | 'silver' | 'bronze';
  const tiers: Array<{ key: NonNullTier; label: string }> = [
    { key: 'platinum', label: 'Platinum' },
    { key: 'gold', label: 'Gold' },
    { key: 'silver', label: 'Silver' },
    { key: 'bronze', label: 'Bronze' },
  ];

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
      <div
        className={`fixed top-0 right-0 h-full w-80 bg-white shadow-2xl z-[501] transform transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Progress Dashboard</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 -mr-2"
            aria-label="Close dashboard"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-6">
          
          {/* User Info */}
          {athleteName && (
            <div className="flex items-center gap-3">
              {athleteProfile && (
                <img 
                  src={athleteProfile} 
                  alt={athleteName}
                  className="w-12 h-12 rounded-full border border-gray-200"
                />
              )}
              <div>
                <div className="font-semibold text-gray-900">{athleteName}</div>
                <div className="text-sm text-gray-500">Explorer</div>
              </div>
            </div>
          )}

          {/* Overall Progress */}
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4">
            <div className="text-sm text-gray-500 mb-1">Overall Progress</div>
            <div className="text-3xl font-bold text-gray-900 mb-2">
              {percentage.toFixed(1)}%
            </div>
            <div className="text-sm text-gray-600 mb-3">
              {completedCount} of {totalAreas} areas completed
            </div>
            
            {/* Progress bar */}
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-orange-500 to-orange-400 transition-all duration-1000"
                style={{ width: `${percentage}%` }}
              />
            </div>
            
            {remainingAreas > 0 && (
              <div className="text-xs text-gray-500 mt-2">
                {remainingAreas} areas remaining
              </div>
            )}
          </div>

          {/* Tier Breakdown */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Tier Breakdown</h3>
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
                        <span className="text-sm text-gray-700">{label}</span>
                        <span className="text-sm font-medium text-gray-900">{count}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
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
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-gray-900">{completedCount}</div>
              <div className="text-xs text-gray-500">Completed</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-gray-900">{remainingAreas}</div>
              <div className="text-xs text-gray-500">Remaining</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold" style={{ color: getTierColor('platinum') }}>
                {tierCounts.platinum}
              </div>
              <div className="text-xs text-gray-500">Platinum</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold" style={{ color: getTierColor('gold') }}>
                {tierCounts.gold}
              </div>
              <div className="text-xs text-gray-500">Gold</div>
            </div>
          </div>

          {/* Motivation Message */}
          {completedCount > 0 && completedCount < totalAreas && (
            <div className="text-center py-4 text-gray-600 text-sm">
              {percentage < 25 && "Great start! Keep exploring Malmö! 🚶"}
              {percentage >= 25 && percentage < 50 && "You're making progress! 💪"}
              {percentage >= 50 && percentage < 75 && "Over halfway there! Amazing! 🎯"}
              {percentage >= 75 && percentage < 100 && "So close to conquering Malmö! 🏆"}
            </div>
          )}
          
          {completedCount === totalAreas && totalAreas > 0 && (
            <div className="text-center py-4 bg-gradient-to-r from-orange-100 to-amber-100 rounded-xl">
              <div className="text-2xl mb-2">🏆</div>
              <div className="font-bold text-gray-900">Malmö Conquered!</div>
              <div className="text-sm text-gray-600">You&apos;ve walked every sub-area!</div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

'use client';

import { useEffect } from 'react';
import AchievementCard from './AchievementCard';
import { CATEGORY_LABELS, CATEGORY_ORDER, type AchievementCategory } from '@/lib/achievements';
import type { AchievementWithStatus } from '@/hooks/useAchievements';

// ============================================
// Types
// ============================================

// WHY: Create a stable empty Map at module level to avoid recreating on every render
const EMPTY_MAP = new Map<AchievementCategory, AchievementWithStatus[]>();

interface AchievementBrowserProps {
  isOpen: boolean;
  onClose: () => void;
  achievements: AchievementWithStatus[];
  achievementsByCategory?: Map<AchievementCategory, AchievementWithStatus[]>;
  unlockedCount?: number;
  totalCount?: number;
  loading?: boolean;
}

// ============================================
// Component
// ============================================

/**
 * AchievementBrowser Component
 * 
 * A slide-up bottom sheet showing all achievements grouped by category.
 * Users can browse achievements, see completion status, and unlock dates.
 * 
 * See PRD Section 3.15 for achievement browser requirements.
 * Follows SubAreaListPanel pattern for consistency.
 */
export default function AchievementBrowser({
  isOpen,
  onClose,
  achievementsByCategory,
  unlockedCount = 0,
  totalCount = 0,
  loading = false,
}: AchievementBrowserProps) {
  // WHY: Use module-level empty Map as fallback to guarantee .get() always works
  // This handles edge cases during HMR/force refresh where props might be undefined
  const safeAchievementsByCategory = (achievementsByCategory && achievementsByCategory instanceof Map) 
    ? achievementsByCategory 
    : EMPTY_MAP;

  // Prevent body scroll when panel is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Calculate progress percentage
  const progressPercent = totalCount > 0 ? (unlockedCount / totalCount) * 100 : 0;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/30 z-[500] transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`fixed bottom-0 left-0 right-0 bg-card rounded-t-2xl z-[501] transform transition-transform duration-300 ease-out max-h-[85vh] overflow-hidden flex flex-col ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        {/* Drag Handle */}
        <div className="flex justify-center py-2 cursor-grab" onClick={onClose}>
          <div className="w-12 h-1 bg-muted-foreground/30 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-4 pb-3 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                <span>Achievements</span>
                {loading && (
                  <svg className="animate-spin h-4 w-4 text-primary" viewBox="0 0 24 24">
                    <circle 
                      className="opacity-25" 
                      cx="12" cy="12" r="10" 
                      stroke="currentColor" 
                      strokeWidth="4"
                      fill="none"
                    />
                    <path 
                      className="opacity-75" 
                      fill="currentColor" 
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                )}
              </h2>
              <p className="text-sm text-muted-foreground">
                {unlockedCount} of {totalCount} unlocked
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-muted-foreground hover:text-foreground -mr-2"
              aria-label="Close panel"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Progress Bar */}
          <div className="mt-3">
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-500 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1 text-right">
              {progressPercent.toFixed(0)}% complete
            </p>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          {CATEGORY_ORDER.map(category => {
            const categoryAchievements = safeAchievementsByCategory.get(category) ?? [];
            if (categoryAchievements.length === 0) return null;
            
            const categoryUnlocked = categoryAchievements.filter(a => a.isUnlocked).length;
            
            return (
              <div key={category} className="px-4 py-3 border-b border-border last:border-b-0">
                {/* Category Header */}
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-foreground">
                    {CATEGORY_LABELS[category]}
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    {categoryUnlocked}/{categoryAchievements.length}
                  </span>
                </div>
                
                {/* Achievement Cards */}
                <div className="space-y-2">
                  {categoryAchievements.map(achievement => (
                    <AchievementCard
                      key={achievement.achievement.id}
                      achievement={achievement}
                    />
                  ))}
                </div>
              </div>
            );
          })}
          
          {/* Empty State */}
          {safeAchievementsByCategory.size === 0 && !loading && (
            <div className="px-4 py-8 text-center text-muted-foreground">
              <p>Loading achievements...</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

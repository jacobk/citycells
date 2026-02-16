'use client';

import { useEffect } from 'react';
import type { Achievement } from '@/lib/achievements';

// ============================================
// Types
// ============================================

interface AchievementModalProps {
  isOpen: boolean;
  onClose: () => void;
  achievements: Achievement[];
}

// ============================================
// Component
// ============================================

/**
 * AchievementModal Component
 * 
 * A centered modal overlay displaying newly unlocked achievements.
 * Shows when user earns achievements after analysis completes.
 * 
 * See PRD Section 3.15 for achievement notification requirements.
 * Follows ExemptionModal pattern for consistency.
 */
export default function AchievementModal({
  isOpen,
  onClose,
  achievements,
}: AchievementModalProps) {
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

  if (!isOpen || achievements.length === 0) return null;

  const isMultiple = achievements.length > 1;
  const title = isMultiple ? 'Achievements Unlocked!' : 'Achievement Unlocked!';

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-[700] flex items-center justify-center p-4"
        onClick={onClose}
      >
        {/* Modal */}
        <div
          className="bg-card rounded-2xl shadow-2xl max-w-sm w-full animate-in fade-in zoom-in-95 duration-300 overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header with gradient background */}
          <div className="bg-gradient-to-br from-primary/20 to-primary/5 px-6 py-5 text-center">
            {/* Trophy icon */}
            <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-4xl">🏆</span>
            </div>
            <h2 className="text-xl font-bold text-foreground">{title}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {isMultiple 
                ? `You earned ${achievements.length} achievements!` 
                : 'Congratulations on your accomplishment!'}
            </p>
          </div>

          {/* Achievement List */}
          <div className="px-6 py-4 max-h-[50vh] overflow-y-auto">
            <div className="space-y-3">
              {achievements.map(achievement => (
                <div
                  key={achievement.id}
                  className="flex items-center gap-4 p-3 bg-secondary/50 rounded-xl"
                >
                  {/* Large emoji icon */}
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <span className="text-3xl">{achievement.icon}</span>
                  </div>
                  
                  {/* Achievement info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground text-base">
                      {achievement.name}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {achievement.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Dismiss Button */}
          <div className="px-6 pb-6 pt-2">
            <button
              onClick={onClose}
              className="w-full px-4 py-3 bg-primary text-primary-foreground rounded-xl font-semibold text-base hover:bg-primary/90 transition-colors cursor-pointer"
            >
              Awesome!
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

'use client';

import type { AchievementWithStatus } from '@/hooks/useAchievements';

// ============================================
// Types
// ============================================

interface AchievementCardProps {
  achievement: AchievementWithStatus;
}

// ============================================
// Component
// ============================================

/**
 * AchievementCard Component
 * 
 * Displays a single achievement with icon, name, description, and unlock status.
 * Hidden achievements show "???" until unlocked.
 * 
 * See PRD Section 3.15 for achievement display requirements.
 */
export default function AchievementCard({ achievement }: AchievementCardProps) {
  const { display, isUnlocked, unlockedAt } = achievement;
  
  // Format unlock date if available
  const formattedDate = unlockedAt 
    ? new Date(unlockedAt).toLocaleDateString('sv-SE', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null;

  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
        isUnlocked
          ? 'bg-primary/5 border-primary/20'
          : 'bg-secondary/50 border-border opacity-60'
      }`}
    >
      {/* Icon */}
      <div
        className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-2xl ${
          isUnlocked ? 'bg-primary/10' : 'bg-muted'
        }`}
      >
        {display.icon}
      </div>
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className={`font-medium text-sm truncate ${
            isUnlocked ? 'text-foreground' : 'text-muted-foreground'
          }`}>
            {display.name}
          </h4>
          {/* Unlock indicator */}
          {isUnlocked && (
            <svg 
              className="w-4 h-4 text-primary flex-shrink-0" 
              fill="currentColor" 
              viewBox="0 0 20 20"
            >
              <path 
                fillRule="evenodd" 
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" 
                clipRule="evenodd" 
              />
            </svg>
          )}
        </div>
        
        <p className={`text-xs mt-0.5 ${
          isUnlocked ? 'text-muted-foreground' : 'text-muted-foreground/70'
        }`}>
          {display.description}
        </p>
        
        {/* Unlock date */}
        {isUnlocked && formattedDate && (
          <p className="text-xs text-primary/70 mt-1">
            Unlocked {formattedDate}
          </p>
        )}
      </div>
    </div>
  );
}

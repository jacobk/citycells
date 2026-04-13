/**
 * React Hook for Achievement State Management
 * 
 * Provides achievement state, unlock status, and checking functionality.
 * Integrates with the achievement service for database operations.
 * 
 * See ADR 019 for achievement system design.
 * See TICKET-023 for implementation requirements.
 * 
 * @module useAchievements
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  ACHIEVEMENTS,
  type Achievement,
  type AchievementCategory,
  CATEGORY_ORDER,
  getAchievementDisplay,
} from '@/lib/achievements';
import type { AchievementAreaContext } from '@/lib/achievement-service';

// ============================================
// Types
// ============================================

export interface AchievementWithStatus {
  achievement: Achievement;
  isUnlocked: boolean;
  unlockedAt: string | null;
  /** Display info (handles hidden state) */
  display: {
    name: string;
    description: string;
    icon: string;
  };
}

export interface UseAchievementsReturn {
  /** All achievements with their unlock status */
  achievements: AchievementWithStatus[];
  /** Achievements grouped by category */
  achievementsByCategory: Map<AchievementCategory, AchievementWithStatus[]>;
  /** Newly unlocked achievements (for modal display) */
  newlyUnlocked: Achievement[];
  /** Whether achievement checking is in progress */
  loading: boolean;
  /** Number of unlocked achievements */
  unlockedCount: number;
  /** Total number of achievements */
  totalCount: number;
  /** Check for new achievements (triggers after analysis) */
  checkForNewAchievements: () => Promise<void>;
  /** Clear newly unlocked achievements (after modal dismissed) */
  clearNewlyUnlocked: () => void;
  /** Refresh achievement status from database */
  refresh: () => Promise<void>;
}

// ============================================
// Hook Implementation
// ============================================

/**
 * Hook for managing achievement state.
 *
 * @param userId - Database user ID (from getOrCreateUserId)
 * @param dbReady - Whether database is initialized
 * @param areaCtx - Area context from GeoJSON (areas, perimeters, smallest FID)
 */
export function useAchievements(
  userId: number | undefined,
  dbReady: boolean,
  areaCtx?: AchievementAreaContext,
): UseAchievementsReturn {
  const [achievements, setAchievements] = useState<AchievementWithStatus[]>([]);
  const [newlyUnlocked, setNewlyUnlocked] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(false);
  
  // WHY: Track if initial load has happened to avoid duplicate fetches
  const initialLoadDone = useRef(false);

  /**
   * Load achievement status from database.
   */
  const loadAchievements = useCallback(async () => {
    if (!userId || !dbReady) return;
    
    try {
      // WHY: Dynamic import to avoid bundling sql.js at build time
      const { getAllAchievementsWithStatus } = await import('@/lib/achievement-service');
      
      const achievementsWithStatus = await getAllAchievementsWithStatus(userId);
      
      // Add display info for each achievement
      const enriched: AchievementWithStatus[] = achievementsWithStatus.map(item => ({
        ...item,
        display: getAchievementDisplay(item.achievement, item.isUnlocked),
      }));
      
      setAchievements(enriched);
    } catch (error) {
      console.error('[useAchievements] Failed to load achievements:', error);
    }
  }, [userId, dbReady]);

  /**
   * Check for new achievements.
   * WHY: Called after analysis completes to unlock any newly earned achievements.
   */
  const checkForNewAchievements = useCallback(async () => {
    if (!userId || !dbReady || !areaCtx) return;

    setLoading(true);

    try {
      // WHY: Dynamic import to keep achievement-service out of the main bundle
      const { checkAchievements } = await import('@/lib/achievement-service');

      const result = await checkAchievements(userId, areaCtx);

      // Update newly unlocked for modal display
      if (result.newlyUnlocked.length > 0) {
        setNewlyUnlocked(result.newlyUnlocked);
      }

      // Reload all achievements to update status
      await loadAchievements();
    } catch (error) {
      console.error('[useAchievements] Failed to check achievements:', error);
    } finally {
      setLoading(false);
    }
  }, [userId, dbReady, areaCtx, loadAchievements]);

  /**
   * Clear newly unlocked achievements (after modal dismissed).
   */
  const clearNewlyUnlocked = useCallback(() => {
    setNewlyUnlocked([]);
  }, []);

  /**
   * Refresh achievement status.
   */
  const refresh = useCallback(async () => {
    await loadAchievements();
  }, [loadAchievements]);

  // Initial load when user and database are ready
  useEffect(() => {
    if (userId && dbReady && !initialLoadDone.current) {
      initialLoadDone.current = true;
      loadAchievements();
    }
  }, [userId, dbReady, loadAchievements]);

  // Reset initial load flag when user changes
  useEffect(() => {
    initialLoadDone.current = false;
  }, [userId]);

  // Compute derived values
  const unlockedCount = achievements.filter(a => a.isUnlocked).length;
  const totalCount = ACHIEVEMENTS.length;

  // Group achievements by category
  const achievementsByCategory = new Map<AchievementCategory, AchievementWithStatus[]>();
  for (const category of CATEGORY_ORDER) {
    const categoryAchievements = achievements
      .filter(a => a.achievement.category === category)
      .sort((a, b) => a.achievement.sortOrder - b.achievement.sortOrder);
    achievementsByCategory.set(category, categoryAchievements);
  }

  return {
    achievements,
    achievementsByCategory,
    newlyUnlocked,
    loading,
    unlockedCount,
    totalCount,
    checkForNewAchievements,
    clearNewlyUnlocked,
    refresh,
  };
}

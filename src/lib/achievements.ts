/**
 * Achievement System Definitions
 * 
 * Static achievement definitions for CityCells gamification.
 * See ADR 019 for data model and PRD Section 3.15 for full list.
 * 
 * @module achievements
 */

// ============================================
// Types
// ============================================

export type AchievementCategory = 
  | 'milestones' 
  | 'quality' 
  | 'adjacent' 
  | 'configurations' 
  | 'size' 
  | 'distance' 
  | 'hidden';

export type ConditionType = 
  | 'area_count'
  | 'tier_count'
  | 'tier_first'
  | 'adjacent_count'
  | 'configuration'
  | 'perimeter_single'
  | 'perimeter_count'
  | 'perimeter_smallest'
  | 'distance_total'
  | 'hidden_exact_count'
  | 'hidden_friday_13'
  | 'hidden_night_owl'
  | 'hidden_potato_pride'
  | 'hidden_center_area';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: AchievementCategory;
  isHidden: boolean;
  sortOrder: number;
  conditionType: ConditionType;
  conditionValue: Record<string, unknown>;
}

export interface UserAchievement {
  achievementId: string;
  unlockedAt: string;
}

// ============================================
// Category Display Names
// ============================================

export const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  milestones: 'Area Milestones',
  quality: 'Tier Quality',
  adjacent: 'Adjacent Areas',
  configurations: 'Special Configurations',
  size: 'Area Size',
  distance: 'Distance',
  hidden: 'Hidden',
};

export const CATEGORY_ORDER: AchievementCategory[] = [
  'milestones',
  'quality',
  'adjacent',
  'configurations',
  'size',
  'distance',
  'hidden',
];

// ============================================
// Achievement Definitions (40 total)
// From PRD Section 3.15
// ============================================

export const ACHIEVEMENTS: Achievement[] = [
  // ========================================
  // AREA MILESTONES (10)
  // ========================================
  {
    id: 'first-steps',
    name: 'First Steps',
    description: 'Complete your first area',
    icon: '🎯',
    category: 'milestones',
    isHidden: false,
    sortOrder: 1,
    conditionType: 'area_count',
    conditionValue: { count: 1 },
  },
  {
    id: 'getting-started',
    name: 'Getting Started',
    description: 'Complete 5 areas',
    icon: '🌱',
    category: 'milestones',
    isHidden: false,
    sortOrder: 2,
    conditionType: 'area_count',
    conditionValue: { count: 5 },
  },
  {
    id: 'double-digits',
    name: 'Double Digits',
    description: 'Complete 10 areas',
    icon: '🔟',
    category: 'milestones',
    isHidden: false,
    sortOrder: 3,
    conditionType: 'area_count',
    conditionValue: { count: 10 },
  },
  {
    id: 'lucky-thirteen',
    name: 'Lucky Thirteen',
    description: 'Complete 13 areas',
    icon: '🍀',
    category: 'milestones',
    isHidden: false,
    sortOrder: 4,
    conditionType: 'area_count',
    conditionValue: { count: 13 },
  },
  {
    id: 'quarter-century',
    name: 'Quarter Century',
    description: 'Complete 25 areas',
    icon: '🎂',
    category: 'milestones',
    isHidden: false,
    sortOrder: 5,
    conditionType: 'area_count',
    conditionValue: { count: 25 },
  },
  {
    id: 'halfway-there',
    name: 'Halfway There',
    description: 'Complete 68 areas (50%)',
    icon: '⏳',
    category: 'milestones',
    isHidden: false,
    sortOrder: 6,
    conditionType: 'area_count',
    conditionValue: { count: 68 },
  },
  {
    id: 'three-quarters',
    name: 'Three Quarters',
    description: 'Complete 102 areas (75%)',
    icon: '📊',
    category: 'milestones',
    isHidden: false,
    sortOrder: 7,
    conditionType: 'area_count',
    conditionValue: { count: 102 },
  },
  {
    id: 'century-club',
    name: 'Century Club',
    description: 'Complete 100 areas',
    icon: '💯',
    category: 'milestones',
    isHidden: false,
    sortOrder: 8,
    conditionType: 'area_count',
    conditionValue: { count: 100 },
  },
  {
    id: 'almost-there',
    name: 'Almost There',
    description: 'Complete 130 areas',
    icon: '🏃',
    category: 'milestones',
    isHidden: false,
    sortOrder: 9,
    conditionType: 'area_count',
    conditionValue: { count: 130 },
  },
  {
    id: 'malmo-master',
    name: 'Malmö Master',
    description: 'Complete all 136 areas',
    icon: '👑',
    category: 'milestones',
    isHidden: false,
    sortOrder: 10,
    conditionType: 'area_count',
    conditionValue: { count: 136 },
  },

  // ========================================
  // TIER QUALITY (6)
  // ========================================
  {
    id: 'bronze-beginner',
    name: 'Bronze Beginner',
    description: 'Earn your first Bronze tier',
    icon: '🥉',
    category: 'quality',
    isHidden: false,
    sortOrder: 1,
    conditionType: 'tier_first',
    conditionValue: { tier: 'bronze' },
  },
  {
    id: 'silver-lining',
    name: 'Silver Lining',
    description: 'Earn your first Silver tier',
    icon: '🥈',
    category: 'quality',
    isHidden: false,
    sortOrder: 2,
    conditionType: 'tier_first',
    conditionValue: { tier: 'silver' },
  },
  {
    id: 'gold-standard',
    name: 'Gold Standard',
    description: 'Earn your first Gold tier',
    icon: '🥇',
    category: 'quality',
    isHidden: false,
    sortOrder: 3,
    conditionType: 'tier_first',
    conditionValue: { tier: 'gold' },
  },
  {
    id: 'platinum-pioneer',
    name: 'Platinum Pioneer',
    description: 'Earn your first Platinum tier',
    icon: '🏆',
    category: 'quality',
    isHidden: false,
    sortOrder: 4,
    conditionType: 'tier_first',
    conditionValue: { tier: 'platinum' },
  },
  {
    id: 'golden-decade',
    name: 'Golden Decade',
    description: 'Earn 10 Gold or better tiers',
    icon: '✨',
    category: 'quality',
    isHidden: false,
    sortOrder: 5,
    conditionType: 'tier_count',
    conditionValue: { tier: 'gold_or_better', count: 10 },
  },
  {
    id: 'perfectionist',
    name: 'Perfectionist',
    description: 'Earn 10 Platinum tiers',
    icon: '💎',
    category: 'quality',
    isHidden: false,
    sortOrder: 6,
    conditionType: 'tier_count',
    conditionValue: { tier: 'platinum', count: 10 },
  },

  // ========================================
  // ADJACENT AREAS (6)
  // ========================================
  {
    id: 'good-neighbors',
    name: 'Good Neighbors',
    description: 'Complete 2 adjacent areas',
    icon: '🤝',
    category: 'adjacent',
    isHidden: false,
    sortOrder: 1,
    conditionType: 'adjacent_count',
    conditionValue: { count: 2 },
  },
  {
    id: 'trilogy',
    name: 'Trilogy',
    description: 'Complete 3 connected areas',
    icon: '📚',
    category: 'adjacent',
    isHidden: false,
    sortOrder: 2,
    conditionType: 'adjacent_count',
    conditionValue: { count: 3 },
  },
  {
    id: 'fantastic-four',
    name: 'Fantastic Four',
    description: 'Complete 4 connected areas',
    icon: '4️⃣',
    category: 'adjacent',
    isHidden: false,
    sortOrder: 3,
    conditionType: 'adjacent_count',
    conditionValue: { count: 4 },
  },
  {
    id: 'six-pack',
    name: 'Six Pack',
    description: 'Complete 6 connected areas',
    icon: '🎲',
    category: 'adjacent',
    isHidden: false,
    sortOrder: 4,
    conditionType: 'adjacent_count',
    conditionValue: { count: 6 },
  },
  {
    id: 'kingdom-builder',
    name: 'Kingdom Builder',
    description: 'Complete 10 connected areas',
    icon: '🏰',
    category: 'adjacent',
    isHidden: false,
    sortOrder: 5,
    conditionType: 'adjacent_count',
    conditionValue: { count: 10 },
  },
  {
    id: 'empire',
    name: 'Empire',
    description: 'Complete 20 connected areas',
    icon: '👸',
    category: 'adjacent',
    isHidden: false,
    sortOrder: 6,
    conditionType: 'adjacent_count',
    conditionValue: { count: 20 },
  },

  // ========================================
  // SPECIAL CONFIGURATIONS (4)
  // ========================================
  {
    id: 'triple-point',
    name: 'Triple Point',
    description: 'Complete 3 areas sharing a single corner',
    icon: '📍',
    category: 'configurations',
    isHidden: false,
    sortOrder: 1,
    conditionType: 'configuration',
    conditionValue: { type: 'triple_point' },
  },
  {
    id: 'crossroads',
    name: 'Crossroads',
    description: 'Complete 4 areas meeting at one point',
    icon: '✖️',
    category: 'configurations',
    isHidden: false,
    sortOrder: 2,
    conditionType: 'configuration',
    conditionValue: { type: 'crossroads' },
  },
  {
    id: 'chain-reaction',
    name: 'Chain Reaction',
    description: 'Complete 5 areas in a line',
    icon: '⛓️',
    category: 'configurations',
    isHidden: false,
    sortOrder: 3,
    conditionType: 'configuration',
    conditionValue: { type: 'chain' },
  },
  {
    id: 'encirclement',
    name: 'Encirclement',
    description: 'Surround an unwalked area completely',
    icon: '🔲',
    category: 'configurations',
    isHidden: false,
    sortOrder: 4,
    conditionType: 'configuration',
    conditionValue: { type: 'encirclement' },
  },

  // ========================================
  // AREA SIZE (5)
  // ========================================
  {
    id: 'bite-sized',
    name: 'Bite Sized',
    description: 'Complete the smallest area by perimeter',
    icon: '🍪',
    category: 'size',
    isHidden: false,
    sortOrder: 1,
    conditionType: 'perimeter_smallest',
    conditionValue: {},
  },
  {
    id: 'marathon-walker',
    name: 'Marathon Walker',
    description: 'Complete an area with >5km perimeter',
    icon: '🏅',
    category: 'size',
    isHidden: false,
    sortOrder: 2,
    conditionType: 'perimeter_single',
    conditionValue: { min_km: 5 },
  },
  {
    id: 'quick-wins',
    name: 'Quick Wins',
    description: 'Complete 5 areas under 2km perimeter',
    icon: '⚡',
    category: 'size',
    isHidden: false,
    sortOrder: 3,
    conditionType: 'perimeter_count',
    conditionValue: { max_km: 2, count: 5 },
  },
  {
    id: 'go-big',
    name: 'Go Big',
    description: 'Complete 5 areas over 4km perimeter',
    icon: '🦣',
    category: 'size',
    isHidden: false,
    sortOrder: 4,
    conditionType: 'perimeter_count',
    conditionValue: { min_km: 4, count: 5 },
  },
  {
    id: 'middle-ground',
    name: 'Middle Ground',
    description: 'Complete an area 2.5-3.5km perimeter',
    icon: '⚖️',
    category: 'size',
    isHidden: false,
    sortOrder: 5,
    conditionType: 'perimeter_single',
    conditionValue: { min_km: 2.5, max_km: 3.5 },
  },

  // ========================================
  // DISTANCE (4)
  // ========================================
  {
    id: 'fifty-km',
    name: 'Fifty Kilometers',
    description: 'Walk 50km total',
    icon: '🛤️',
    category: 'distance',
    isHidden: false,
    sortOrder: 1,
    conditionType: 'distance_total',
    conditionValue: { km: 50 },
  },
  {
    id: 'century-walker',
    name: 'Century Walker',
    description: 'Walk 100km total',
    icon: '🚶',
    category: 'distance',
    isHidden: false,
    sortOrder: 2,
    conditionType: 'distance_total',
    conditionValue: { km: 100 },
  },
  {
    id: 'double-century',
    name: 'Double Century',
    description: 'Walk 200km total',
    icon: '🎖️',
    category: 'distance',
    isHidden: false,
    sortOrder: 3,
    conditionType: 'distance_total',
    conditionValue: { km: 200 },
  },
  {
    id: 'ultra-walker',
    name: 'Ultra Walker',
    description: 'Walk 500km total',
    icon: '🌟',
    category: 'distance',
    isHidden: false,
    sortOrder: 4,
    conditionType: 'distance_total',
    conditionValue: { km: 500 },
  },

  // ========================================
  // HIDDEN ACHIEVEMENTS (5)
  // ========================================
  {
    id: 'hidden-1',
    name: 'The Answer',
    description: 'Have exactly 42 areas completed',
    icon: '🌌',
    category: 'hidden',
    isHidden: true,
    sortOrder: 1,
    conditionType: 'hidden_exact_count',
    conditionValue: { count: 42 },
  },
  {
    id: 'hidden-2',
    name: 'Triskaidekaphile',
    description: 'Complete your 13th area on a Friday',
    icon: '🖤',
    category: 'hidden',
    isHidden: true,
    sortOrder: 2,
    conditionType: 'hidden_friday_13',
    conditionValue: {},
  },
  {
    id: 'hidden-3',
    name: 'Night Owl',
    description: 'Analyze a walk between 2-4 AM',
    icon: '🦉',
    category: 'hidden',
    isHidden: true,
    sortOrder: 3,
    conditionType: 'hidden_night_owl',
    conditionValue: {},
  },
  {
    id: 'hidden-4',
    name: 'Potato Pride',
    description: 'Earn 5 Potato tier completions',
    icon: '🥔',
    category: 'hidden',
    isHidden: true,
    sortOrder: 4,
    conditionType: 'hidden_potato_pride',
    conditionValue: { count: 5 },
  },
  {
    id: 'hidden-5',
    name: 'The Centered',
    description: "Complete the area containing Malmö's geographic center",
    icon: '🎯',
    category: 'hidden',
    isHidden: true,
    sortOrder: 5,
    conditionType: 'hidden_center_area',
    conditionValue: {},
  },
];

// ============================================
// Helper Functions
// ============================================

/**
 * Get achievement by ID.
 */
export function getAchievementById(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find(a => a.id === id);
}

/**
 * Get all achievements in a category.
 */
export function getAchievementsByCategory(category: AchievementCategory): Achievement[] {
  return ACHIEVEMENTS.filter(a => a.category === category)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Get display info for an achievement (handles hidden state).
 */
export function getAchievementDisplay(
  achievement: Achievement,
  isUnlocked: boolean
): { name: string; description: string; icon: string } {
  if (achievement.isHidden && !isUnlocked) {
    return {
      name: '???',
      description: '???',
      icon: '🔒',
    };
  }
  return {
    name: achievement.name,
    description: achievement.description,
    icon: achievement.icon,
  };
}

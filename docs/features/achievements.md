# Achievement System

## Overview

The Achievement System adds a gamification layer to CityCells, rewarding users for various accomplishments as they explore Malmö's sub-areas. With 40 achievements across 7 categories (including 5 hidden "secret" achievements), users are motivated to explore in different ways: completing milestones, earning quality tiers, building connected territories, discovering geometric patterns, tackling various area sizes, and accumulating walking distance.

Each achievement has an emoji icon, name, and description. Users can browse all achievements from the hamburger menu, seeing their progress and which achievements remain locked. Hidden achievements display as "???" until unlocked, adding an element of surprise and discovery.

## User Stories

From [PRD 001](../PRD/001-mvp-mobile-walker.md) Section 2 (Achievement System Stories):
- "As a user, I want to earn achievements for reaching milestones (like completing 10, 50, or all 136 areas), so I feel rewarded for my progress."
- "As a user, I want to browse all available achievements from the hamburger menu, so I know what goals I can work toward."
- "As a user, I want to see which achievements I've already earned in the achievement list, so I can track my collection."
- "As a user, I want hidden achievements to show as "???" until unlocked, so there's an element of surprise and discovery."
- "As a user, I want to see a celebratory modal when I earn new achievements after analyzing walks, so I feel the accomplishment immediately."
- "As a user, I want my achievements to persist across browser sessions, so I don't lose my progress."

## Implementation

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/achievements.ts` | Achievement types, 40 definitions (35 regular + 5 hidden), condition types, category labels |
| `src/lib/adjacency.ts` | Area boundary sharing detection - graph building, cluster detection, vertex sharing, encirclement |
| `src/lib/achievement-conditions.ts` | Modular condition evaluators for all 6 condition types |
| `src/lib/achievement-service.ts` | Main service for checking achievements against user data and persisting unlocks |
| `src/lib/db.ts` | SQLite schema v6 with `achievements` and `user_achievements` tables, migration logic, seeding |
| `src/components/AchievementBrowser/` | Slide-up panel showing all achievements grouped by category |
| `src/components/AchievementModal/` | Celebratory modal for newly unlocked achievements |
| `src/hooks/useAchievements.ts` | React hook for achievement state, checking, and display |
| `src/app/page.tsx` | Integration point - triggers checks after analysis, renders browser/modal |

### Data Flow

1. **Database Initialization:** On schema v6 migration, `achievements` table is created and seeded with all 40 achievement definitions
2. **User Achievement Check:** After activity analysis completes in `page.tsx`, the `checkForNewAchievements()` function is called
3. **Condition Evaluation:** `achievement-service.ts` queries user stats (area counts, tiers, clusters, etc.) and evaluates each achievement's conditions
4. **Unlock Persistence:** Newly earned achievements are written to `user_achievements` table with timestamp
5. **UI Update:** Hook returns `newlyUnlocked` array which triggers the `AchievementModal` to display
6. **Browse Achievements:** User can open `AchievementBrowser` from hamburger menu to see all achievements grouped by category

```
Analysis Complete → page.tsx effect → checkAchievements() 
    → evaluateConditions() → persistUnlocks() 
    → useAchievements state update → AchievementModal displays
```

### Key Functions

**`src/lib/achievement-service.ts`:**
- `checkAchievements(userId)` - Main entry point; evaluates all achievements and persists new unlocks
- `getAllAchievementsWithStatus(userId)` - Returns all achievements with their unlock status for the browser

**`src/lib/achievement-conditions.ts`:**
- `evaluateCondition(condition, context)` - Dispatches to specific evaluators based on condition type
- `evaluateCountCondition()` - Checks area count thresholds
- `evaluateTierCondition()` - Checks tier quality requirements
- `evaluateAdjacentCondition()` - Checks for connected area clusters
- `evaluateConfigurationCondition()` - Checks geometric patterns (encirclement, triple-point, corners)
- `evaluateSizeCondition()` - Checks for completing areas by size category
- `evaluateDistanceCondition()` - Checks total walked distance

**`src/lib/adjacency.ts`:**
- `buildAdjacencyGraph(areas)` - Creates graph of which areas share boundaries
- `findLargestCluster(graph, completedAreaIds)` - Finds biggest connected component
- `sharesVertexWith(areaId, graph, completedAreaIds)` - Detects vertex sharing (not edge)
- `detectEncirclement(centerAreaId, graph, completedAreaIds)` - Checks if area is surrounded

**`src/hooks/useAchievements.ts`:**
- `useAchievements(userId, dbReady)` - Hook providing state, `checkForNewAchievements()`, `clearNewlyUnlocked()`

## Rationale

### Design Decisions

**Emoji Icons over Custom SVGs:**
Unicode emoji provide instant visual appeal across all platforms without additional asset loading or bundle size impact. They're universally recognized and can be updated without deployment.

**Separate Process for Achievement Checking:**
Achievement evaluation runs independently from the analysis flow to avoid blocking the critical path. This allows analysis to complete quickly while achievements are checked asynchronously.

**Hidden Achievements with Cryptic Names:**
Displaying "???" for locked hidden achievements creates curiosity and encourages exploration. Users know these achievements exist (they count toward totals) but must discover the conditions themselves.

**Single Modal for Batch Achievements:**
When analyzing multiple activities, all newly earned achievements appear in one consolidated modal rather than separate popups for each, reducing interruption while still celebrating accomplishments.

**SQLite Persistence:**
Following the established pattern (ADR 004), achievements are stored in SQLite/IndexedDB for offline access and persistence across sessions. This aligns with the app's local-first architecture.

### ADR References

- [ADR 019: Achievement System Data Model](../ADR/019-achievement-system.md) - Defines data schema, condition types, and evaluation approach
- [ADR 004: SQLite Storage](../ADR/004-sqlite-storage.md) - Establishes local persistence pattern used for achievements

## Current Limitations

1. **Local-only:** Achievements don't sync across devices (consistent with app's local-first design)
2. **Static Definitions:** Achievement list is hardcoded; no dynamic/remote configuration
3. **No Social Features:** Can't share achievements or compare with friends (future consideration)
4. **Geometric Calculations:** Some configuration achievements (triple-point, encirclement) require complex spatial analysis that may need optimization

# TICKET-023: Achievement System

**Related:** ADR 019, PRD Section 2 (Achievement System Stories), PRD Section 3.15  
**Feature:** Achievement System from docs/features/achievements.md  
**Status:** Ready for Implementation  
**Created:** 2026-02-16

## Context to Load

Files the implementation agent MUST read first:

1. `docs/ADR/019-achievement-system.md` - Data model, condition types, evaluation approach
2. `docs/PRD/001-mvp-mobile-walker.md` Section 3.15 - Full achievement list (40 achievements) and UI specs
3. `docs/features/achievements.md` - Feature overview and design rationale
4. `src/lib/db.ts` - Existing SQLite database setup and patterns
5. `src/hooks/useDatabase.ts` - Database hook pattern to follow
6. `src/lib/analysis.ts` - Analysis functions (for understanding area/tier data structures)
7. `src/components/HamburgerMenu/HamburgerMenu.tsx` - Where to add Achievements menu item
8. `src/components/SubAreaListPanel/SubAreaListPanel.tsx` - Pattern for slide-up panels

## Implementation Checklist

### 1. Database Schema & Migration

Add achievement tables to SQLite schema (see ADR 019 for schema):
- Create `achievements` table (static definitions)
- Create `user_achievements` table (user unlock records)
- Seed all 40 achievements from PRD Section 3.15

### 2. Achievement Definitions Module

Create `src/lib/achievements.ts`:
- Define TypeScript types for achievements and conditions
- Export achievement definitions array (matching PRD tables)
- Export condition type constants

### 3. Condition Evaluation Logic

Create condition evaluators in `src/lib/achievement-conditions.ts`:
- `evaluateAreaCount(userState)` - Area milestone conditions
- `evaluateTierCount(userState)` - Tier quality conditions
- `evaluateTierFirst(userState)` - First tier conditions
- `evaluateAdjacentCount(userState)` - Connected area cluster size
- `evaluateConfiguration(userState)` - Geometric patterns (triple-point, encirclement, etc.)
- `evaluatePerimeter(userState)` - Area size conditions
- `evaluateDistance(userState)` - Total walked distance
- `evaluateHidden(userState)` - Hidden achievement special conditions

### 4. Achievement Service

Create `src/lib/achievement-service.ts`:
- `checkAchievements(userId, db)` - Main evaluation function
- `getUserAchievements(userId, db)` - Fetch user's unlocked achievements
- `unlockAchievement(userId, achievementId, db)` - Record new unlock
- `getNewlyUnlocked(userId, previousIds, currentIds)` - Diff for modal

### 5. Achievement Hook

Create `src/hooks/useAchievements.ts`:
- Provide achievement state (all definitions, user unlocks)
- `checkForNewAchievements()` function to trigger evaluation
- Track newly unlocked achievements for modal display
- Clear newly unlocked state after modal dismissed

### 6. Achievement Browser Panel

Create `src/components/AchievementBrowser/AchievementBrowser.tsx`:
- Slide-up bottom sheet (follow SubAreaListPanel pattern)
- Header with unlock count and progress bar
- Category-grouped achievement list
- Achievement card: icon, name, description, locked/unlocked state
- Hidden achievements show "???" until unlocked

### 7. Achievement Notification Modal

Create `src/components/AchievementModal/AchievementModal.tsx`:
- Centered modal overlay
- Shows all newly earned achievements
- Large emoji icons with name and description
- Dismiss button ("Awesome!")
- Optional: confetti animation for special achievements

### 8. Integration Points

- Add "Achievements" option to HamburgerMenu
- Trigger achievement check after analysis completes (in useStrava or page component)
- Show AchievementModal when newly unlocked achievements exist

### 9. Adjacency Graph for Cluster Detection

Create adjacency calculation utilities:
- Build graph of which areas share boundaries
- Calculate largest connected cluster of completed areas
- Cache adjacency relationships (static, can compute once)

### 10. Geometric Configuration Detection

Implement special configuration checks:
- Triple-point: Find 3 completed areas sharing a vertex
- Crossroads: Find 4 completed areas sharing a vertex
- Chain: Find 5 completed areas forming a linear chain
- Encirclement: Find completed areas fully surrounding an incomplete area

## Maintainability

Before implementing, review for:

- [x] **Refactor opportunity?** Achievement condition evaluation should be modular (one function per type)
- [x] **DRY check** - Reuse existing area/tier queries from `analysis-persistence.ts`
- [x] **Modularity** - Condition evaluators should be independently testable
- [x] **Debt impact** - Follow existing patterns to avoid introducing inconsistency

**Specific notes:**
- Use existing `getAreaCompletions()` pattern from analysis-persistence for querying user state
- Panel component should follow same bottom-sheet pattern as SubAreaListPanel
- Modal should follow same overlay pattern as ExemptionModal

## Acceptance Criteria

- [ ] All 40 achievements defined in database and viewable in browser
- [ ] Achievement browser accessible from hamburger menu
- [ ] Hidden achievements show as "???" until unlocked
- [ ] Unlocked achievements show with checkmark/highlight and unlock date
- [ ] Progress count shown in header (e.g., "12 / 40 unlocked")
- [ ] Achievement modal appears after analysis when new achievements earned
- [ ] Multiple achievements from batch analysis show in single modal
- [ ] Modal dismisses on button click or tap outside
- [ ] Achievements persist across page reloads
- [ ] Adjacent area cluster detection works correctly
- [ ] At least one hidden achievement has verifiable unlock condition

## Files to Modify

| File | Change |
|------|--------|
| `src/lib/db.ts` | Add achievements and user_achievements tables |
| NEW: `src/lib/achievements.ts` | Achievement type definitions and data |
| NEW: `src/lib/achievement-conditions.ts` | Condition evaluation functions |
| NEW: `src/lib/achievement-service.ts` | Achievement checking and persistence |
| NEW: `src/lib/adjacency.ts` | Area adjacency graph utilities |
| NEW: `src/hooks/useAchievements.ts` | React hook for achievement state |
| NEW: `src/components/AchievementBrowser/AchievementBrowser.tsx` | Browser panel component |
| NEW: `src/components/AchievementBrowser/AchievementCard.tsx` | Individual achievement display |
| NEW: `src/components/AchievementBrowser/index.tsx` | Component export |
| NEW: `src/components/AchievementModal/AchievementModal.tsx` | Notification modal |
| NEW: `src/components/AchievementModal/index.tsx` | Component export |
| `src/components/HamburgerMenu/HamburgerMenu.tsx` | Add Achievements menu item |
| `src/app/page.tsx` | Integrate achievement checking and modal display |

## Notes

- Do NOT duplicate ADR/PRD content - reference it
- All 40 achievements are defined in PRD Section 3.15 - copy exactly
- Hidden achievement conditions should be evaluated same as others, just display differently
- Consider performance: evaluate all achievements in single pass with pre-aggregated user state
- Adjacency graph is static (area boundaries don't change) - can compute once and cache

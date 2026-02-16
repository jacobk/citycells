# ADR 019: Achievement System Data Model

**Date:** 2026-02-16
**Status:** Accepted
**Supersedes:** N/A

## Context

CityCells currently tracks area completions with quality tiers, but lacks gamification elements beyond the tier system. Users have no way to recognize milestones, special accomplishments, or fun easter eggs during their exploration of Malmö's sub-areas.

We need a system to:
- Define achievements with various unlock conditions
- Track which achievements each user has earned
- Persist achievement state across sessions
- Support "hidden" achievements that show cryptic names until unlocked
- Display achievement notifications when newly earned

### Constraints

- Must work with existing SQLite/IndexedDB storage (ADR 004)
- Achievement checking should be a separate process from analysis (not block the analysis flow)
- Must support ~40 achievements without performance issues
- Achievement conditions range from simple counts to geometric analysis

## Decision

We will implement a **local achievement system** with SQLite persistence and emoji-based icons.

### Achievement Categories

Achievements are organized into these categories:

| Category | Description | Example |
|----------|-------------|---------|
| Area Milestones | Number of areas completed | "Complete 50 areas" |
| Tier Quality | Earning specific quality tiers | "Earn 10 Platinum tiers" |
| Adjacent Areas | Clusters of connected areas | "Complete 10 connected areas" |
| Configurations | Special geometric patterns | "3 areas sharing a corner" |
| Area Size | Based on perimeter length | "Complete 5 areas > 4km" |
| Distance | Total walking distance | "Walk 100km total" |
| Hidden | Secret conditions (shown as "???") | Various fun easter eggs |

### Data Model

#### `achievements` Table (Static Definition)

```sql
CREATE TABLE achievements (
  id TEXT PRIMARY KEY,           -- Unique slug: 'first-steps', 'platinum-pioneer'
  name TEXT NOT NULL,            -- Display name: 'First Steps'
  description TEXT NOT NULL,     -- How to unlock: 'Complete your first area'
  icon TEXT NOT NULL,            -- Emoji icon: '🎯'
  category TEXT NOT NULL,        -- Category slug: 'milestones', 'quality', etc.
  is_hidden INTEGER DEFAULT 0,   -- 1 = show as "???" until unlocked
  sort_order INTEGER NOT NULL,   -- Display order within category
  condition_type TEXT NOT NULL,  -- 'area_count', 'tier_count', 'adjacent', etc.
  condition_value TEXT NOT NULL  -- JSON: {"count": 5} or {"tier": "platinum", "count": 10}
);
```

**Condition Types:**
- `area_count` - Number of areas completed: `{"count": N}`
- `tier_count` - Count of specific tier: `{"tier": "platinum|gold|silver|bronze|potato", "count": N}`
- `tier_first` - First time earning a tier: `{"tier": "platinum"}`
- `adjacent_count` - Largest connected cluster: `{"count": N}`
- `configuration` - Geometric pattern: `{"type": "triple_point|crossroads|chain|encirclement"}`
- `perimeter_single` - Single area perimeter: `{"min_km": N}` or `{"max_km": N}`
- `perimeter_count` - Count of areas by perimeter: `{"min_km": N, "max_km": M, "count": C}`
- `perimeter_smallest` - Complete the smallest area: `{}`
- `distance_total` - Total walked distance: `{"km": N}`
- `hidden_*` - Various hidden conditions (evaluated specially)

#### `user_achievements` Table

```sql
CREATE TABLE user_achievements (
  user_id TEXT NOT NULL,
  achievement_id TEXT NOT NULL,
  unlocked_at TEXT NOT NULL,     -- ISO 8601 timestamp
  PRIMARY KEY (user_id, achievement_id),
  FOREIGN KEY (achievement_id) REFERENCES achievements(id)
);
```

### Achievement Checking Process

Achievement evaluation runs as a **separate process** (not integrated into analysis):

1. **Trigger points:**
   - After analysis completes (all activities)
   - On app initialization (catch any missed achievements)
   - Manual "check achievements" action (optional)

2. **Evaluation flow:**
   ```
   Get current user state (areas, tiers, distances)
         ↓
   For each achievement not yet unlocked:
     - Evaluate condition against user state
     - If met, mark as newly unlocked
         ↓
   Return list of newly unlocked achievements
         ↓
   If any new achievements, show modal
   ```

3. **Performance:** Evaluate all ~40 achievements in a single pass using pre-aggregated data (area counts, tier counts, adjacency graph cached in memory).

### Achievement Icon Strategy

Use **Unicode emoji** for icons:
- Instant visual appeal across platforms
- No asset loading or bundle size impact
- Accessible and recognizable
- Easy to update without deployment

### Achievement Notification UI

When achievements are earned:
- Show modal overlay listing ALL newly earned achievements
- Group modal for batch analysis (multiple activities)
- Each achievement shows: icon, name, description
- Modal dismisses on tap/click
- Confetti animation optional enhancement

## Consequences

### Positive

- Adds engaging gamification without backend complexity
- Encourages exploration of different area types and patterns
- Hidden achievements provide discovery and delight
- Emoji icons are universally understood and lightweight

### Negative

- Complex geometric conditions (triple_point, encirclement) require spatial calculations
- Achievement definitions hardcoded in app (not dynamically configurable)
- No cross-device sync (local storage only, per ADR 004)

### Technical

- New SQLite tables require migration on app update
- Adjacent area calculations need cached graph representation of area topology
- Hidden achievement conditions evaluated with same logic but display hidden

### Maintainability

- Achievement definitions centralized in one seed/migration file
- Condition evaluation logic modular (one function per condition_type)
- Adding new achievements only requires adding row + condition handler
- Easy to test each condition type in isolation

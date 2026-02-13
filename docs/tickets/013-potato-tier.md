# TICKET-013: Add Potato Tier Below Bronze

**Related:** ADR 003 (Updated 2026-02-13), PRD Section 3.4, 3.7  
**Feature:** Analysis Engine (docs/features/analysis-engine.md)  
**Status:** Ready for Implementation  
**Created:** 2026-02-13

## Context to Load

Files the implementation agent MUST read first:

1. `docs/ADR/003-multi-metric-completion-scoring.md` - Tier system definition (see section 3, updated 2026-02-13)
2. `docs/PRD/001-mvp-mobile-walker.md` Section 3.4 - Area Status Visualization with tier colors
3. `docs/features/analysis-engine.md` - Analysis engine implementation details (see Tier System section)
4. `src/lib/analysis.ts` - Core scoring and tier assignment logic
5. `src/components/Map/Map.tsx` - Map visualization and tier display

## Implementation Checklist

### 1. Update Tier Assignment Logic

Add "Potato" tier for scores < 0.50 in the tier assignment function.

- Locate the tier assignment logic in `src/lib/analysis.ts` (likely a `getTier()` or similar function)
- Add new condition: `if (score < 0.50) return 'potato'`
- Ensure this is checked after Bronze threshold (≥0.50) but before returning default/null
- **WHY:** Activities tagged with `#malmödelområde` that match a sub-area but receive poor scores should still count as "completed" on the map

### 2. Add Potato Tier Styling

Define visual styling for Potato tier in map visualization.

- Add Potato tier colors to area fill/border color mappings
- Map fill color: `#d1d5db` (Light Gray), opacity: 0.40
- Map border color: `#9ca3af`
- Non-map contexts (badges, text): `#6b7280` (Gray)
- **Reference:** PRD Section 3.4 for full color specification

### 3. Add Potato Tier Icon

Add potato emoji (🥔) icon for Potato tier.

- Update tier icon mapping to include: `potato: '🥔'`
- Ensure icon displays at sub-area centroids on map (zoom level 13+)
- Update Area Details Panel to show potato icon for Potato tier
- **Reference:** PRD Section 3.4 (Tier Medal Icons)

### 4. Update Completion Threshold Logic

Ensure any matched walk (even Potato tier) marks area as "completed".

- Review `area_completions` logic to ensure areas with Potato tier walks are marked as completed
- Update any UI that filters/displays "completed" areas to include Potato tier
- **WHY:** User efforts should always count toward map progress, even with minimal coverage (e.g., Ellstorp test walk)

### 5. Update Type Definitions

Add "potato" to Tier type definition.

- Locate TypeScript type/enum for tiers (likely in `src/lib/types.ts` or similar)
- Add `'potato'` to the Tier union type or enum
- Ensure all tier-related functions and components accept the new tier value

### 6. Update UI Display Text

Update any user-facing text that lists tiers.

- Update tooltips, help text, and documentation pages that mention tier names
- Ensure Potato tier is described as "low-quality walk that still counts"
- Check Area Details Panel for tier display logic

## Maintainability

Before implementing, review for:

- [x] **Refactor opportunity?** Tier definition is likely scattered across multiple files (colors, icons, thresholds). Consider consolidating into a single `TIER_CONFIG` object in `src/lib/tiers.ts` or similar.
- [ ] **DRY check** - Tier colors/icons may be duplicated between map visualization, details panel, and other UI components. Unify into a single source of truth.
- [ ] **Modularity** - Tier assignment logic should be a pure function that can be easily unit tested.
- [ ] **Debt impact** - This change extends the tier system. Consider whether the completion threshold logic (any tier = completed) should be explicit in the code vs. implied.

**Specific refactoring task:** If tier configuration is currently scattered, create a centralized `src/lib/tiers.ts` file with:
```typescript
export const TIER_CONFIG = {
  platinum: { minScore: 0.95, color: '#a855f7', mapFill: '#7c3aed', icon: '🏆', ... },
  gold: { minScore: 0.85, ... },
  silver: { minScore: 0.70, ... },
  bronze: { minScore: 0.50, ... },
  potato: { minScore: 0, color: '#6b7280', mapFill: '#d1d5db', icon: '🥔', ... },
};
```

## Acceptance Criteria

- [ ] Activities with scores < 0.50 are assigned "Potato" tier
- [ ] Potato tier areas display with light gray fill (#d1d5db, opacity 0.40) on the map
- [ ] Potato tier areas show 🥔 icon at centroid (zoom 13+)
- [ ] Area Details Panel correctly displays Potato tier badge and score
- [ ] Areas with only Potato tier walks are marked as "completed" in progress tracking
- [ ] Ellstorp test walk (example of low-quality walk) displays with Potato tier on map
- [ ] All tier-related TypeScript types include "potato"
- [ ] No TypeScript compilation errors
- [ ] Map visualization is visually distinct from "Not Started" areas

## Files to Modify

| File | Change |
|------|--------|
| `src/lib/analysis.ts` | Add Potato tier assignment logic for scores < 0.50 |
| `src/lib/types.ts` (or similar) | Add `'potato'` to Tier type definition |
| `src/components/Map/Map.tsx` | Add Potato tier color styling and icon display |
| `src/components/AreaDetailsPanel.tsx` (if exists) | Add Potato tier badge display |
| `src/lib/tiers.ts` (NEW - recommended) | Centralized tier configuration object |

## Notes

- **Do NOT duplicate ADR/PRD content** - reference sections as needed
- Potato tier is the lowest tier but still counts as "completed" for progress tracking
- Visual distinction from "Not Started" (no fill) is critical: use light gray fill with opacity
- Test with the Ellstorp walk data to verify Potato tier displays correctly
- Consider adding E2E or integration test for tier assignment with score < 0.50

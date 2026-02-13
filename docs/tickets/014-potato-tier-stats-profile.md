# TICKET-014: Add Potato Tier to Stats and Profile Views

**Related:** ADR 003 (Section 3: Tier System), ADR 010 (Section 4: Tier Medal Icons), PRD Section 3.5, 3.10  
**Feature:** Map Visualization (docs/features/map-visualization.md), Analysis Engine (docs/features/analysis-engine.md)  
**Status:** Completed (2026-02-13)  
**Created:** 2026-02-13

## Context

The Potato tier (score < 0.50) was added in TICKET-013 and is properly implemented in:
- Tier assignment logic (`src/lib/analysis.ts`)
- Map visualization (`src/components/Map/Map.tsx`)
- `ProgressInfo` type definition

However, the Potato tier is **missing from UI display** in:
1. **ProgressDashboard** - Stats drawer showing tier breakdown
2. **ProfileCard** - Collapsible profile card with progress bar and tier legend

This ticket completes the Potato tier rollout by ensuring all tier-related UI views display Potato tier counts.

## Context to Load

Files the implementation agent MUST read first:

1. `docs/ADR/003-multi-metric-completion-scoring.md` Section 3 - Tier system with Potato tier
2. `docs/PRD/001-mvp-mobile-walker.md` Section 3.5 - Progress Dashboard requirements
3. `docs/PRD/001-mvp-mobile-walker.md` Section 3.10 - Profile Card requirements
4. `src/components/ProgressDashboard/ProgressDashboard.tsx` - Stats drawer component
5. `src/components/ProfileCard/ProfileCard.tsx` - Collapsible profile card component
6. `src/components/Map/Map.tsx` lines 63-73 - `ProgressInfo` type definition (already includes potato)
7. `src/lib/analysis.ts` - `getTierColor()` function for tier colors

## Implementation Checklist

### 1. Update ProgressDashboard TierStats Interface

The `TierStats` interface in ProgressDashboard.tsx (lines 6-11) only includes 4 tiers:

```typescript
// Current (missing potato)
interface TierStats {
  platinum: number;
  gold: number;
  silver: number;
  bronze: number;
}
```

Update to include `potato: number`.

**Note:** The parent component already passes `tierCounts` with all 5 tiers from `ProgressInfo` - only the local interface needs updating.

### 2. Add Potato to ProgressDashboard Tier Breakdown

The `tiers` array (lines 72-78) only lists 4 tiers for iteration:

```typescript
// Current
const tiers: Array<{ key: NonNullTier; label: string }> = [
  { key: 'platinum', label: 'Platinum' },
  { key: 'gold', label: 'Gold' },
  { key: 'silver', label: 'Silver' },
  { key: 'bronze', label: 'Bronze' },
];
```

Add `{ key: 'potato', label: 'Potato' }` to the array. Update the `NonNullTier` type accordingly.

### 3. Add Potato to ProfileCard Progress Bar

The progress bar (lines 183-219) renders segments for each tier but only includes 4 tiers:

```tsx
// Current - missing potato segment
{progress.tierCounts.platinum > 0 && ( /* segment */ )}
{progress.tierCounts.gold > 0 && ( /* segment */ )}
{progress.tierCounts.silver > 0 && ( /* segment */ )}
{progress.tierCounts.bronze > 0 && ( /* segment */ )}
```

Add a potato segment after bronze using the same pattern.

### 4. Add Potato to ProfileCard Tier Legend

The tier legend (lines 222-250) displays dots and counts for each tier but only includes 4 tiers:

```tsx
// Current - missing potato legend entry
{progress.tierCounts.platinum > 0 && ( /* legend item */ )}
{progress.tierCounts.gold > 0 && ( /* legend item */ )}
{progress.tierCounts.silver > 0 && ( /* legend item */ )}
{progress.tierCounts.bronze > 0 && ( /* legend item */ )}
```

Add a potato legend entry after bronze using the same pattern.

### 5. Verify getTierColor Supports Potato

Confirm `getTierColor('potato')` in `src/lib/analysis.ts` returns the correct color (`#b8936d` per ADR 003).

If not present, add the potato case to the switch statement.

## Maintainability

Before implementing, review for:

- [x] **Refactor opportunity?** Consider whether ProgressDashboard should import `TierStats` from a shared location instead of defining locally. Both `ProgressInfo.tierCounts` (Map.tsx) and `TierStats` (ProgressDashboard.tsx) define the same shape.
  - **DONE:** Created `src/lib/types/tiers.ts` with shared `TierCounts` type, `TIER_ORDER` constant, and `TIER_LABELS` map.
- [x] **DRY check** - The tier list `['platinum', 'gold', 'silver', 'bronze', 'potato']` appears in multiple places. Consider a `TIER_ORDER` constant in `src/lib/analysis.ts` or `src/lib/tiers.ts`.
  - **DONE:** `TIER_ORDER` constant exported from `src/lib/types/tiers.ts`.
- [x] **Modularity** - Progress bar segments and legend items follow the same pattern; consider extracting a reusable `TierIndicator` component if adding more tiers in the future.
  - **Note:** Not extracted yet; current pattern is simple enough. Recommend extracting if a 6th tier is ever added.
- [x] **Debt impact** - This change fixes an incomplete rollout of the Potato tier feature. No new debt introduced.

**Implementation notes:**
- Created `src/lib/types/tiers.ts` with shared `TierCounts` interface, `TIER_ORDER` array constant, `TierKey` type, and `TIER_LABELS` map.
- Updated `Map.tsx` to import `TierCounts` from shared location.
- Updated `ProgressDashboard.tsx` to use shared types and iterate with `TIER_ORDER`.
- Made ProgressDashboard content scrollable on small displays.

## Acceptance Criteria

- [x] ProgressDashboard tier breakdown section displays Potato tier with count
- [x] ProgressDashboard tier breakdown shows Potato tier with correct color (`#b8936d`)
- [x] ProfileCard progress bar includes Potato tier segment
- [x] ProfileCard tier legend includes Potato tier when count > 0
- [x] Potato tier count is accurate (matches Map.tsx analysis results)
- [x] No TypeScript compilation errors
- [x] Visual appearance is consistent with other tiers (same spacing, sizing)
- [x] Stats Grid in ProgressDashboard optionally shows Potato count (design decision: omitted to avoid clutter)

## Files Modified

| File | Change |
|------|--------|
| `src/lib/types/tiers.ts` | **NEW** - Shared `TierCounts` interface, `TIER_ORDER` constant, `TierKey` type, `TIER_LABELS` map |
| `src/components/Map/Map.tsx` | Import `TierCounts` from shared location, simplify `ProgressInfo` interface |
| `src/components/ProgressDashboard/ProgressDashboard.tsx` | Use shared types, add potato to tier breakdown, make content scrollable |
| `src/components/ProfileCard/ProfileCard.tsx` | Add Potato segment to progress bar and legend |
| `src/lib/analysis.ts` | Already had `getTierColor('potato')` - no changes needed |

## Notes

- Do NOT duplicate ADR/PRD content - reference sections as needed
- The `ProgressInfo.tierCounts` type in Map.tsx already includes `potato: number` - no changes needed there
- Use `getTierColor('potato')` for consistent color retrieval
- Potato tier uses the potato emoji (🥔) as icon per PRD 001 Section 3.4

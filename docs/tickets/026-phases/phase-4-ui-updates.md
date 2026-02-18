# Phase 4: UI Updates

**Parent Ticket:** [TICKET-026](../026-tiered-distance-scoring.md)  
**Priority:** Medium  
**Estimated Complexity:** Medium

## Overview

This phase updates the user interface to reflect the new scoring system:
1. Update AreaDetailsPanel with new metric names, weights, and tier distribution display
2. Add "How Scoring Works" menu item to HamburgerMenu

## Context Files to Read First

1. `docs/ADR/021-tiered-distance-scoring.md` - Sections 5, 7, 8 (naming, menu, display)
2. `docs/PRD/001-mvp-mobile-walker.md` - Section 3.7 (Area Details Panel)
3. `src/components/AreaDetailsPanel/AreaDetailsPanel.tsx` - Current score breakdown
4. `src/components/HamburgerMenu/HamburgerMenu.tsx` - Current menu structure
5. `src/lib/analysis.ts` - SCORE_WEIGHTS constant (updated in Phase 1)

## Prerequisites

- **Phase 1 must be complete** (new SCORE_WEIGHTS, `tierDistribution` in AnalysisMetrics)

## Tasks

### Task 4.1: Update `src/components/AreaDetailsPanel/AreaDetailsPanel.tsx`

#### Update Imports

```typescript
import { 
  getTierColor, 
  getTierDisplayName, 
  type Tier, 
  type AnalysisMetrics, 
  SCORE_WEIGHTS 
} from '@/lib/analysis';
import { DISTANCE_TIER_COLORS, type DistanceTier } from '@/lib/design-tokens';
```

#### Update Score Breakdown Table

Find the score breakdown `<table>` section and update:

**Before (4 metrics):**
```tsx
<tr>Border Traced - 40%</tr>
<tr>Area Enclosed - 25%</tr>
<tr>Path Precision - 20%</tr>
<tr>Route Efficiency - 15%</tr>
```

**After (3 metrics):**
```tsx
<tr className="border-b border-border">
  <td className="py-2 px-3 text-foreground">
    <Link
      href="/docs/scoring/boundary-coverage"
      className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
    >
      Boundary Coverage
      <span className="flex h-4 w-4 items-center justify-center rounded-full border border-blue-200 dark:border-blue-700 text-[10px] text-blue-500 dark:text-blue-400">
        i
      </span>
    </Link>
  </td>
  <td className="text-right py-2 px-3 text-foreground font-medium">
    {(details.metrics.tieredBorderScore * 100).toFixed(0)}%
  </td>
  <td className="text-right py-2 px-3 text-muted-foreground">
    {(SCORE_WEIGHTS.tieredBorder * 100).toFixed(0)}%
  </td>
</tr>
<tr className="border-b border-border">
  <td className="py-2 px-3 text-foreground">
    <Link
      href="/docs/scoring/area-enclosed"
      className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
    >
      Area Enclosed
      <span className="flex h-4 w-4 items-center justify-center rounded-full border border-blue-200 dark:border-blue-700 text-[10px] text-blue-500 dark:text-blue-400">
        i
      </span>
    </Link>
  </td>
  <td className="text-right py-2 px-3 text-foreground font-medium">
    {(details.metrics.areaCoveragePercent * 100).toFixed(0)}%
  </td>
  <td className="text-right py-2 px-3 text-muted-foreground">
    {(SCORE_WEIGHTS.areaCoverage * 100).toFixed(0)}%
  </td>
</tr>
<tr>
  <td className="py-2 px-3 text-foreground">
    <Link
      href="/docs/scoring/walk-focus"
      className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
    >
      Walk Focus
      <span className="flex h-4 w-4 items-center justify-center rounded-full border border-blue-200 dark:border-blue-700 text-[10px] text-blue-500 dark:text-blue-400">
        i
      </span>
    </Link>
  </td>
  <td className="text-right py-2 px-3 text-foreground font-medium">
    {(details.metrics.walkFocus * 100).toFixed(0)}%
  </td>
  <td className="text-right py-2 px-3 text-muted-foreground">
    {(SCORE_WEIGHTS.walkFocus * 100).toFixed(0)}%
  </td>
</tr>
```

**Remove:**
- "Path Precision" row (RMSE-based alignment is absorbed into tiered scoring)

#### Add Tier Distribution Display

After the score breakdown table, add a new section showing tier distribution:

```tsx
{/* Tier Distribution (ADR 021) */}
{details.metrics.tierDistribution && (
  <section className="mt-4">
    <h4 className="text-xs font-semibold text-muted-foreground mb-2">
      Precision Breakdown
    </h4>
    <div className="space-y-1.5">
      {(['platinum', 'gold', 'silver', 'bronze', 'potato', 'missed'] as DistanceTier[]).map((tier) => {
        const percentage = (details.metrics.tierDistribution[tier] || 0) * 100;
        const thresholdLabel = tier === 'platinum' ? '≤10m' :
                               tier === 'gold' ? '≤20m' :
                               tier === 'silver' ? '≤30m' :
                               tier === 'bronze' ? '≤40m' :
                               tier === 'potato' ? '≤50m' : '>50m';
        return (
          <div key={tier} className="flex items-center gap-2 text-xs">
            <div 
              className="w-3 h-3 rounded-sm shrink-0"
              style={{ backgroundColor: DISTANCE_TIER_COLORS[tier] }}
            />
            <span className="text-muted-foreground w-16 shrink-0 capitalize">
              {tier}
            </span>
            <span className="text-muted-foreground w-10 shrink-0">
              {thresholdLabel}
            </span>
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full transition-all"
                style={{ 
                  width: `${Math.min(percentage, 100)}%`,
                  backgroundColor: DISTANCE_TIER_COLORS[tier],
                }}
              />
            </div>
            <span className="text-foreground w-10 text-right shrink-0">
              {percentage.toFixed(0)}%
            </span>
          </div>
        );
      })}
    </div>
    <p className="text-xs text-muted-foreground mt-2 italic">
      Shows what % of your walk was in each precision tier.{' '}
      <Link href="/docs/scoring/precision-tiers" className="text-blue-600 dark:text-blue-400 hover:underline">
        Learn more
      </Link>
    </p>
  </section>
)}
```

### Task 4.2: Update `src/components/HamburgerMenu/HamburgerMenu.tsx`

#### Update Props Interface

Add new callback prop:

```typescript
interface HamburgerMenuProps {
  // ... existing props ...
  onOpenScoring: () => void;  // NEW: Open scoring docs
}
```

#### Add Menu Item

After the "Achievements" button and before the divider, add:

```tsx
{/* WHY: Scoring documentation per ADR 021 Section 7 */}
<button
  onClick={() => {
    onOpenChange(false);
    onOpenScoring();
  }}
  className="w-full px-4 py-2.5 text-left text-sm text-foreground hover:bg-secondary flex items-center gap-3 cursor-pointer"
>
  {/* Question/Info icon */}
  <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
  <span>How Scoring Works</span>
</button>
```

#### Update Parent Component

The parent component (likely `src/app/page.tsx` or similar) needs to:
1. Add state for scoring panel visibility
2. Pass `onOpenScoring` callback to HamburgerMenu
3. Render the scoring documentation panel/modal when open

This may involve:
```typescript
const [showScoringDocs, setShowScoringDocs] = useState(false);

// In HamburgerMenu:
onOpenScoring={() => setShowScoringDocs(true)}
```

**Note:** The actual scoring documentation pages are created in Phase 5. For now, you can navigate to `/docs/scoring` or show a placeholder.

## Acceptance Criteria

- [ ] Score breakdown shows 3 metrics: Boundary Coverage (45%), Area Enclosed (25%), Walk Focus (30%)
- [ ] "Path Precision" row removed from score breakdown
- [ ] Tier distribution section displays with progress bars for all 6 tiers
- [ ] Each tier shows correct color, threshold label, and percentage
- [ ] "How Scoring Works" menu item appears in hamburger menu
- [ ] Menu item navigates to scoring documentation (or placeholder)
- [ ] All metric names link to `/docs/scoring/*` pages

## Verification

```bash
npm run lint   # Must pass
npm run build  # Must pass
npm run test   # Must pass
```

**Visual verification:**
1. Open app and select a completed area
2. Verify score breakdown shows 3 metrics with correct weights
3. Verify tier distribution displays with colored progress bars
4. Verify hamburger menu has "How Scoring Works" option
5. Verify metric names are clickable links

## Dependencies

- Phase 1 must be complete (new SCORE_WEIGHTS, tierDistribution in metrics)

## Notes

- The `tierDistribution` may be null for walks analyzed before this update - handle gracefully
- Metric documentation links point to `/docs/scoring/*` which are created in Phase 5
- The HamburgerMenu callback will need wiring in the parent component
- Consider adding loading state if tierDistribution is being calculated

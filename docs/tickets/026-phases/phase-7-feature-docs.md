# Phase 7: Feature Documentation Updates

**Parent Ticket:** [TICKET-026](../026-tiered-distance-scoring.md)  
**Priority:** Low  
**Estimated Complexity:** Low

## Overview

This phase updates the internal feature documentation to reflect the new tiered scoring implementation. The `docs/features/analysis-engine.md` file has several `[TO BE UPDATED]` markers that need to be replaced with actual code references.

## Context Files to Read First

1. `docs/features/analysis-engine.md` - Current documentation with `[TO BE UPDATED]` markers
2. `src/lib/analysis.ts` - Updated implementation (from Phase 1)
3. `src/lib/distance-tiers.ts` - New tiered scoring module (from Phase 1)
4. `docs/ADR/021-tiered-distance-scoring.md` - Reference specification

## Prerequisites

- **Phase 1 must be complete** (so code references are accurate)

## Tasks

### Task 7.1: Update `docs/features/analysis-engine.md`

#### Replace `[TO BE UPDATED]` Markers

Find all instances of `[TO BE UPDATED]` and replace with actual implementation details:

**Section: Tiered Border Score (around line 65-67)**

Replace:
```markdown
> **[TO BE UPDATED]** Implementation agent will add actual code references and function details.
```

With:
```markdown
**Implementation:**

| Function | File | Purpose |
|----------|------|---------|
| `assignDistanceTier()` | `src/lib/distance-tiers.ts:XX` | Assigns tier based on distance |
| `calculateTieredBorderScore()` | `src/lib/distance-tiers.ts:XX` | Calculates weighted aggregate score |
| `DISTANCE_TIER_THRESHOLDS` | `src/lib/distance-tiers.ts:XX` | Tier distance constants |
| `TIER_POINTS` | `src/lib/distance-tiers.ts:XX` | Point values per tier |

The tiered border score is calculated in `analyzeWalk()` (`src/lib/analysis.ts:XXX`) using:
1. `polygonToPerimeterLines()` to get boundary lines
2. Iteration over walk segments, calculating midpoint distance to boundary
3. `assignDistanceTier()` to get tier and points for each segment
4. Segment-length-weighted aggregation
```

**Section: Walk Focus (around line 173-175)**

Replace:
```markdown
> **[TO BE UPDATED]** Implementation details to be added.
```

With:
```markdown
**Implementation:**

Walk Focus is calculated by `calculateEfficiency()` in `src/lib/analysis.ts:XXX`. The calculation:
1. Measures total walk distance (from Strava `distance` field when available)
2. Measures distance spent within 50m of boundary (the "qualifying" distance)
3. Returns ratio: `qualifying_distance / total_distance`

Note: The 50m threshold aligns with the maximum distance tier (Potato ≤50m). Segments beyond 50m are "Missed" and don't contribute to Walk Focus.
```

**Section: Quality Score Calculation (around line 198)**

Replace:
```markdown
> **[TO BE UPDATED]** Code references to be updated by implementation agent.
```

With:
```markdown
**Implementation:**

Quality score is calculated by `calculateQualityScore()` in `src/lib/analysis.ts:XXX`:

```typescript
const score = 
  SCORE_WEIGHTS.tieredBorder * tieredBorderScore +  // 0.45
  SCORE_WEIGHTS.areaCoverage * areaCoverage +       // 0.25
  SCORE_WEIGHTS.walkFocus * walkFocus;              // 0.30
```

The function then calls `assignTier(score)` from `src/lib/tiers.ts` to determine the quality tier (Platinum/Gold/Silver/Bronze/Potato).
```

**Section: Displayed Metrics in UI (around line 373-375)**

Replace:
```markdown
> **[TO BE UPDATED]** UI display code references to be updated.
```

With:
```markdown
**Implementation:**

Score breakdown is displayed in `AreaDetailsPanel.tsx` (`src/components/AreaDetailsPanel/AreaDetailsPanel.tsx:XXX`).

The component reads from `AnalysisMetrics`:
- `tieredBorderScore` → displayed as "Boundary Coverage"
- `areaCoveragePercent` → displayed as "Area Enclosed"  
- `walkFocus` → displayed as "Walk Focus"
- `tierDistribution` → displayed as progress bars below the score table

Tier distribution visualization uses `DISTANCE_TIER_COLORS` from `src/lib/design-tokens.ts`.
```

### Task 7.2: Update Line Numbers

After all Phase 1 implementation is complete, update the `XXX` placeholders with actual line numbers by searching the source files.

### Task 7.3: Review and Clean Up

1. Remove any remaining `[TO BE UPDATED]` markers
2. Ensure all code references are accurate
3. Check that ADR 021 is properly referenced throughout
4. Verify the "Magic Numbers Reference" table is up to date

### Task 7.4: Update Diagram

The ASCII diagram in the Metrics Overview section (around line 31-61) should already be updated but verify it shows:
- "Tiered Border Score (45%)" 
- "Area Coverage (25%)"
- "Walk Focus (30%)"
- "Distance Tier Classification"

## Acceptance Criteria

- [ ] All `[TO BE UPDATED]` markers replaced with actual content
- [ ] Code references include correct file paths and line numbers
- [ ] Function names and signatures match actual implementation
- [ ] Magic Numbers Reference table is complete and accurate
- [ ] ADR 021 is referenced where appropriate
- [ ] Documentation is consistent with implemented code

## Verification

```bash
# Search for any remaining TODO markers
grep -r "TO BE UPDATED" docs/features/

# Should return no results
```

## Dependencies

- Phase 1 must be complete (code must exist to reference)
- All other phases ideally complete for comprehensive documentation

## Notes

- This is documentation-only - no code changes
- Line numbers should be verified after Phase 1 is finalized
- Keep documentation concise - link to ADR 021 for full details
- This ensures future agents can reconstruct the mental model per AGENTS.md requirements

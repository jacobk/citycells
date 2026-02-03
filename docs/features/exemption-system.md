# Exemption System

## Overview

The exemption system allows users to mark detected deviations as "exempt" when they were unavoidable (e.g., private property, highways). Exempt deviations are factored out of the quality score calculation, giving users a fairer assessment of their walk.

## User Stories

From [PRD 001](../PRD/001-mvp-mobile-walker.md):
- "As a user, I want to mark obstacle detours as 'exempt' so my score isn't penalized for unavoidable obstacles"

## Implementation

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/exemptions.ts` | Exemption service: add/remove exemptions, recalculate scores |
| `src/lib/analysis.ts` | Deviation detection algorithm |
| `src/lib/db.ts` | Database schema for deviations table |

### Data Model

Exemptions are stored in the `deviations` table with these fields:

```sql
is_exempt INTEGER DEFAULT 0,
exemption_reason TEXT,
exempted_at TEXT
```

### Predefined Reasons

From PRD 001 section 3.7:

| Reason | When to Use |
|--------|-------------|
| Private property | Walker had to go around a private estate/yard |
| Highway / Major road | Unsafe to walk along highway |
| Water / River | River or water body blocking path |
| Construction zone | Temporary construction blocking route |
| Fenced area | Fence preventing direct access |
| Other | User-specified reason (requires free text) |

## How Exemptions Affect Scoring

From ADR 003 section 6:

### 1. Perimeter Coverage

```
effective_perimeter_coverage = (covered_length + Σ exempt_border_gaps) / perimeter_length
```

WHY: The border segment that was bypassed (border_gap) is treated as "walked" since the user couldn't physically walk it.

### 2. Efficiency

```
effective_walk_length = total_walk_length - Σ exempt_detour_distances
efficiency = border_aligned_length / effective_walk_length
```

WHY: The detour distance is removed from the total walk length, so the user isn't penalized for necessary detours.

### 3. Alignment (RMSE)

```
effective_rmse = rmse_excluding_exempt_segments
```

WHY: GPS points within exempt segments are excluded from the RMSE calculation. Currently implemented as a proportional approximation.

### 4. Area Coverage

Area coverage is NOT affected by exemptions because:
- The walk path still determines the enclosed area
- Exemptions only affect how we score the perimeter tracing

## Exemption Flow

```
┌─────────────────┐
│ User views area │
│ details panel   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Sees detected   │
│ deviations list │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│ Click "Mark as  │────>│ Exemption modal │
│ Exempt"         │     │ - Select reason │
└─────────────────┘     │ - Confirm       │
                        └────────┬────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │ Score           │
                        │ recalculates    │
                        │ immediately     │
                        └────────┬────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │ UI updates with │
                        │ new score/tier  │
                        └─────────────────┘
```

## API

### Add Exemption

```typescript
import { addExemption } from '@/lib/exemptions';

await addExemption(
  deviationId,
  'Private property'  // or other reason
);

// For 'Other' reason:
await addExemption(
  deviationId,
  'Other',
  'Gate was locked'  // custom reason required
);
```

### Remove Exemption

```typescript
import { removeExemption } from '@/lib/exemptions';

await removeExemption(deviationId);
// Score automatically recalculates
```

### Get Deviations with Exemption Status

```typescript
import { getDeviationsForAnalysis } from '@/lib/exemptions';

const deviations = getDeviationsForAnalysis(walkAnalysisId);
// Returns array with isExempt, exemptionReason, exemptedAt fields
```

### Get Adjusted Metrics

```typescript
import { getAdjustedMetrics } from '@/lib/exemptions';

const metrics = getAdjustedMetrics(walkAnalysisId);
// Returns both original and exemption-adjusted values
```

## Rationale

### Why Allow Exemptions?

From ADR 003:
- Real-world obstacles (fences, highways, private property) may prevent walkers from following the exact border
- Without exemptions, good-faith attempts would be unfairly penalized
- Users know their local environment better than the algorithm

### Why Require a Reason?

- Prevents casual/accidental exemptions
- Creates audit trail for potential future features (leaderboard verification)
- Helps users think about whether the exemption is justified

### Why Immediate Recalculation?

- Users expect instant feedback
- Score/tier changes should be visible immediately
- Prevents confusion about "stale" scores

## Current Limitations

1. **RMSE Approximation**: Currently uses a proportional reduction rather than re-calculating from GPS points. Full implementation would require storing all GPS points.

2. **No exemption validation**: Users can exempt any deviation. Future: could add heuristics to flag suspicious exemptions.

3. **No exemption history**: Cannot see when/why exemptions were changed. Future: add exemption audit log.

## ADR References

- [ADR 003: Multi-Metric Completion Scoring](../ADR/003-multi-metric-completion-scoring.md) - Section 6 defines exemption system
- [ADR 004: SQLite Storage](../ADR/004-sqlite-storage.md) - Deviations table schema

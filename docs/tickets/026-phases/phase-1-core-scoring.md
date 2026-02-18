# Phase 1: Core Scoring Logic

**Parent Ticket:** [TICKET-026](../026-tiered-distance-scoring.md)  
**Priority:** High  
**Estimated Complexity:** Medium-High

## Overview

This phase implements the core tiered distance scoring logic that replaces the binary 25m threshold with a 6-tier distance classification system per ADR 021.

## Context Files to Read First

Read these files to understand the current implementation:

1. `docs/ADR/021-tiered-distance-scoring.md` - Full specification (especially Sections 1-4)
2. `src/lib/analysis.ts` - Current scoring implementation
3. `src/lib/geo-distance.ts` - Distance calculation utilities
4. `src/lib/tiers.ts` - Existing tier assignment pattern (use as reference for code style)

## Tasks

### Task 1.1: Create `src/lib/distance-tiers.ts`

Create a new module with the following exports:

```typescript
// Constants
export const DISTANCE_TIER_THRESHOLDS = {
  platinum: 10,  // meters
  gold: 20,
  silver: 30,
  bronze: 40,
  potato: 50,
  // missed: > 50
} as const;

export const TIER_POINTS = {
  platinum: 1.0,
  gold: 0.80,
  silver: 0.55,
  bronze: 0.30,
  potato: 0.10,
  missed: 0,
} as const;

// Types
export type DistanceTier = 'platinum' | 'gold' | 'silver' | 'bronze' | 'potato' | 'missed';
export type TierDistribution = Record<DistanceTier, number>;

export interface TieredSegment {
  startIndex: number;
  endIndex: number;
  tier: DistanceTier;
  distanceMeters: number;
  segmentLengthMeters: number;
}

// Functions to implement
export function assignDistanceTier(distanceMeters: number): { tier: DistanceTier; points: number };
export function calculateTieredBorderScore(
  walkCoordinates: Position[],
  boundaryLines: Feature<LineString>[]
): { score: number; tierDistribution: TierDistribution; segments: TieredSegment[] };
```

**Implementation Notes:**
- `assignDistanceTier()`: Simple threshold check, return tier and points
- `calculateTieredBorderScore()`: 
  - For each walk segment, calculate midpoint
  - Find minimum distance from midpoint to any boundary line (use `distanceToPerimeterLines` from `geo-distance.ts`)
  - Assign tier based on distance
  - Weight by segment length using Haversine distance
  - Aggregate: `score = sum(tier_points * segment_length) / sum(segment_length)`
  - Track tier distribution as percentages

Add appropriate `// WHY:` comments explaining design decisions. Reference ADR 021.

### Task 1.2: Update `src/lib/analysis.ts`

#### Update SCORE_WEIGHTS

Change from:
```typescript
export const SCORE_WEIGHTS = {
  perimeterCoverage: 0.40,
  areaCoverage: 0.25,
  alignment: 0.20,
  efficiency: 0.15,
} as const;
```

To:
```typescript
// WHY: New weights per ADR 021 - tiered border score absorbs alignment
export const SCORE_WEIGHTS = {
  tieredBorder: 0.45,     // Captures both coverage AND precision
  areaCoverage: 0.25,     // Unchanged - rewards closing the loop
  walkFocus: 0.30,        // Renamed from efficiency, increased weight
} as const;

// Legacy weights kept for reference (commented out)
// export const LEGACY_SCORE_WEIGHTS = { ... }
```

#### Update AnalysisMetrics interface

Add new fields (keep legacy fields for backward compatibility):
```typescript
export interface AnalysisMetrics {
  // ... existing fields ...
  
  // NEW: Tiered scoring (ADR 021)
  tieredBorderScore: number;           // 0-1, weighted aggregate
  tierDistribution: TierDistribution;  // % of walk in each tier
  
  // Renamed for clarity (value unchanged)
  walkFocus: number;  // Same as efficiency, renamed per ADR 021
}
```

#### Update calculateQualityScore()

Modify to use new formula:
```typescript
export function calculateQualityScore(
  tieredBorderScore: number,  // NEW
  areaCoverage: number,
  walkFocus: number,          // Renamed from efficiency
  // Keep old params with default values for backward compatibility during transition
): { score: number; tier: Tier } {
  const score = 
    SCORE_WEIGHTS.tieredBorder * tieredBorderScore +
    SCORE_WEIGHTS.areaCoverage * areaCoverage +
    SCORE_WEIGHTS.walkFocus * walkFocus;
  
  const tier = assignTier(score);
  return { score, tier };
}
```

#### Update analyzeWalk()

1. Import `calculateTieredBorderScore` from `./distance-tiers`
2. Call it after getting boundary lines
3. Use its result for the new quality score calculation
4. Add `tieredBorderScore`, `tierDistribution`, and `walkFocus` to returned metrics

### Task 1.3: Create Unit Tests `src/lib/__tests__/distance-tiers.test.ts`

Create comprehensive tests:

```typescript
import { describe, it, expect } from 'vitest';
import { 
  assignDistanceTier, 
  calculateTieredBorderScore,
  DISTANCE_TIER_THRESHOLDS,
  TIER_POINTS,
} from '../distance-tiers';

describe('assignDistanceTier', () => {
  describe('boundary values', () => {
    it('should assign platinum for distance <= 10m', () => {
      expect(assignDistanceTier(0).tier).toBe('platinum');
      expect(assignDistanceTier(5).tier).toBe('platinum');
      expect(assignDistanceTier(10).tier).toBe('platinum');
    });
    
    it('should assign gold for 10m < distance <= 20m', () => {
      expect(assignDistanceTier(10.1).tier).toBe('gold');
      expect(assignDistanceTier(15).tier).toBe('gold');
      expect(assignDistanceTier(20).tier).toBe('gold');
    });
    
    // ... similar tests for silver, bronze, potato
    
    it('should assign missed for distance > 50m', () => {
      expect(assignDistanceTier(50.1).tier).toBe('missed');
      expect(assignDistanceTier(100).tier).toBe('missed');
      expect(assignDistanceTier(1000).tier).toBe('missed');
    });
  });
  
  describe('points assignment', () => {
    it('should return correct points for each tier', () => {
      expect(assignDistanceTier(5).points).toBe(1.0);
      expect(assignDistanceTier(15).points).toBe(0.8);
      expect(assignDistanceTier(25).points).toBe(0.55);
      expect(assignDistanceTier(35).points).toBe(0.3);
      expect(assignDistanceTier(45).points).toBe(0.1);
      expect(assignDistanceTier(55).points).toBe(0);
    });
  });
});

describe('calculateTieredBorderScore', () => {
  // Create simple test boundary (a square)
  const squareBoundary = // ... LineString feature
  
  it('should return 1.0 for path exactly on boundary', () => {
    // Test with path that follows boundary exactly
  });
  
  it('should return 0 for path entirely > 50m from boundary', () => {
    // Test with distant path
  });
  
  it('should weight by segment length', () => {
    // Test that longer segments have more impact
  });
  
  it('should calculate tier distribution correctly', () => {
    // Test that distribution percentages sum to 1.0
  });
});
```

## Acceptance Criteria

- [ ] `assignDistanceTier()` correctly assigns tiers at all boundary values
- [ ] `calculateTieredBorderScore()` produces scores 0-1 using segment-length weighting
- [ ] Tier distribution percentages sum to 1.0 (within floating point tolerance)
- [ ] New `SCORE_WEIGHTS` match ADR 021 (0.45, 0.25, 0.30)
- [ ] `analyzeWalk()` returns new metrics (`tieredBorderScore`, `tierDistribution`, `walkFocus`)
- [ ] Legacy fields still calculated for backward compatibility
- [ ] All unit tests pass

## Verification

```bash
npm run lint   # Must pass
npm run build  # Must pass
npm run test   # Must pass (including new tests)
```

## Dependencies

- None (this is the first phase)

## Notes

- Do NOT update UI components - that's Phase 4
- Do NOT update database schema - that's Phase 2
- Do NOT update route visualization - that's Phase 3
- Keep legacy fields in AnalysisMetrics for now - they'll be used for comparison testing in Phase 6

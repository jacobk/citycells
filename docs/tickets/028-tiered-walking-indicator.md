# TICKET-028: Tiered Walking Indicator Enhancements

**Related:** ADR 017 (Updates Section), ADR 021, PRD Section 3.13  
**Feature:** [Distance-to-Boundary Indicator](../features/distance-indicator.md), [Live Walking Mode](../features/live-walking-mode.md)  
**Status:** Ready for Implementation  
**Created:** 2026-02-21

## Context to Load

Files the implementation agent MUST read first:

1. `docs/ADR/017-live-walking-mode.md` - Read the Updates section (2026-02-21) for tiered indicator specifications
2. `docs/ADR/021-tiered-distance-scoring.md` - Tier thresholds and color definitions
3. `docs/features/distance-indicator.md` - Current implementation details and data flow
4. `src/components/WalkingMode/LivePositionMarker.tsx` - Position marker to modify
5. `src/components/WalkingMode/WalkingControls.tsx` - Status bar indicator to modify
6. `src/components/WalkingMode/WalkingMode.tsx` - Main component managing tier state

## Implementation Checklist

### 1. Add Tier Assignment Logic

Create or extend utility to assign distance tier based on ADR 021 thresholds:

| Distance | Tier | Points |
|----------|------|--------|
| ≤10m | Platinum | 1.00 |
| ≤20m | Gold | 0.80 |
| ≤30m | Silver | 0.55 |
| ≤40m | Bronze | 0.30 |
| ≤50m | Potato | 0.10 |
| >50m | Missed | 0.00 |

Reference existing tier logic if present in `src/lib/distance_tiers.ts` or similar.

### 2. Update LivePositionMarker with Tier Colors

Modify `LivePositionMarker.tsx` to:
- Accept `tier` prop (or `distance` and compute tier internally)
- Apply tier-specific colors to the CircleMarker:

| Tier | Color | Hex |
|------|-------|-----|
| Platinum | Deep Violet | `#7c3aed` |
| Gold | Vibrant Purple | `#a855f7` |
| Silver | Magenta Pink | `#d946ef` |
| Bronze | Soft Pink | `#f0abfc` |
| Potato | Warm Gray | `#a1a1aa` |
| Missed | Light Red | `#fca5a5` |

- **Enlarge marker to 2x current size** for outdoor visibility

### 3. Update WalkingControls Status Text

Modify `WalkingControls.tsx` to:
- Display tier name in status: `"{distance}m - {Tier}"` (e.g., "12m - Gold")
- Apply tier-specific background/text colors matching the tier color scheme
- **Enlarge the indicator pill to 2x current size** for outdoor visibility

### 4. Update WalkingMode State Management

Modify `WalkingMode.tsx` to:
- Compute tier when distance changes (using tier assignment utility)
- Pass tier information to child components

### 5. Verify Auto-Follow Documentation

The current center-on-me button behavior should already re-enable auto-follow mode when pressed. Verify this works correctly and add `// WHY:` comment explaining the behavior if not already present.

## Maintainability

Before implementing, review for:

- [x] **Refactor opportunity?** Tier assignment logic may already exist in `src/lib/distance_tiers.ts` - reuse it
- [x] **DRY check** - Tier colors are defined in ADR 021 and used in route visualization - ensure single source of truth
- [x] **Modularity** - Tier utilities should be in `src/lib/` for testability
- [ ] **Debt impact** - This reduces debt by aligning real-time display with post-walk analysis

**Specific refactoring tasks:**
- If tier assignment logic doesn't exist as a reusable function, create one in `src/lib/distance-tiers.ts`
- If tier colors are hardcoded elsewhere (route visualization), consolidate to shared constant

## Testing Requirements

**Reference:** [AGENTS.md Section 2](../../AGENTS.md#2-build-verification-checklist-required), [ADR 020](../ADR/020-agent-build-verification.md)

### Unit Tests Required

| Function | Test File | Test Cases |
|----------|-----------|------------|
| `assignDistanceTier(distance)` | `src/lib/__tests__/distance-tiers.test.ts` | Test boundary values: 10, 10.1, 20, 30, 40, 50, 51 |
| `getTierColor(tier)` | `src/lib/__tests__/distance-tiers.test.ts` | Test each tier returns correct hex color |

If these functions already exist and have tests, verify tests still pass after any modifications.

### Verification Checklist

Implementation agent MUST run before marking complete:
```bash
npm run lint   # Must pass
npm run build  # Must pass
npm run test   # Must pass
```

## Acceptance Criteria

- [ ] Position marker color changes based on distance tier (6 tiers, not binary)
- [ ] Status text shows distance and tier name (e.g., "12m - Gold")
- [ ] Status indicator and marker are approximately 2x larger than before
- [ ] Colors match ADR 021 specification exactly
- [ ] Center-on-me button re-enables auto-follow mode when pressed
- [ ] Zooming while auto-follow is active keeps map centered on user
- [ ] All verification commands pass (lint, build, test)

## Files to Modify

| File | Change |
|------|--------|
| `src/components/WalkingMode/LivePositionMarker.tsx` | Add tier-based coloring, enlarge marker |
| `src/components/WalkingMode/WalkingControls.tsx` | Update status text format, add tier colors, enlarge indicator |
| `src/components/WalkingMode/WalkingMode.tsx` | Add tier computation, pass tier to children |
| `src/lib/distance-tiers.ts` | Add/verify tier assignment utility (if not exists) |
| `src/lib/__tests__/distance-tiers.test.ts` | Add tests for tier functions (if new functions created) |

## Notes

- Do NOT duplicate ADR/PRD content - reference it
- Check if tier utilities already exist before creating new ones
- The 2x size increase is approximate - use judgment for visual balance
- Test on mobile device or simulator for outdoor readability

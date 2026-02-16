# TICKET-018: Distance-to-Boundary Indicator

**Related:** ADR 002 (25m buffer), ADR 003 (scoring thresholds), PRD Section 3.13  
**Feature:** Distance-to-Boundary Indicator from docs/features/distance-indicator.md  
**Status:** ✅ Implemented  
**Created:** 2026-02-16  
**Completed:** 2026-02-16

## Context to Load

Files the implementation agent MUST read first:

1. `docs/features/distance-indicator.md` - Feature overview and rationale
2. `docs/PRD/001-mvp-mobile-walker.md` Section 3.13 - Functional requirements for distance indicator
3. `docs/ADR/002-exclusive-activity-matching.md` - 25m buffer definition
4. `docs/ADR/003-multi-metric-completion-scoring.md` - PERIMETER_BUFFER_METERS constant
5. `src/components/WalkingMode/WalkingMode.tsx` - Main component to modify
6. `src/components/WalkingMode/WalkingControls.tsx` - Status bar component
7. `src/components/WalkingMode/LivePositionMarker.tsx` - Position marker component
8. `src/lib/analysis.ts` - Existing `distanceToLine()` and `nearestPointOnLine()` utilities
9. `src/lib/route-visualization.ts` - Additional distance calculation patterns

## Implementation Checklist

### 1. Create distance calculation utility

Extract/reuse distance-to-boundary calculation from existing code in `src/lib/analysis.ts`. The function should:
- Accept current GPS position and boundary polygon
- Convert polygon to perimeter LineString (use existing pattern with `turf.polygonToLine`)
- Calculate distance to nearest point on perimeter
- Return distance in meters

### 2. Add distance state to WalkingMode

Add state management in `WalkingMode.tsx`:
- Track `distanceToBoundary: number | null`
- Track `withinTolerance: boolean`
- Recalculate on each GPS position update from `useGeolocationTracking`

### 3. Update WalkingControls status bar

Modify `WalkingControls.tsx` to display distance:
- Add distance indicator next to GPS accuracy display
- Show "On track (Xm)" with green styling when within 25m
- Show "Xm from boundary" with neutral styling when outside 25m
- Only display when GPS position is available

### 4. Update LivePositionMarker color

Modify `LivePositionMarker.tsx`:
- Accept `withinTolerance: boolean` prop
- Change marker fill color: green (`#22c55e`) when true, blue (`#3b82f6`) when false
- Maintain existing accuracy circle behavior

### 5. Wire up data flow

Connect components in `WalkingMode.tsx`:
- Pass calculated distance to `WalkingControls`
- Pass `withinTolerance` to `LivePositionMarker`
- Ensure updates happen on each position change

## Maintainability

Before implementing, review for:

- [x] **Refactor opportunity?** Distance calculation exists in `analysis.ts` and `route-visualization.ts` - consider extracting to shared utility
- [x] **DRY check** - `distanceToLine()` is duplicated between `analysis.ts` and `route-visualization.ts` - consolidate during this work
- [x] **Modularity** - Distance calculation should be a pure function, easy to test
- [x] **Debt impact** - This adds new code but can reduce debt by consolidating duplicate distance utilities

**Completed refactoring tasks:**
1. ✅ Created `src/lib/geo-distance.ts` to consolidate all distance calculation utilities
2. ✅ `PERIMETER_BUFFER_METERS = 25` is now exported from `geo-distance.ts` and re-exported from `analysis.ts` for backwards compatibility
3. ✅ Both `analysis.ts` and `route-visualization.ts` now import distance utilities from `geo-distance.ts`

## Acceptance Criteria

- [x] Distance from boundary displays in bottom status bar during live walking
- [x] Distance updates in real-time as GPS position changes
- [x] "On track" indicator shows green when within 25m of boundary
- [x] Distance shows neutral styling when outside 25m tolerance
- [x] Position marker (blue dot) turns green when within 25m tolerance
- [x] Position marker returns to blue when outside 25m tolerance
- [x] No distance shown when GPS position unavailable
- [x] Performance: distance calculation does not cause visible lag on position updates (memoized perimeter lines)

## Files Modified

| File | Change |
|------|--------|
| `src/lib/geo-distance.ts` | **NEW** Consolidated distance calculation utilities |
| `src/lib/analysis.ts` | Import from `geo-distance.ts`, removed duplicate functions |
| `src/lib/route-visualization.ts` | Import from `geo-distance.ts`, removed duplicate functions |
| `src/components/WalkingMode/WalkingMode.tsx` | Add distance state, memoized perimeter lines, distance calculation effect |
| `src/components/WalkingMode/WalkingControls.tsx` | Add distance indicator UI with color-coded styling |
| `src/components/WalkingMode/LivePositionMarker.tsx` | Add `withinTolerance` prop, conditional marker color |
| `docs/features/distance-indicator.md` | Updated with implementation details |

## Notes

- Do NOT duplicate ADR/PRD content - reference it
- The 25m threshold is defined in ADR 002 and used throughout the analysis engine
- Existing Turf.js patterns: `turf.nearestPointOnLine()`, `turf.distance()`, `turf.polygonToLine()`
- Test on mobile device - this feature is primarily for field use

# TICKET-032: Fix Mobile Freeze During Walk Analysis

**Related:** ADR 002, ADR 003, ADR 004, PRD Section 3.1
**Feature:** Map Visualization / Analysis Engine
**Status:** Implemented
**Created:** 2026-04-10

## Problem

After Strava OAuth on iPhone 15 (Safari + Chrome), the app freezes — the map renders with walked areas visible, but zoom, pan, and all buttons are unresponsive. Desktop is fine. The root cause is heavy synchronous computation blocking the main thread on mobile.

## Root Cause

`src/components/Map/Map.tsx` lines 322–743 contain a `useEffect` with an analysis loop that runs **synchronously on the main thread** inside a `setTimeout(..., 100)`. There are two hot spots:

### 1. O(n²) intersection + scoring loop (lines 564–608)

```
processedActivities.forEach(activity => {
  allAreaDetails.forEach((area, areaId) => {
    turf.booleanIntersects(...)   // expensive geometry check
    analyzeWalk(...)              // full perimeter/area/alignment analysis
  });
});
```

With 25 activities × 136 areas = 3,400 iterations of expensive turf.js geometry ops. On iPhone this blocks the main thread for 10+ seconds — long enough for iOS to suppress all touch events.

### 2. Sequential DB writes (lines 615–652)

```
for (const [activityId, { areaId }] of activityBestArea.entries()) {
  await saveWalkAnalysis(...);   // IndexedDB write, one at a time
  await saveWalkStreams(...);
}
```

Each `await` serializes writes. 20 activities × ~50ms each = another 1+ second of blocking.

### 3. GeoJSON key forces full SVG rebuild (line 904)

```
<GeoJSON key={`geojson-${areaAnalyses.size}`} ... />
```

Every time `areaAnalyses.size` changes (which happens during analysis), Leaflet tears down and rebuilds all 136 SVG polygon elements. On iOS with limited GPU memory for SVG (~10MB cap), this compounds the freeze.

## Implementation Instructions

### Fix 1: Chunk the analysis loop to yield to the browser

Break the outer `processedActivities.forEach` into batches that yield control back to the browser between each activity. This keeps the main thread responsive for touch events.

Approach: Process one activity at a time using a loop that yields via `await new Promise(resolve => setTimeout(resolve, 0))` between iterations. Wrap the analysis in an async function that can be cancelled if the effect re-runs.

Key constraints:
- The effect already uses `setTimeout(async () => { ... }, 100)` — it's async-ready
- Must handle effect cleanup / cancellation (if deps change mid-analysis, abort the old run)
- Cached results should still display instantly (lines 371–430 — leave this untouched)
- The `setIsAnalyzing` / `setNewActivityCount` state updates should still work for the UI indicator
- Only the "new activity" analysis loop (lines 564–608 and 615–652) needs chunking

Example pattern:
```ts
let cancelled = false;

for (const pAct of processedActivities) {
  if (cancelled) break;
  // ... process one activity against all areas ...
  // Yield to browser between activities
  await new Promise(resolve => setTimeout(resolve, 0));
}

// In cleanup:
return () => { cancelled = true; };
```

### Fix 2: Batch DB writes

Replace the sequential `for...of` with `await` pattern (lines 615–652) with a batched approach. Collect all results first, then save in a single transaction or parallel batch.

### Fix 3: Stabilize the GeoJSON key

The `key={`geojson-${areaAnalyses.size}`}` at line 904 causes a full SVG teardown/rebuild whenever analysis count changes. Instead:
- Use a stable key (e.g., just `"geojson"` or based on the GeoJSON data identity)
- Update polygon styles via Leaflet's `setStyle()` method instead of re-mounting the entire component
- This avoids GPU memory pressure on iOS from repeated SVG DOM thrashing

### Fix 4 (optional): Add viewport config

In `src/app/layout.tsx`, the `viewport` export (lines 57–62) only sets `themeColor`. Add:
```ts
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [ ... ],
};
```

And in `src/components/Map/Map.tsx` line 882, replace `h-screen` with `h-dvh` to fix the iOS 100vh bug.

## Files to Modify

| File | Change |
|------|--------|
| `src/components/Map/Map.tsx` | Chunk analysis loop, batch DB writes, stabilize GeoJSON key, replace `h-screen` with `h-dvh` |
| `src/app/layout.tsx` | Add proper viewport config |

## Acceptance Criteria

- [ ] Analysis loop yields to browser between activities (main thread never blocked >50ms)
- [ ] Map is interactive (zoom, pan, buttons) immediately after auth, even while analysis runs in background
- [ ] GeoJSON polygons update their styles without full DOM teardown
- [ ] All existing tests pass (`npm run test:run`)
- [ ] Build succeeds (`npm run build`)
- [ ] Lint passes (`npm run lint`)

## Testing

Test on a real iPhone (or Safari mobile simulator) with 10+ Strava activities:
1. Clear site data, authenticate with Strava
2. Verify map is zoomable/pannable immediately while "Analyzing..." indicator shows
3. Verify analysis completes and polygon colors update without page freeze

# TICKET-017: Live Walking Mode

**Related:** ADR 017, PRD Section 3.13  
**Feature:** Live Walking Mode from docs/features/  
**Status:** Ready for Implementation  
**Created:** 2026-02-15

## Context to Load

Files the implementation agent MUST read first:

1. `docs/ADR/017-live-walking-mode.md` - Technical approach decision (in-app vs Google export), geolocation implementation details
2. `docs/PRD/001-mvp-mobile-walker.md` Section 3.13 - Functional requirements for walking mode UI and behavior
3. `docs/features/live-walking-mode.md` - Feature overview and rationale
4. `src/components/AreaDetailsPanel/AreaDetailsPanel.tsx` - Main panel component where "Start Walking" button should be added (near line 412-426, after mini-map section)
5. `src/components/AreaMiniMap/AreaMiniMap.tsx` - Reference for Leaflet map setup, boundary styling
6. `src/hooks/useExpandablePanel.ts` - Reference for gesture handling patterns
7. `src/app/page.tsx` - State management patterns, understand how panel views are controlled

## Implementation Checklist

### 1. Create Geolocation Tracking Hook

Create `src/hooks/useGeolocationTracking.ts`:
- Wrap browser `watchPosition()` API in React hook
- Options: `enableHighAccuracy: true`, `maximumAge: 0`, `timeout: 10000`
- Return: `{ position, accuracy, error, isTracking }`
- Handle permission states and errors
- Cleanup: `clearWatch()` on unmount

### 2. Create Wake Lock Hook

Create `src/hooks/useWakeLock.ts`:
- Request Screen Wake Lock on activation
- Release on deactivation or unmount
- Handle browsers without Wake Lock support gracefully
- Return: `{ isSupported, isActive, request, release }`

### 3. Create Walking Mode Component

Create `src/components/WalkingMode/WalkingMode.tsx`:
- Full-screen overlay component
- Accept props: `geometry`, `areaName`, `onExit`
- Render full-screen Leaflet map (reuse tile config from main map)
- Display sub-area boundary polygon with prominent styling
- Auto-fit bounds to polygon on mount

### 4. Create Live Position Marker Component

Create `src/components/WalkingMode/LivePositionMarker.tsx`:
- Use `useGeolocationTracking` hook
- Render blue dot marker at current position
- Render accuracy circle around marker
- Auto-center map on position updates (with toggle option)

### 5. Create Walking Controls Component

Create `src/components/WalkingMode/WalkingControls.tsx`:
- Exit button (top-left, prominent)
- Center-on-me button (re-centers map)
- Zoom in/out buttons
- Wake Lock status indicator (when active)
- Position/accuracy display (optional)

### 6. Add Entry Point to Area Details Panel

Modify `src/components/AreaDetailsPanel/AreaDetailsPanel.tsx`:
- Add "Start Walking" button in the fixed (non-scrolling) area
- Position: After mini-map, before Area Stats section (around line 412)
- Button should receive `geometry` and `areaName` props
- On click: trigger walking mode

### 7. Wire Up State in Page Component

Modify `src/app/page.tsx`:
- Add state for walking mode: `isWalkingMode`, `walkingAreaId`
- Pass handler to AreaDetailsPanel
- Render WalkingMode component when active
- Handle exit callback

### 8. Handle Permission Flow

- Show explanatory UI before requesting geolocation permission
- Handle permission denied with clear error message
- Handle "blocked" state with instructions to enable in settings
- Test on iOS Safari (no Wake Lock) and show one-time tip

## Maintainability

Before implementing, review for:

- [x] **Refactor opportunity?** Geolocation logic should be a reusable hook (not inline)
- [x] **DRY check** - Reuse Leaflet tile config from main map, reuse boundary styling from AreaMiniMap
- [x] **Modularity** - WalkingMode should be fully self-contained, testable in isolation
- [ ] **Debt impact** - New feature, no existing debt. Ensure hooks are properly typed.

**Specific cleanup tasks:**
- Extract tile layer configuration to shared constant if not already done
- Ensure consistent boundary polygon styling between AreaMiniMap and WalkingMode

## Acceptance Criteria

- [ ] "Start Walking" button visible in Area Details Panel for all sub-areas
- [ ] Tapping button opens full-screen walking mode view
- [ ] Walking mode displays sub-area boundary polygon
- [ ] Live position marker updates as user moves (requires real GPS or browser location spoofing)
- [ ] Accuracy circle displayed around position marker
- [ ] Exit button returns to Area Details Panel
- [ ] Center-on-me button re-centers map on current position
- [ ] Geolocation permission prompt appears on first use
- [ ] Graceful error handling when permission denied
- [ ] Wake Lock activated on Chrome/Android (verify screen stays on)
- [ ] iOS Safari shows tip about screen timeout (one-time)
- [ ] Walking mode works on mobile viewport sizes

## Files to Modify

| File | Change |
|------|--------|
| NEW: `src/hooks/useGeolocationTracking.ts` | Geolocation watchPosition hook |
| NEW: `src/hooks/useWakeLock.ts` | Screen Wake Lock management |
| NEW: `src/components/WalkingMode/WalkingMode.tsx` | Main walking mode component |
| NEW: `src/components/WalkingMode/LivePositionMarker.tsx` | Position marker with accuracy |
| NEW: `src/components/WalkingMode/WalkingControls.tsx` | Control buttons |
| NEW: `src/components/WalkingMode/index.tsx` | Barrel export |
| `src/components/AreaDetailsPanel/AreaDetailsPanel.tsx` | Add "Start Walking" button |
| `src/app/page.tsx` | Walking mode state management |

## Notes

- Do NOT duplicate ADR/PRD content - reference it
- Test on real mobile device for accurate geolocation behavior
- Browser DevTools can simulate location for development
- Consider adding satellite tile layer as follow-up enhancement (documented as nice-to-have)
- This feature does NOT record walks - Strava handles that separately

# Live Walking Mode

## Overview

Live Walking Mode provides real-time GPS navigation for users walking sub-area boundaries. It displays a full-screen map showing the selected sub-area boundary and the user's live position, updating continuously as they move. This feature transforms CityCells from a post-walk analysis tool into an active walking companion.

The feature is triggered from the Area Details Panel via a "Start Walking" button, making it accessible for any sub-area the user is viewing.

## User Stories

From [PRD 001](../PRD/001-mvp-mobile-walker.md) Section 2 (Live Walking Mode Stories):
- "As a user, I want to start a live walking session for a selected sub-area, so I can see my real-time position relative to the boundary."
- "As a user, I want to see a full-screen map showing the sub-area boundary while walking, so I know exactly where to go."
- "As a user, I want my GPS position to update continuously on the map, so I can see how I move relative to the boundary."
- "As a user, I want to trigger live walking mode from the area details panel, so I can start walking any area I'm viewing."
- "As a user, I want the screen to stay on during active walking (where supported), so I don't have to keep waking my phone."
- "As a user, I want to exit walking mode and return to the normal app view when I'm done, so I can review my progress."

## Implementation

### Key Files

| File | Purpose |
|------|---------|
| `src/components/WalkingMode/WalkingMode.tsx` | Main full-screen walking mode component |
| `src/components/WalkingMode/LivePositionMarker.tsx` | User position marker with accuracy circle |
| `src/components/WalkingMode/WalkingControls.tsx` | Exit, center, zoom controls |
| `src/components/WalkingMode/index.tsx` | Barrel export for WalkingMode components |
| `src/hooks/useGeolocationTracking.ts` | Geolocation watchPosition hook |
| `src/hooks/useWakeLock.ts` | Screen Wake Lock management hook |
| `src/lib/map-config.ts` | Shared map configuration (tile URL, default zoom) |
| `src/components/AreaDetailsPanel/AreaDetailsPanel.tsx` | "Start Walking" button entry point |
| `src/app/page.tsx` | Walking mode state management |

### Data Flow

```
User taps "Start Walking" in AreaDetailsPanel
    ↓
page.tsx: handleStartWalking(areaId)
    ↓
Sets walkingMode state with: { isActive, areaId, geometry, areaName, tier }
    ↓
Closes panels, renders WalkingMode component
    ↓
WalkingMode mounts:
    - Calls useGeolocationTracking().startTracking()
    - Calls useWakeLock().request() (if supported)
    - Renders MapContainer with boundary polygon
    ↓
useGeolocationTracking:
    - Calls navigator.geolocation.watchPosition()
    - Updates position state on each GPS fix
    - LivePositionMarker re-renders with new position
    ↓
User taps Exit button:
    - handleExit() confirms if tracking > 1 minute
    - stopTracking() clears watch
    - release() releases wake lock
    - onExit() → page.tsx re-opens AreaDetailsPanel
```

### Key Functions

**useGeolocationTracking hook:**
- `startTracking()` - Starts `watchPosition()` with high accuracy options
- `stopTracking()` - Calls `clearWatch()` to stop updates
- Returns: `{ position, accuracy, error, permissionState, isTracking, isAcquiring }`

**useWakeLock hook:**
- `request()` - Acquires screen wake lock (Chrome/Android only)
- `release()` - Releases wake lock
- Auto re-acquires on visibility change (when tab becomes visible again)
- `isIOSSafari()` - Exported helper to detect iOS Safari for showing tip

**WalkingMode component:**
- Manages map state (auto-center toggle, zoom level)
- Coordinates geolocation tracking and wake lock lifecycle
- Handles permission errors with user-friendly overlay
- Shows iOS Safari tip (one-time, dismissible, stored in localStorage)

**WalkingControls component:**
- Exit button with confirmation if tracking > 1 minute
- Center-on-me button re-centers map and re-enables auto-follow mode
- Zoom in/out buttons
- Status indicators: GPS acquiring spinner, wake lock active badge, accuracy display
- **Distance indicator (2x enlarged)**: Shows distance and tier (e.g., "12m - Gold") with tier-colored styling

**LivePositionMarker component:**
- Renders tier-colored dot (`CircleMarker`) at current position (color based on distance tier per ADR 021)
- Renders accuracy circle (`Circle`) showing GPS uncertainty
- Auto-centers map when `autoCenter` prop is true (re-enabled by center-on-me button)
- **Marker size 2x enlarged** for outdoor visibility

## Rationale

### Design Decisions

**Why in-app vs. Google Maps export?**
Google Maps export was considered but rejected due to:
1. High setup friction (requires desktop import to Google My Maps)
2. User leaves CityCells ecosystem
3. Limited customization of boundary styling
4. No ability to add future enhancements (distance-to-boundary, live completion tracking)

**Why full-screen overlay?**
Walking users need maximum map visibility. A full-screen view:
- Maximizes boundary visibility
- Reduces UI clutter during outdoor use
- Provides clear context separation from analysis mode
- Allows larger touch targets for gloved/outdoor use

**Why watchPosition vs. getCurrentPosition?**
`watchPosition()` provides continuous updates without manual polling, which:
- Reduces battery overhead vs. repeated `getCurrentPosition()` calls
- Automatically handles GPS lock state changes
- Simplifies cleanup via single `clearWatch()` call

**Platform limitation acceptance:**
Browsers cannot track location in background or with screen off. This is accepted because:
- Walking users typically keep phone visible
- Screen Wake Lock mitigates on Chrome/Android
- Same limitation exists for all web-based fitness apps

### ADR References

- [ADR 017: Live Walking Mode](../ADR/017-live-walking-mode.md) - Technical approach decision, comparing in-app vs. Google export options. Updated 2026-02-21 with tiered distance indicator enhancements.
- [ADR 021: Tiered Distance Scoring](../ADR/021-tiered-distance-scoring.md) - Defines the 6-tier color system used by the distance indicator

## Current Limitations

1. **No background tracking** - Browser security prevents location access when app is backgrounded or screen is off
2. **iOS Safari Wake Lock** - Screen Wake Lock API not supported; users must manually adjust screen timeout
3. **No route recording** - This feature only displays position, doesn't record a walk (Strava handles that)
4. **No offline map tiles** - If user walks into uncached area without connectivity, map may not load
5. **No satellite view (MVP)** - Documented as nice-to-have enhancement for future iteration

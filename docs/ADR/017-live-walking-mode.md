# ADR 017: Live Walking Mode

**Date:** 2026-02-15
**Status:** Accepted
**Supersedes:** N/A

## Context

Users want to navigate in real-time while walking sub-area boundaries. Currently, CityCells only shows completed walks after syncing from Strava. Users have requested the ability to:
1. See their live GPS position while walking
2. View the sub-area boundary they're trying to trace
3. Have a mobile-friendly interface optimized for outdoor use

Two approaches were evaluated:

### Option A: Google Maps Export
- Export sub-area boundaries as KML files
- User imports to Google My Maps (desktop-only)
- View custom layer in Google Maps app with live blue dot

### Option B: In-App Live Map
- Build full-screen walking mode within CityCells
- Use browser Geolocation API for continuous position updates
- Display live position marker on Leaflet map with boundary overlay

## Decision

We will implement **Option B: In-App Live Map** as the primary solution.

### Rationale

| Factor | Google Export | In-App | Winner |
|--------|--------------|--------|--------|
| Setup friction | High (desktop import required) | None (tap and go) | In-App |
| Integration | User leaves app | Stays in CityCells | In-App |
| Boundary styling | Limited customization | Full control | In-App |
| Feature potential | Static overlay only | Can add live feedback | In-App |
| Stability | Native app, very stable | Depends on browser | Google |
| Background tracking | Yes (native app) | No (browser limitation) | Google |

**Key trade-off accepted:** Browser apps cannot track location in the background or with screen off. Users must keep the screen visible while walking. This limitation is acceptable because:
1. Walking users typically hold phone or use armband with screen visible
2. Screen Wake Lock API can keep display on (Chrome/Android)
3. Most fitness web apps have this same limitation

### Geolocation Implementation

```typescript
// Use watchPosition for continuous updates
const watchId = navigator.geolocation.watchPosition(
  (position) => updateMarker(position.coords),
  (error) => handleError(error),
  {
    enableHighAccuracy: true,  // GPS precision required
    maximumAge: 0,             // No cached positions
    timeout: 10000             // 10s timeout for lock
  }
);
```

### Screen Wake Lock (Chrome/Android only)

```typescript
// Keep screen on during active walking
if ('wakeLock' in navigator) {
  const wakeLock = await navigator.wakeLock.request('screen');
}
```

**Note:** iOS Safari does not support Screen Wake Lock. iOS users will need to manage screen timeout manually in device settings.

### Map Implementation

- Full-screen Leaflet map (reuse existing infrastructure)
- Live position marker with accuracy circle
- Sub-area boundary polygon with prominent styling
- Auto-center on user position (with toggle to disable)
- Optional satellite tile layer (nice-to-have)

### Entry Point

Triggered from **Area Details Panel** via a "Start Walking" button, positioned above the fold near the mini-map section.

## Consequences

### Positive

- Zero setup friction - users tap a button and start walking
- Full UI control over boundary visualization
- Integrated experience within CityCells ecosystem
- Can add future enhancements (distance-to-boundary indicator, completion tracking)
- Works offline if map tiles are cached

### Negative

- No background tracking (browser limitation)
- iOS Safari users cannot use Screen Wake Lock
- Higher battery consumption than native apps
- Development effort required (vs. just exporting KML)

### Technical

- Requires new full-screen map component
- Need to handle geolocation permission flow
- Must gracefully handle permission denied / GPS unavailable
- Should persist walking session state for interruption recovery

### Maintainability

- Builds on existing Leaflet/React-Leaflet infrastructure
- Reuses tile layer configuration from main map
- Geolocation logic can be extracted to a reusable hook (`useGeolocationTracking`)
- Clear separation: walking mode is a distinct view, not modification of main map

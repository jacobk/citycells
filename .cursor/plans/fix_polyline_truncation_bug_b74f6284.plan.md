---
name: Fix Polyline Truncation Bug
overview: Fix the "Total Walk Length" bug caused by Strava's polyline truncation (privacy/anonymization zones). The polyline is missing ~350m of GPS data, causing the displayed walk length to be 1.70km instead of the actual 2.05km reported by Strava.
todos:
  - id: update-strava-interface
    content: Add `distance` field to StravaActivity interface in useStrava.ts
    status: completed
  - id: update-analysis-types
    content: Extend StravaMetadata interface to include `distance` in analysis.ts
    status: completed
  - id: update-calculate-efficiency
    content: Modify calculateEfficiency to accept and use optional stravaDistance parameter
    status: completed
  - id: update-analyze-walk
    content: Pass stravaMetadata.distance to calculateEfficiency in analyzeWalk function
    status: completed
  - id: update-map-component
    content: Include distance in stravaMetadata when processing activities in Map.tsx
    status: completed
  - id: add-test-case
    content: Add test verifying totalWalkLengthMeters uses Strava distance
    status: completed
  - id: update-docs
    content: Document the polyline truncation issue and fix in feature docs
    status: completed
  - id: todo-1770123324038-2hbvyemj8
    content: Update all affected ADRs and PRDs. We should document in details and assumptions based on strava on features and limitations. Create a separate ADR to explain everything we need to know about strava anonymization zones and how it affects the app
    status: completed
isProject: false
---

# Fix Strava Polyline Truncation Bug

## Problem

Strava's `summary_polyline` is truncated due to privacy/anonymization zones, typically removing 100-200m of GPS data at each end of the activity. This causes:

- **Total Walk Length** shows 1.70 km instead of the actual 2.05 km
- **Efficiency metric** is incorrectly calculated (denominator too small)
- User walked 2.05 km around a 2.06 km perimeter but UI shows 1.70 km

**Evidence from activity-17270700773:**

- Strava `distance` field: 2050.1m (correct)
- Polyline-calculated distance: 1696.8m (353m truncation)

## Solution

Use Strava's `distance` field (from raw GPS data) instead of calculating from the truncated polyline.

## Implementation

### 1. Update `StravaActivity` interface

Add `distance` field to [src/hooks/useStrava.ts](src/hooks/useStrava.ts):

```typescript
export interface StravaActivity {
  id: number;
  name: string;
  map: { summary_polyline: string; };
  start_latlng: [number, number];
  end_latlng?: [number, number];
  distance?: number; // NEW: Actual distance in meters from Strava
}
```

### 2. Update `StravaMetadata` interface and `analyzeWalk` function

In [src/lib/analysis.ts](src/lib/analysis.ts), extend `StravaMetadata` to include distance:

```typescript
export interface StravaMetadata {
  startLatLng?: [number, number];
  endLatLng?: [number, number];
  distance?: number; // Actual walk distance from Strava API
}
```

### 3. Update `calculateEfficiency` function

Modify to accept optional `stravaDistance` parameter:

```typescript
export function calculateEfficiency(
  walkLine: Feature<LineString>,
  areaPolygon: Feature<Polygon | MultiPolygon>,
  stravaDistance?: number // NEW: Use Strava's actual distance if provided
): { efficiency: number; borderAlignedMeters: number; totalWalkMeters: number }
```

- If `stravaDistance` is provided, use it for `totalWalkMeters`
- Keep polyline-based calculation for `borderAlignedMeters` (segments within buffer)

### 4. Update `analyzeWalk` to use Strava distance

Pass through `stravaMetadata.distance` to `calculateEfficiency`:

```typescript
const efficiencyResult = calculateEfficiency(
  walkLine, 
  areaPolygon, 
  stravaMetadata?.distance
);
```

### 5. Update Map.tsx to pass distance

In [src/components/Map/Map.tsx](src/components/Map/Map.tsx), include distance in stravaMetadata:

```typescript
const stravaMetadata: StravaMetadata | undefined = act.start_latlng && act.end_latlng
  ? { 
      startLatLng: act.start_latlng, 
      endLatLng: act.end_latlng,
      distance: act.distance // NEW
    }
  : undefined;
```

## Impact on Other Metrics

| Metric | Affected? | Fix Applied? | Notes |

|--------|-----------|--------------|-------|

| Total Walk Length | Yes | Yes | Use Strava `distance` |

| Efficiency | Yes | Yes | Use Strava `distance` as denominator |

| Perimeter Coverage | Partially | No | Missing polyline segments can't be reconstructed |

| Area Coverage | Partially | No | Already uses Strava metadata for loop detection |

| RMSE/Alignment | Minimally | No | Missing points are at walk edges, minimal impact |

| Loop Detection | Was affected | Already fixed | Uses Strava metadata |

## Files to Modify

1. [src/hooks/useStrava.ts](src/hooks/useStrava.ts) - Add `distance` field to interface
2. [src/lib/analysis.ts](src/lib/analysis.ts) - Update `StravaMetadata`, `calculateEfficiency`, and `analyzeWalk`
3. [src/components/Map/Map.tsx](src/components/Map/Map.tsx) - Pass distance in stravaMetadata

## Testing

Add test case to [src/__tests__/analysis/real-activity.test.ts](src/__tests__/analysis/real-activity.test.ts) to verify:

- `totalWalkLengthMeters` equals Strava's distance (2050.1m for activity-17270700773)
- Efficiency is calculated using Strava's distance
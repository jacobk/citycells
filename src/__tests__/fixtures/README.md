# Test Fixtures

This directory contains test fixtures for the analysis engine tests.

## Structure

```
fixtures/
├── activities/           # Real Strava activity data (JSON)
│   ├── walk-001.json     # First test walk
│   └── ...
├── areas/                # Sub-area GeoJSON extracts
│   └── test-area.json
└── README.md             # This file
```

## How to Add a New Activity Fixture

### Option 1: Use the Export API (Recommended)

1. Start the dev server: `npm run dev`
2. Log in with Strava
3. Visit: `http://localhost:3000/api/activities/export`
   - Lists all matching activities
4. Export a specific activity: `http://localhost:3000/api/activities/export?id=ACTIVITY_ID`
5. Save the JSON to `fixtures/activities/`
6. Fill in the `expected` values after manual review

### Option 2: Browser Console

1. Open the app in your browser with DevTools open
2. In the Console, run:
   ```javascript
   // Get activity data from the map
   const activities = window.__CITYCELLS_DEBUG?.activities;
   console.log(JSON.stringify(activities, null, 2));
   ```

## Activity Fixture Format

```json
{
  "id": 123456789,
  "name": "Evening Walk #malmödelområde",
  "polyline": "encoded_polyline_string",
  "coordinates": [
    [13.0, 55.6],  // [longitude, latitude]
    ...
  ],
  "distance": 1234.5,
  "start_date": "2024-01-01T10:00:00Z",
  "start_latlng": [55.6, 13.0],
  "end_latlng": [55.6001, 13.0001],
  
  "expected": {
    "matchedAreaId": 42,
    "matchedAreaName": "Västra Hamnen",
    "isClosedLoop": true,
    "loopGapMeters": 45.2,
    "perimeterCoverage": 0.85,
    "areaCoverage": 0.72,
    "alignmentScore": 0.80,
    "efficiency": 0.75,
    "qualityScore": 0.78,
    "tier": "silver"
  }
}
```

## Updating Expected Values

After running tests with visualizations enabled, review the generated SVGs
in `src/__tests__/output/` to verify the expected values are correct.

## Area Fixtures

Extract area polygons from the main GeoJSON file:

```javascript
// In browser console on the app:
const feature = geoData.features.find(f => f.properties?.delomr === 'Area Name');
console.log(JSON.stringify(feature, null, 2));
```

Or use the GeoJSON file directly in tests.

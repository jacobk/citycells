# Test Fixtures

This directory contains test fixtures for the analysis engine tests.
All fixtures are real Strava activity data and GeoJSON area polygons from Malmö.

## Structure

```
fixtures/
├── activities/                          # Real Strava activity data (JSON)
│   ├── activity-17259240639.json        # Johanneslust
│   ├── activity-17270700773.json        # Håkanstorp
│   ├── activity-17282448985.json        # Emilstorp
│   ├── activity-17307746665.json        # Malmöhus
│   ├── activity-17308205375.json        # Rådmansvången
│   ├── activity-17313729488.json        # Kronprinsen
│   ├── activity-17313893053.json        # Hästhagen
│   ├── activity-17314063662.json        # Fågelbacken
│   ├── activity-17319372012.json        # Videdal
│   ├── activity-17382890625.json        # Ellstorp
│   └── activity-17383157001.json        # Katrinelund
├── areas/                               # Sub-area GeoJSON polygons
│   ├── ellstorp.json
│   ├── emilstorp.json
│   ├── fagelbacken.json
│   ├── hakanstorp.json
│   ├── hasthagen.json
│   ├── johanneslust.json
│   ├── katrinelund.json
│   ├── kronprinsen.json
│   ├── malmohus.json
│   ├── radmansvangen.json
│   └── videdal.json
└── README.md                            # This file
```

## How to Add New Activity Fixtures

### Option 1: Bulk Export Script (Recommended)

Exports all `#malmödelområde` activities with streams and matching area polygons:

```bash
STRAVA_ACCESS_TOKEN=xxx node scripts/export-all-fixtures.mjs
```

This will:
- Fetch all matching activities from the Strava API
- Fetch high-fidelity GPS streams for each activity
- Save activity fixtures to `fixtures/activities/activity-{id}.json`
- Extract matching area polygons to `fixtures/areas/{name}.json`
- Skip activities that already have fixture files (use `--force` to overwrite)

Options:
- `--force` — overwrite existing fixtures
- `--skip-streams` — skip stream fetching (faster, polyline-only)

To get a token, start the dev server, log in, and visit `/streams-export`.

### Option 2: Export API (Single Activity)

1. Start the dev server: `npm run dev`
2. Log in with Strava
3. Visit: `http://localhost:3000/api/activities/export`
4. Export a specific activity: `http://localhost:3000/api/activities/export?id=ACTIVITY_ID`
5. Save the JSON to `fixtures/activities/`
6. Add streams: `STRAVA_ACCESS_TOKEN=xxx node scripts/export-activity-streams.mjs ACTIVITY_ID`

## Activity Fixture Format

```json
{
  "id": 123456789,
  "name": "Evening Walk #malmödelområde",
  "description": "",
  "type": "Walk",
  "sport_type": "Walk",
  "start_date": "2026-02-03T11:32:21Z",
  "distance": 1234.5,
  "moving_time": 600,
  "elapsed_time": 600,
  "polyline": "encoded_polyline_string",
  "coordinates": [
    [13.0, 55.6]
  ],
  "start_latlng": [55.6, 13.0],
  "end_latlng": [55.6001, 13.0001],
  "streams": {
    "latlng": { "type": "latlng", "data": [[55.6, 13.0]], "series_type": "distance", "original_size": 100, "resolution": "high" },
    "time": { "type": "time", "data": [0], "series_type": "distance", "original_size": 100, "resolution": "high" },
    "distance": { "type": "distance", "data": [0], "series_type": "distance", "original_size": 100, "resolution": "high" }
  },
  "streamCoordinates": [
    [13.0, 55.6]
  ],
  "expected": {
    "matchedAreaId": null,
    "matchedAreaName": null,
    "isClosedLoop": null,
    "loopGapMeters": null,
    "perimeterCoverage": null,
    "areaCoverage": null,
    "alignmentScore": null,
    "efficiency": null,
    "qualityScore": null,
    "tier": null
  }
}
```

Key coordinate conventions:
- `coordinates` / `streamCoordinates`: `[lng, lat]` (GeoJSON convention)
- `start_latlng` / `end_latlng`: `[lat, lng]` (Strava API convention)
- `streams.latlng.data`: `[lat, lng]` (Strava API convention)

## Area Fixture Format

Standard GeoJSON `Feature<Polygon>` extracted from `public/data/malmo_delomraden.geojson`:

```json
{
  "type": "Feature",
  "id": 43,
  "geometry": {
    "type": "Polygon",
    "coordinates": [[[13.037, 55.595], ...]]
  },
  "properties": {
    "FID": 43,
    "gid": 44,
    "delomr": "HÅKANSTORP",
    "do_kod": 11433,
    "url_koll": "https://..."
  }
}
```

Area filename convention: lowercase, Swedish characters transliterated
(e.g., `HÅKANSTORP` → `hakanstorp.json`, `RÅDMANSVÅNGEN` → `radmansvangen.json`).

## Updating Expected Values

After running tests with visualizations enabled, review the generated SVGs
in `src/__tests__/output/` to verify the expected values are correct.

## Current Test Results (2026-02-13)

| Activity | Tier | Quality | Perimeter | Area | Alignment | Efficiency |
|---|---|---|---|---|---|---|
| Håkanstorp | platinum | 96.7% | 100.0% | 98.1% | 85.8% | 100.0% |
| Fågelbacken | gold | 94.8% | 100.0% | 94.5% | 80.7% | 100.0% |
| Hästhagen | gold | 93.5% | 100.0% | 93.1% | 76.1% | 100.0% |
| Rådmansvången | gold | 93.4% | 99.3% | 94.6% | 75.1% | 100.0% |
| Kronprinsen | gold | 89.4% | 94.4% | 88.6% | 74.6% | 97.4% |
| Malmöhus | gold | 88.9% | 97.2% | 91.9% | 63.1% | 96.2% |
| Johanneslust | silver | 78.7% | 84.5% | 89.7% | 50.0% | 83.4% |
| Emilstorp | silver | 77.2% | 84.7% | 86.8% | 48.2% | 79.6% |
| Katrinelund | silver | 73.1% | 90.5% | 81.9% | 20.8% | 81.7% |
| Videdal | bronze | 67.8% | 67.0% | 91.4% | 39.5% | 68.5% |
| Ellstorp | none | 37.7% | 43.2% | 49.5% | 0.0% | 53.8% |

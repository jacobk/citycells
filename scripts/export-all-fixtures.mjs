/**
 * Bulk Export Script: Activity Fixtures + Area Polygons
 *
 * Fetches all #malmödelområde activities from Strava, including high-fidelity
 * streams, and saves them as test fixtures. Also extracts matching area polygons
 * from the GeoJSON dataset.
 *
 * Usage:
 *   STRAVA_ACCESS_TOKEN=xxx node scripts/export-all-fixtures.mjs
 *
 * Or with refresh credentials in .env.local:
 *   node scripts/export-all-fixtures.mjs
 *
 * Options:
 *   --force    Overwrite existing fixture files
 *   --skip-streams  Skip fetching streams (faster, polyline-only)
 *
 * WHY: Combines the two-step export flow (base data + streams) into a single
 * operation. See ADR 006 for why streams are preferred over summary polylines.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const polyline = require('@mapbox/polyline');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const FIXTURES_DIR = path.join(repoRoot, 'src', '__tests__', 'fixtures');
const ACTIVITIES_DIR = path.join(FIXTURES_DIR, 'activities');
const AREAS_DIR = path.join(FIXTURES_DIR, 'areas');
const GEOJSON_PATH = path.join(repoRoot, 'public', 'data', 'malmo_delomraden.geojson');

const KEYWORD = '#malmödelområde';
const STREAM_DELAY_MS = 1000; // Be kind to Strava rate limits

// ============================================
// Auth
// ============================================

function getEnv(name) {
  return process.env[name]?.trim();
}

async function loadEnvLocal() {
  try {
    const envPath = path.join(repoRoot, '.env.local');
    const content = await fs.readFile(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx);
      const value = trimmed.slice(eqIdx + 1);
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // .env.local may not exist
  }
}

async function refreshAccessToken() {
  const clientId = getEnv('STRAVA_CLIENT_ID');
  const clientSecret = getEnv('STRAVA_CLIENT_SECRET');
  const refreshToken = getEnv('STRAVA_REFRESH_TOKEN');

  if (!clientId || !clientSecret || !refreshToken) {
    return null;
  }

  console.log('Refreshing access token...');
  const response = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to refresh token: ${response.status}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function getAccessToken() {
  let token = getEnv('STRAVA_ACCESS_TOKEN');
  if (token) return token;

  await loadEnvLocal();
  token = await refreshAccessToken();
  if (token) return token;

  throw new Error(
    'Missing STRAVA_ACCESS_TOKEN env var (or STRAVA_CLIENT_ID + STRAVA_CLIENT_SECRET + STRAVA_REFRESH_TOKEN for auto-refresh)'
  );
}

// ============================================
// Strava API
// ============================================

async function fetchActivities(accessToken) {
  console.log('Fetching activities from Strava...');
  const response = await fetch(
    'https://www.strava.com/api/v3/athlete/activities?per_page=200',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch activities: ${response.status}`);
  }

  const activities = await response.json();

  // Filter by keyword
  const filtered = activities.filter((a) => {
    const text = `${a.name || ''} ${a.description || ''}`.toLowerCase();
    return text.includes(KEYWORD);
  });

  console.log(`Found ${filtered.length} activities matching "${KEYWORD}" (out of ${activities.length} total)`);
  return filtered;
}

// WHY: Keeping this function for potential future use in detailed activity exports
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function fetchActivityDetail(activityId, accessToken) {
  const response = await fetch(
    `https://www.strava.com/api/v3/activities/${activityId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch activity ${activityId}: ${response.status}`);
  }

  return response.json();
}

async function fetchStreams(activityId, accessToken) {
  const url = new URL(`https://www.strava.com/api/v3/activities/${activityId}/streams`);
  url.searchParams.set('keys', 'latlng,time,distance');
  url.searchParams.set('key_by_type', 'true');
  url.searchParams.set('resolution', 'high');
  url.searchParams.set('series_type', 'distance');

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch streams for ${activityId}: ${response.status}`);
  }

  return response.json();
}

// ============================================
// GeoJSON Area Matching
// ============================================

async function loadGeoJSON() {
  const raw = await fs.readFile(GEOJSON_PATH, 'utf8');
  return JSON.parse(raw);
}

function matchActivityToArea(activityName, geoData) {
  // Extract area name from activity name (before #malmödelområde)
  const areaName = activityName.split('#')[0].trim().toUpperCase();

  for (const feature of geoData.features) {
    if (feature.properties.delomr === areaName) {
      return feature;
    }
  }

  return null;
}

// ============================================
// Fixture Building
// ============================================

function buildActivityFixture(activity, streams) {
  // Decode polyline to [lng, lat] coordinates (GeoJSON convention)
  let coordinates = [];
  if (activity.map?.summary_polyline) {
    const decoded = polyline.decode(activity.map.summary_polyline);
    coordinates = decoded.map(([lat, lng]) => [lng, lat]);
  }

  // Convert stream latlng to [lng, lat] (GeoJSON convention)
  let streamCoordinates = [];
  if (streams?.latlng?.data) {
    streamCoordinates = streams.latlng.data.map(([lat, lng]) => [lng, lat]);
  }

  const fixture = {
    id: activity.id,
    name: activity.name,
    description: activity.description || '',
    type: activity.type,
    sport_type: activity.sport_type,
    start_date: activity.start_date,
    distance: activity.distance,
    moving_time: activity.moving_time,
    elapsed_time: activity.elapsed_time,
    polyline: activity.map?.summary_polyline || '',
    coordinates,
    start_latlng: activity.start_latlng,
    end_latlng: activity.end_latlng,
    expected: {
      matchedAreaId: null,
      matchedAreaName: null,
      isClosedLoop: null,
      loopGapMeters: null,
      perimeterCoverage: null,
      areaCoverage: null,
      alignmentScore: null,
      efficiency: null,
      qualityScore: null,
      tier: null,
    },
    _exportedAt: new Date().toISOString(),
    _note: 'Fill in expected values manually after analyzing the walk',
  };

  if (streams) {
    fixture.streams = streams;
    fixture.streamCoordinates = streamCoordinates;
    fixture._streamsExportedAt = new Date().toISOString();
  }

  return fixture;
}

function buildAreaFixture(feature) {
  // Return the GeoJSON Feature as-is (same format as hakanstorp.json)
  return {
    type: 'Feature',
    id: feature.id,
    geometry: feature.geometry,
    properties: feature.properties,
  };
}

function areaNameToFilename(areaName) {
  // Convert "HÅKANSTORP" -> "hakanstorp", "RÅDMANSVÅNGEN" -> "radmansvangen"
  // WHY: Filesystem-safe lowercase names, matching existing convention (hakanstorp.json)
  return areaName
    .toLowerCase()
    .replace(/å/g, 'a')
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/é/g, 'e')
    .replace(/ü/g, 'u');
}

// ============================================
// Main
// ============================================

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const skipStreams = args.includes('--skip-streams');

  // Ensure output directories exist
  await fs.mkdir(ACTIVITIES_DIR, { recursive: true });
  await fs.mkdir(AREAS_DIR, { recursive: true });

  const accessToken = await getAccessToken();
  const geoData = await loadGeoJSON();
  const activities = await fetchActivities(accessToken);

  let exported = 0;
  let skipped = 0;
  let areaExported = 0;
  const unmatchedAreas = [];

  for (const activity of activities) {
    const activityPath = path.join(ACTIVITIES_DIR, `activity-${activity.id}.json`);

    // Check if fixture already exists
    if (!force) {
      try {
        await fs.access(activityPath);
        console.log(`  SKIP  ${activity.id}  ${activity.name} (fixture exists, use --force to overwrite)`);
        skipped++;

        // Still extract the area polygon even for skipped activities
        const areaFeature = matchActivityToArea(activity.name, geoData);
        if (areaFeature) {
          const areaFilename = areaNameToFilename(areaFeature.properties.delomr);
          const areaPath = path.join(AREAS_DIR, `${areaFilename}.json`);
          try {
            await fs.access(areaPath);
          } catch {
            const areaFixture = buildAreaFixture(areaFeature);
            await fs.writeFile(areaPath, JSON.stringify(areaFixture));
            console.log(`  AREA  ${areaFeature.properties.delomr} → ${areaFilename}.json`);
            areaExported++;
          }
        }
        continue;
      } catch {
        // File doesn't exist, proceed with export
      }
    }

    console.log(`  FETCH ${activity.id}  ${activity.name}`);

    // Fetch streams (unless --skip-streams)
    let streams = null;
    if (!skipStreams) {
      try {
        streams = await fetchStreams(activity.id, accessToken);
        const pointCount = streams?.latlng?.data?.length || 0;
        console.log(`        streams: ${pointCount} GPS points`);
      } catch (err) {
        console.warn(`        streams FAILED: ${err.message}`);
      }

      // Rate limit delay
      if (activities.indexOf(activity) < activities.length - 1) {
        await new Promise((r) => setTimeout(r, STREAM_DELAY_MS));
      }
    }

    // Build and save activity fixture
    const fixture = buildActivityFixture(activity, streams);
    await fs.writeFile(activityPath, JSON.stringify(fixture));
    console.log(`  SAVED activity-${activity.id}.json`);
    exported++;

    // Extract and save matching area polygon
    const areaFeature = matchActivityToArea(activity.name, geoData);
    if (areaFeature) {
      const areaFilename = areaNameToFilename(areaFeature.properties.delomr);
      const areaPath = path.join(AREAS_DIR, `${areaFilename}.json`);
      const areaFixture = buildAreaFixture(areaFeature);
      await fs.writeFile(areaPath, JSON.stringify(areaFixture));
      console.log(`  AREA  ${areaFeature.properties.delomr} → ${areaFilename}.json`);
      areaExported++;
    } else {
      const name = activity.name.split('#')[0].trim();
      unmatchedAreas.push({ id: activity.id, name });
      console.warn(`  WARN  No area match for "${name}"`);
    }
  }

  console.log('\n========================================');
  console.log(`Activities: ${exported} exported, ${skipped} skipped`);
  console.log(`Areas: ${areaExported} exported`);

  if (unmatchedAreas.length > 0) {
    console.log('\nUnmatched activities (need manual area assignment):');
    for (const a of unmatchedAreas) {
      console.log(`  ${a.id}  ${a.name}  https://www.strava.com/activities/${a.id}`);
    }
  }

  console.log('\nDone!');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

function getEnv(name) {
  return process.env[name]?.trim();
}

async function refreshAccessToken() {
  const clientId = getEnv('STRAVA_CLIENT_ID');
  const clientSecret = getEnv('STRAVA_CLIENT_SECRET');
  const refreshToken = getEnv('STRAVA_REFRESH_TOKEN');

  if (!clientId || !clientSecret || !refreshToken) {
    return null;
  }

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

async function updateFixture(activityId, streams) {
  const fixturePath = path.join(
    repoRoot,
    'src',
    '__tests__',
    'fixtures',
    'activities',
    `activity-${activityId}.json`
  );

  const raw = await fs.readFile(fixturePath, 'utf8');
  const fixture = JSON.parse(raw);

  const latlng = streams?.latlng?.data ?? [];
  const streamCoordinates = latlng.map(([lat, lng]) => [lng, lat]);

  fixture.streams = streams;
  fixture.streamCoordinates = streamCoordinates;
  fixture._streamsExportedAt = new Date().toISOString();

  await fs.writeFile(fixturePath, JSON.stringify(fixture));
}

async function main() {
  const activityIds = process.argv.slice(2);
  if (activityIds.length === 0) {
    console.error('Usage: node scripts/export-activity-streams.mjs <activityId> [activityId...]');
    process.exit(1);
  }

  let accessToken = getEnv('STRAVA_ACCESS_TOKEN');
  if (!accessToken) {
    accessToken = await refreshAccessToken();
  }

  if (!accessToken) {
    console.error('Missing STRAVA_ACCESS_TOKEN (or refresh credentials).');
    process.exit(1);
  }

  for (const activityId of activityIds) {
    const streams = await fetchStreams(activityId, accessToken);
    await updateFixture(activityId, streams);
    console.log(`Updated fixture for ${activityId}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

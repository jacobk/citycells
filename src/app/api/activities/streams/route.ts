/**
 * Fetch activity streams from Strava
 *
 * Returns high-fidelity GPS streams for a single activity.
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getStravaClient, refreshAccessToken } from '@/lib/strava';
import type { StravaStream, StravaStreamsResponse } from '@/lib/types/strava-streams';

function normalizeStreams(streams: unknown): StravaStreamsResponse {
  const normalized: StravaStreamsResponse = {};

  if (Array.isArray(streams)) {
    for (const stream of streams as StravaStream<unknown>[]) {
      if (stream?.type === 'latlng') {
        normalized.latlng = stream as StravaStream<[number, number]>;
      }
      if (stream?.type === 'time') {
        normalized.time = stream as StravaStream<number>;
      }
      if (stream?.type === 'distance') {
        normalized.distance = stream as StravaStream<number>;
      }
    }
    return normalized;
  }

  if (streams && typeof streams === 'object') {
    const entries = Object.values(streams as Record<string, StravaStream<unknown>>);
    for (const stream of entries) {
      if (stream?.type === 'latlng') {
        normalized.latlng = stream as StravaStream<[number, number]>;
      }
      if (stream?.type === 'time') {
        normalized.time = stream as StravaStream<number>;
      }
      if (stream?.type === 'distance') {
        normalized.distance = stream as StravaStream<number>;
      }
    }
  }

  return normalized;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const activityId = searchParams.get('id');

  if (!activityId) {
    return NextResponse.json({ error: 'Missing activity id' }, { status: 400 });
  }

  const cookieStore = await cookies();
  let accessToken = cookieStore.get('strava_access_token')?.value;
  const refreshToken = cookieStore.get('strava_refresh_token')?.value;
  const expiresAt = cookieStore.get('strava_expires_at')?.value;

  if (!refreshToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  if (!accessToken || (expiresAt && Date.now() > parseInt(expiresAt))) {
    try {
      const refreshed = await refreshAccessToken(refreshToken);
      accessToken = refreshed.access_token;
    } catch {
      return NextResponse.json({ error: 'Session expired' }, { status: 401 });
    }
  }

  const strava = getStravaClient(accessToken);

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const streams: any = await strava.streams.activity({
      id: parseInt(activityId),
      types: 'latlng,time,distance',
      resolution: 'high',
      series_type: 'distance',
    });

    const normalized = normalizeStreams(streams);

    return NextResponse.json({
      activityId: parseInt(activityId),
      streams: normalized,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error(`[API:streams] Failed to fetch activity streams for ${activityId}:`, error);
    return NextResponse.json({ error: 'Failed to fetch activity streams' }, { status: 500 });
  }
}

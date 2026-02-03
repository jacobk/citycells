/**
 * Export API for activity stream data
 *
 * Used to export high-fidelity streams as test fixtures.
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getStravaClient, refreshAccessToken } from '@/lib/strava';

type StreamType = 'latlng' | 'time' | 'distance';

interface StravaStream<T> {
  type: StreamType;
  data: T[];
  series_type: 'time' | 'distance';
  original_size: number;
  resolution: 'low' | 'medium' | 'high';
}

function normalizeStreams(streams: unknown): Record<StreamType, StravaStream<unknown> | undefined> {
  const normalized: Record<StreamType, StravaStream<unknown> | undefined> = {
    latlng: undefined,
    time: undefined,
    distance: undefined,
  };

  if (Array.isArray(streams)) {
    for (const stream of streams as StravaStream<unknown>[]) {
      if (stream?.type && stream.type in normalized) {
        normalized[stream.type] = stream;
      }
    }
    return normalized;
  }

  if (streams && typeof streams === 'object') {
    const entries = Object.values(streams as Record<string, StravaStream<unknown>>);
    for (const stream of entries) {
      if (stream?.type && stream.type in normalized) {
        normalized[stream.type] = stream;
      }
    }
  }

  return normalized;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const activityId = searchParams.get('id');

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
  const KEYWORD = '#malmödelområde';

  try {
    if (activityId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const activity: any = await strava.activities.get({ id: parseInt(activityId) });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const streams: any = await strava.streams.activity({
        id: parseInt(activityId),
        types: 'latlng,time,distance',
        resolution: 'high',
        series_type: 'distance',
      });

      const normalized = normalizeStreams(streams);
      const latlngStream = normalized.latlng as StravaStream<[number, number]> | undefined;
      const timeStream = normalized.time as StravaStream<number> | undefined;
      const distanceStream = normalized.distance as StravaStream<number> | undefined;

      const streamCoordinates = latlngStream?.data
        ? latlngStream.data.map(([lat, lng]) => [lng, lat])
        : [];

      const exportData = {
        id: activity.id,
        name: activity.name,
        streams: {
          latlng: latlngStream ?? null,
          time: timeStream ?? null,
          distance: distanceStream ?? null,
        },
        streamCoordinates,
        _exportedAt: new Date().toISOString(),
      };

      return NextResponse.json(exportData, {
        headers: {
          'Content-Disposition': `attachment; filename="activity-${activity.id}-streams.json"`,
        },
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const activities: any[] = await strava.athlete.listActivities({ per_page: 200 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filtered = activities.filter((act: any) =>
      (act.name && act.name.toLowerCase().includes(KEYWORD)) ||
      (act.description && act.description?.toLowerCase().includes(KEYWORD))
    );

    return NextResponse.json({
      message: 'Add ?id=ACTIVITY_ID to export streams for a specific activity',
      count: filtered.length,
      activities: filtered.map(a => ({
        id: a.id,
        name: a.name,
        date: a.start_date,
        distance: a.distance,
      })),
    });
  } catch (error) {
    console.error('Failed to export activity streams', error);
    return NextResponse.json({ error: 'Failed to export activity streams' }, { status: 500 });
  }
}

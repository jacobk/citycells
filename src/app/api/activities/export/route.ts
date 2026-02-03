/**
 * Export API for activity data
 * 
 * Used to export activity data as test fixtures with decoded polylines.
 * WHY: We need real activity data to test the analysis engine
 * and ensure no regressions when improving the matching logic.
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getStravaClient, refreshAccessToken } from '@/lib/strava';
import mapboxPolyline from '@mapbox/polyline';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const activityId = searchParams.get('id');
  const all = searchParams.get('all') === 'true';

  const cookieStore = await cookies();
  let accessToken = cookieStore.get('strava_access_token')?.value;
  const refreshToken = cookieStore.get('strava_refresh_token')?.value;
  const expiresAt = cookieStore.get('strava_expires_at')?.value;

  if (!refreshToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Check if token needs refresh
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
      // Fetch single activity with detailed streams if available
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const activity: any = await strava.activities.get({ id: parseInt(activityId) });
      
      // Decode the polyline for easier testing
      let coordinates: [number, number][] = [];
      if (activity.map?.summary_polyline) {
        // mapbox polyline returns [lat, lng], we need [lng, lat] for GeoJSON
        const decoded = mapboxPolyline.decode(activity.map.summary_polyline);
        coordinates = decoded.map(([lat, lng]) => [lng, lat]);
      }

      const exportData = {
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
        coordinates, // Pre-decoded for test convenience
        start_latlng: activity.start_latlng,
        end_latlng: activity.end_latlng,
        // Expected values to be filled in manually after review
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

      return NextResponse.json(exportData, {
        headers: {
          'Content-Disposition': `attachment; filename="activity-${activity.id}.json"`,
        },
      });
    }

    if (all) {
      // Export all matching activities
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const activities: any[] = await strava.athlete.listActivities({ per_page: 200 });
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const filtered = activities.filter((act: any) => 
        (act.name && act.name.toLowerCase().includes(KEYWORD)) ||
        (act.description && act.description?.toLowerCase().includes(KEYWORD))
      );

      const exports = filtered.map(activity => {
        let coordinates: [number, number][] = [];
        if (activity.map?.summary_polyline) {
          const decoded = mapboxPolyline.decode(activity.map.summary_polyline);
          coordinates = decoded.map(([lat, lng]: [number, number]) => [lng, lat]);
        }

        return {
          id: activity.id,
          name: activity.name,
          description: activity.description || '',
          type: activity.type,
          sport_type: activity.sport_type,
          start_date: activity.start_date,
          distance: activity.distance,
          moving_time: activity.moving_time,
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
        };
      });

      return NextResponse.json({
        count: exports.length,
        activities: exports,
        _exportedAt: new Date().toISOString(),
      });
    }

    // List available activities
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const activities: any[] = await strava.athlete.listActivities({ per_page: 200 });
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filtered = activities.filter((act: any) => 
      (act.name && act.name.toLowerCase().includes(KEYWORD)) ||
      (act.description && act.description?.toLowerCase().includes(KEYWORD))
    );

    return NextResponse.json({
      message: 'Add ?id=ACTIVITY_ID to export a specific activity or ?all=true to export all',
      count: filtered.length,
      activities: filtered.map(a => ({
        id: a.id,
        name: a.name,
        date: a.start_date,
        distance: a.distance,
      })),
    });
  } catch (error) {
    console.error('Failed to export activity', error);
    return NextResponse.json({ error: 'Failed to export activity' }, { status: 500 });
  }
}

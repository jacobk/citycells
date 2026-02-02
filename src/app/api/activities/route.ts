import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getStravaClient, refreshAccessToken } from '@/lib/strava';

export async function GET() {
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
      const newExpiresAt = Date.now() + (refreshed.expires_in * 1000);

      // Update cookies
      cookieStore.set('strava_access_token', refreshed.access_token, { 
        httpOnly: true, 
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: refreshed.expires_in
      });
      cookieStore.set('strava_refresh_token', refreshed.refresh_token, { 
        httpOnly: true, 
        secure: process.env.NODE_ENV === 'production',
        path: '/'
      });
      cookieStore.set('strava_expires_at', newExpiresAt.toString(), { 
        httpOnly: true, 
        secure: process.env.NODE_ENV === 'production',
        path: '/'
      });
    } catch {
      return NextResponse.json({ error: 'Session expired' }, { status: 401 });
    }
  }

  const strava = getStravaClient(accessToken);
  
  try {
    // Fetch user activities
    // 200 items should be enough for MVP history
    const activities = await strava.athlete.listActivities({ per_page: 200 });
    
    // Filter by keyword
    const KEYWORD = '#malmödelområde';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filtered = activities.filter((act: any) => 
      (act.name && act.name.toLowerCase().includes(KEYWORD)) ||
      (act.description && act.description.toLowerCase().includes(KEYWORD))
    );

    return NextResponse.json(filtered);
  } catch (error) {
    console.error('Failed to fetch activities', error);
    return NextResponse.json({ error: 'Failed to fetch activities' }, { status: 500 });
  }
}

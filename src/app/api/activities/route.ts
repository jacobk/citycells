import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getStravaClient, getValidAccessToken } from '@/lib/strava';

/**
 * GET /api/activities
 * 
 * Fetches Strava activities for the authenticated user.
 * WHY: Uses getValidAccessToken() for automatic token refresh (ADR 013).
 */
export async function GET() {
  const cookieStore = await cookies();
  
  // WHY: Use centralized token validation with automatic refresh
  const tokenResult = await getValidAccessToken({
    accessToken: cookieStore.get('strava_access_token')?.value,
    refreshToken: cookieStore.get('strava_refresh_token')?.value,
    expiresAt: cookieStore.get('strava_expires_at')?.value,
  });

  if (!tokenResult) {
    // WHY: Token validation failed - user must re-authenticate
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // WHY: If tokens were refreshed, update cookies for future requests
  if (tokenResult.refreshed && tokenResult.newTokens) {
    const newExpiresAt = Date.now() + (tokenResult.newTokens.expires_in * 1000);

    cookieStore.set('strava_access_token', tokenResult.newTokens.access_token, { 
      httpOnly: true, 
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: tokenResult.newTokens.expires_in
    });
    cookieStore.set('strava_refresh_token', tokenResult.newTokens.refresh_token, { 
      httpOnly: true, 
      secure: process.env.NODE_ENV === 'production',
      path: '/'
    });
    cookieStore.set('strava_expires_at', newExpiresAt.toString(), { 
      httpOnly: true, 
      secure: process.env.NODE_ENV === 'production',
      path: '/'
    });
  }

  const strava = getStravaClient(tokenResult.accessToken);
  
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

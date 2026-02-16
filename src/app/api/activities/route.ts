import { NextResponse, NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { getStravaClient, getValidAccessToken } from '@/lib/strava';

/**
 * GET /api/activities
 * 
 * Fetches Strava activities for the authenticated user.
 * WHY: Uses getValidAccessToken() for automatic token refresh (ADR 013).
 * 
 * Query parameters:
 * - after: Unix epoch timestamp (seconds) to only fetch activities after this time
 *          Used for incremental sync (TICKET-016)
 * 
 * @example GET /api/activities?after=1707955200
 */
export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  
  // WHY: Read 'after' query param for incremental sync (TICKET-016)
  // Strava API accepts 'after' as epoch timestamp in seconds
  const { searchParams } = new URL(request.url);
  const afterParam = searchParams.get('after');
  const afterTimestamp = afterParam ? parseInt(afterParam, 10) : undefined;
  
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
    // WHY: Build params object for Strava API
    // 'after' parameter enables incremental sync - only fetches activities after the given timestamp
    // See ADR 004 "Incremental Activity Sync" section for rationale (TICKET-016)
    const params: { per_page: number; after?: number } = { per_page: 200 };
    if (afterTimestamp && !isNaN(afterTimestamp)) {
      params.after = afterTimestamp;
      console.log(`[API] Fetching activities after ${new Date(afterTimestamp * 1000).toISOString()}`);
    }
    
    // Fetch user activities
    // 200 items should be enough for MVP history (or incremental batch)
    const activities = await strava.athlete.listActivities(params);
    
    // Filter by keyword
    const KEYWORD = '#malmödelområde';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filtered = activities.filter((act: any) => 
      (act.name && act.name.toLowerCase().includes(KEYWORD)) ||
      (act.description && act.description.toLowerCase().includes(KEYWORD))
    );

    // WHY: Log for debugging incremental sync behavior
    if (afterTimestamp) {
      console.log(`[API] Incremental sync: ${activities.length} total activities, ${filtered.length} matching keyword`);
    }

    return NextResponse.json(filtered);
  } catch (error) {
    console.error('Failed to fetch activities:', error);
    
    // WHY: Provide more useful error info for debugging
    // Strava API errors often include statusCode and message
    const stravaError = error as { statusCode?: number; message?: string; error?: string };
    
    if (stravaError.statusCode === 429) {
      return NextResponse.json({ 
        error: 'Strava rate limit exceeded. Please wait 15 minutes.' 
      }, { status: 429 });
    }
    
    if (stravaError.statusCode === 401) {
      return NextResponse.json({ 
        error: 'Strava authentication expired. Please re-login.' 
      }, { status: 401 });
    }
    
    return NextResponse.json({ 
      error: stravaError.message || 'Failed to fetch activities' 
    }, { status: stravaError.statusCode || 500 });
  }
}

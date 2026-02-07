import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { refreshAccessToken, stravaConfig } from '@/lib/strava';

/**
 * POST /api/auth/restore-session
 * 
 * Restores a user session using a refresh token stored in SQLite.
 * WHY: Enables persistent authentication across browser sessions.
 * The client sends the refresh_token from SQLite, and this endpoint:
 * 1. Refreshes tokens with Strava
 * 2. Sets new HTTP-only cookies
 * 3. Returns new token data for SQLite update
 * 
 * See ADR 013 "Returning User Flow" for the full flow.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { refresh_token, athlete_id } = body;

    if (!refresh_token || !athlete_id) {
      return NextResponse.json(
        { error: 'Missing refresh_token or athlete_id' },
        { status: 400 }
      );
    }

    // WHY: Validate that this is a legitimate refresh attempt
    // by checking that client_id matches our app
    if (!stravaConfig.client_id || !stravaConfig.client_secret) {
      console.error('[restore-session] Missing Strava credentials');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Attempt to refresh the token with Strava
    let refreshed;
    try {
      refreshed = await refreshAccessToken(refresh_token);
    } catch (err) {
      // WHY: If refresh fails, the token is likely revoked or expired
      // Client should clear SQLite tokens and prompt re-authentication
      console.error('[restore-session] Token refresh failed:', err);
      return NextResponse.json(
        { error: 'Token refresh failed', should_clear_tokens: true },
        { status: 401 }
      );
    }

    // Calculate expiration timestamp
    const expiresAt = Date.now() + (refreshed.expires_in * 1000);
    // WHY: Store as Unix timestamp in seconds for consistency with Strava API
    const tokenExpiresAtSeconds = Math.floor(expiresAt / 1000);

    // Set HTTP-only cookies for API route authentication
    const cookieStore = await cookies();
    
    // WHY: Access token cookie with same expiry as token
    cookieStore.set('strava_access_token', refreshed.access_token, { 
      httpOnly: true, 
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: refreshed.expires_in
    });

    // WHY: Refresh token stored for API route token refresh
    cookieStore.set('strava_refresh_token', refreshed.refresh_token, { 
      httpOnly: true, 
      secure: process.env.NODE_ENV === 'production',
      path: '/'
    });

    // WHY: Expiration tracking for proactive refresh
    cookieStore.set('strava_expires_at', expiresAt.toString(), { 
      httpOnly: true, 
      secure: process.env.NODE_ENV === 'production',
      path: '/'
    });

    // WHY: Session cookie (1 hour) with athlete ID for session tracking
    // This is the "session bridge" mentioned in ADR 013
    cookieStore.set('strava_session', athlete_id.toString(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 3600, // 1 hour per ADR 013
      sameSite: 'lax'
    });

    console.log(`[restore-session] Session restored for athlete ${athlete_id}`);

    // WHY: Return token data for client to update SQLite
    // This keeps SQLite in sync with the fresh tokens
    return NextResponse.json({
      success: true,
      tokens: {
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token,
        token_expires_at: tokenExpiresAtSeconds,
      }
    });

  } catch (err) {
    console.error('[restore-session] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

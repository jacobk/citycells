import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { refreshAccessToken, stravaConfig } from '@/lib/strava';
import { setAuthCookies, type AthleteInfo } from '@/lib/auth-cookies';

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

    // WHY: Store as Unix timestamp in seconds for consistency with Strava API
    const tokenExpiresAtSeconds = Math.floor((Date.now() + refreshed.expires_in * 1000) / 1000);

    // WHY: Fetch athlete profile from Strava to populate strava_athlete cookie
    // This was previously missing, causing useStrava hook to fail session restoration
    // See ADR 013 (2026-02-16 Update) and TICKET-019 for details
    let athleteInfo: AthleteInfo | undefined;
    try {
      const athleteResponse = await fetch('https://www.strava.com/api/v3/athlete', {
        headers: { Authorization: `Bearer ${refreshed.access_token}` },
      });

      if (athleteResponse.ok) {
        const athleteData = await athleteResponse.json();
        athleteInfo = {
          id: athleteData.id,
          firstname: athleteData.firstname,
          lastname: athleteData.lastname,
          profile: athleteData.profile,
        };
      } else {
        console.warn('[restore-session] Failed to fetch athlete profile:', athleteResponse.status);
      }
    } catch (err) {
      // WHY: Non-fatal - session can still work without athlete display info
      console.warn('[restore-session] Error fetching athlete profile:', err);
    }

    // WHY: Use centralized cookie helper to ensure consistent maxAge values
    // This sets all cookies including strava_athlete (previously missing in restore-session)
    // See ADR 013 (2026-02-16 Update) for cookie lifetime specifications
    const cookieStore = await cookies();
    await setAuthCookies(cookieStore, {
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token,
      expiresIn: refreshed.expires_in,
      athleteId: athlete_id,
      athlete: athleteInfo,
    });

    console.log(`[restore-session] Session restored for athlete ${athlete_id}${athleteInfo ? ` (${athleteInfo.firstname})` : ''}`);

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

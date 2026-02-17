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
 * 1. Refreshes tokens with Strava (1 API call)
 * 2. Uses cached athlete info if provided, or fetches from Strava (0-1 API calls)
 * 3. Sets new HTTP-only cookies
 * 4. Returns new token data for SQLite update
 * 
 * OPTIMIZATION (TICKET-024): If client sends cached_athlete, we skip the
 * Strava /api/v3/athlete API call. This reduces session restoration from
 * 2 API calls to 1.
 * 
 * See ADR 013 "Returning User Flow" and 2026-02-17 Update for the full flow.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { refresh_token, athlete_id, cached_athlete } = body;

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

    // WHY: TICKET-024 optimization - use cached athlete info if provided
    // This skips the Strava /api/v3/athlete API call (saves rate limit quota)
    let athleteInfo: AthleteInfo | undefined;
    let fetchedFreshAthlete = false;
    
    // Validate cached_athlete has all required fields
    const isCacheValid = cached_athlete && 
      typeof cached_athlete.firstname === 'string' &&
      typeof cached_athlete.lastname === 'string' &&
      typeof cached_athlete.profile === 'string';

    if (isCacheValid) {
      // WHY: Use cached athlete info from client's SQLite
      athleteInfo = {
        id: athlete_id,
        firstname: cached_athlete.firstname,
        lastname: cached_athlete.lastname,
        profile: cached_athlete.profile,
      };
      console.log(`[restore-session] Using cached athlete info for ${athlete_id} (${athleteInfo.firstname})`);
    } else {
      // WHY: Fetch athlete profile from Strava - cache was missing or invalid
      // See ADR 013 (2026-02-16 Update) and TICKET-019 for details
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
          fetchedFreshAthlete = true;
          console.log(`[restore-session] Fetched fresh athlete info for ${athlete_id} (${athleteInfo.firstname})`);
        } else {
          console.warn('[restore-session] Failed to fetch athlete profile:', athleteResponse.status);
        }
      } catch (err) {
        // WHY: Non-fatal - session can still work without athlete display info
        console.warn('[restore-session] Error fetching athlete profile:', err);
      }
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
    // If we fetched fresh athlete info, return it so client can cache (TICKET-024)
    const response: {
      success: boolean;
      tokens: {
        access_token: string;
        refresh_token: string;
        token_expires_at: number;
      };
      fetched_athlete?: {
        firstname: string;
        lastname: string;
        profile: string;
      };
    } = {
      success: true,
      tokens: {
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token,
        token_expires_at: tokenExpiresAtSeconds,
      }
    };

    // WHY: Only include fetched_athlete if we actually fetched fresh data
    // Client will cache this to avoid future API calls
    if (fetchedFreshAthlete && athleteInfo) {
      response.fetched_athlete = {
        firstname: athleteInfo.firstname,
        lastname: athleteInfo.lastname,
        profile: athleteInfo.profile,
      };
    }

    return NextResponse.json(response);

  } catch (err) {
    console.error('[restore-session] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

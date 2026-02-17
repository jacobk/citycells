import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import strava from 'strava-v3';
// Import to ensure config is applied
import '@/lib/strava';
import { getPublicUrl } from '@/lib/requestOrigin';
import { setAuthCookies } from '@/lib/auth-cookies';

/**
 * GET /api/auth/callback
 *
 * Handles OAuth callback from Strava.
 * WHY: Exchanges authorization code for tokens and sets up session.
 * See ADR 013 for the token storage strategy.
 * WHY: Redirects use getPublicUrl() so behind ngrok/proxies we send the user
 * back to the public host (e.g. https://xyz.ngrok.io), not request.url (localhost).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error || !code) {
    return NextResponse.redirect(getPublicUrl(request, '/?error=auth_failed'));
  }

  try {
    const payload = await strava.oauth.getToken(code);
    
    // WHY: Store as Unix timestamp in seconds for consistency with Strava API
    const tokenExpiresAtSeconds = Math.floor((Date.now() + payload.expires_in * 1000) / 1000);

    // WHY: Use centralized cookie helper to ensure consistent maxAge values
    // See ADR 013 (2026-02-16 Update) for cookie lifetime specifications
    const cookieStore = await cookies();
    await setAuthCookies(cookieStore, {
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token,
      expiresIn: payload.expires_in,
      athleteId: payload.athlete.id,
      athlete: {
        id: payload.athlete.id,
        firstname: payload.athlete.firstname,
        lastname: payload.athlete.lastname,
        profile: payload.athlete.profile,
      },
    });

    // WHY: Pass token data via URL params for client to store in SQLite (ADR 013)
    // These are short-lived in the URL but allow client to persist tokens immediately
    // The tokens are also in HTTP-only cookies for API routes
    const redirectUrl = getPublicUrl(request, '/');
    redirectUrl.searchParams.set('auth', 'success');
    redirectUrl.searchParams.set('athlete_id', payload.athlete.id.toString());
    redirectUrl.searchParams.set('access_token', payload.access_token);
    redirectUrl.searchParams.set('refresh_token', payload.refresh_token);
    redirectUrl.searchParams.set('token_expires_at', tokenExpiresAtSeconds.toString());
    
    // WHY: Pass athlete info for client to cache in SQLite (TICKET-024)
    // This enables session restoration without an extra Strava API call
    // See ADR 013 (2026-02-17 Update) for rationale
    redirectUrl.searchParams.set('firstname', payload.athlete.firstname);
    redirectUrl.searchParams.set('lastname', payload.athlete.lastname);
    redirectUrl.searchParams.set('profile', payload.athlete.profile);

    return NextResponse.redirect(redirectUrl);
  } catch (err) {
    console.error('Strava Auth Error:', err);
    return NextResponse.redirect(getPublicUrl(request, '/?error=token_exchange_failed'));
  }
}

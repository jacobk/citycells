import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import strava from 'strava-v3';
// Import to ensure config is applied
import '@/lib/strava';
import { getPublicUrl } from '@/lib/requestOrigin';

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
    
    // Calculate expiration
    const expiresAt = Date.now() + (payload.expires_in * 1000);
    // WHY: Store as Unix timestamp in seconds for consistency with Strava API
    const tokenExpiresAtSeconds = Math.floor(expiresAt / 1000);

    // Store in HTTP-only cookies
    const cookieStore = await cookies();
    
    cookieStore.set('strava_access_token', payload.access_token, { 
      httpOnly: true, 
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: payload.expires_in
    });

    cookieStore.set('strava_refresh_token', payload.refresh_token, { 
      httpOnly: true, 
      secure: process.env.NODE_ENV === 'production',
      path: '/'
    });

    cookieStore.set('strava_expires_at', expiresAt.toString(), { 
      httpOnly: true, 
      secure: process.env.NODE_ENV === 'production',
      path: '/'
    });

    // WHY: Session cookie (1 hour) with athlete ID for session tracking (ADR 013)
    // This is the "session bridge" - short-lived for security, SQLite has full tokens
    cookieStore.set('strava_session', payload.athlete.id.toString(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 3600, // 1 hour per ADR 013
      sameSite: 'lax'
    });
    
    // Store basic athlete info visible to client (not httpOnly)
    cookieStore.set('strava_athlete', JSON.stringify({
      id: payload.athlete.id,
      firstname: payload.athlete.firstname,
      lastname: payload.athlete.lastname,
      profile: payload.athlete.profile
    }), {
      httpOnly: false, // Client needs to access this to show "Logged in as..."
      secure: process.env.NODE_ENV === 'production',
      path: '/'
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

    return NextResponse.redirect(redirectUrl);
  } catch (err) {
    console.error('Strava Auth Error:', err);
    return NextResponse.redirect(getPublicUrl(request, '/?error=token_exchange_failed'));
  }
}

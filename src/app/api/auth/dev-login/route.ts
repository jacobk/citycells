import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { setAuthCookies } from '@/lib/auth-cookies';

/**
 * POST /api/auth/dev-login
 * 
 * DEV ONLY: Manually set auth cookies for local development.
 * This bypasses OAuth when the Strava callback is configured for production.
 * 
 * Usage:
 * 1. Get your tokens from the production site (browser DevTools → Application → Cookies)
 * 2. POST to this endpoint with the token data
 * 
 * Example curl:
 * curl -X POST http://localhost:3000/api/auth/dev-login \
 *   -H "Content-Type: application/json" \
 *   -d '{"access_token":"xxx","refresh_token":"xxx","expires_at":1234567890,"athlete":{"id":123,"firstname":"John","lastname":"Doe","profile":"https://..."}}'
 */
export async function POST(request: Request) {
  // Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: 'This endpoint is only available in development' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { access_token, refresh_token, expires_at, athlete } = body;

    if (!access_token || !refresh_token || !expires_at || !athlete) {
      return NextResponse.json(
        { 
          error: 'Missing required fields',
          required: ['access_token', 'refresh_token', 'expires_at', 'athlete'],
          athlete_shape: { id: 'number', firstname: 'string', lastname: 'string', profile: 'string' }
        },
        { status: 400 }
      );
    }

    // Calculate expires_in from expires_at (Unix timestamp)
    const now = Math.floor(Date.now() / 1000);
    const expiresIn = Math.max(expires_at - now, 3600); // At least 1 hour

    const cookieStore = await cookies();
    await setAuthCookies(cookieStore, {
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresIn: expiresIn,
      athleteId: athlete.id,
      athlete: {
        id: athlete.id,
        firstname: athlete.firstname,
        lastname: athlete.lastname,
        profile: athlete.profile,
      },
    });

    console.log(`[dev-login] Set auth cookies for athlete ${athlete.id} (${athlete.firstname})`);

    return NextResponse.json({
      success: true,
      message: 'Auth cookies set successfully',
      athlete: {
        id: athlete.id,
        name: `${athlete.firstname} ${athlete.lastname}`,
      },
      note: 'Refresh the page to see the authenticated state. You may also need to store tokens in SQLite via the browser console.',
    });

  } catch (err) {
    console.error('[dev-login] Error:', err);
    return NextResponse.json(
      { error: 'Failed to set auth cookies' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/auth/dev-login
 * 
 * Returns instructions for using this endpoint.
 */
export async function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: 'This endpoint is only available in development' },
      { status: 403 }
    );
  }

  return NextResponse.json({
    endpoint: '/api/auth/dev-login',
    method: 'POST',
    description: 'Set auth cookies for local development without OAuth flow',
    instructions: [
      '1. Log in to your production deployment',
      '2. Open DevTools → Application → Cookies',
      '3. Copy values from: strava_access_token, strava_refresh_token, strava_expires_at, strava_athlete',
      '4. POST to this endpoint with the data (see example below)',
      '5. Refresh the page',
    ],
    example_payload: {
      access_token: '<from strava_access_token cookie>',
      refresh_token: '<from strava_refresh_token cookie>',
      expires_at: '<Unix timestamp from strava_expires_at cookie, divided by 1000>',
      athlete: {
        id: '<your Strava athlete ID>',
        firstname: '<your first name>',
        lastname: '<your last name>',
        profile: '<your profile picture URL>',
      },
    },
    example_curl: 'curl -X POST http://localhost:3000/api/auth/dev-login -H "Content-Type: application/json" -d \'{"access_token":"xxx","refresh_token":"xxx","expires_at":1234567890,"athlete":{"id":123,"firstname":"John","lastname":"Doe","profile":"https://example.com/pic.jpg"}}\'',
  });
}

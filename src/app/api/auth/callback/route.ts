import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import strava from 'strava-v3';
// Import to ensure config is applied
import '@/lib/strava';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error || !code) {
    return NextResponse.redirect(new URL('/?error=auth_failed', request.url));
  }

  try {
    const payload = await strava.oauth.getToken(code);
    
    // Calculate expiration
    const expiresAt = Date.now() + (payload.expires_in * 1000);

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

    return NextResponse.redirect(new URL('/', request.url));
  } catch (err) {
    console.error('Strava Auth Error:', err);
    return NextResponse.redirect(new URL('/?error=token_exchange_failed', request.url));
  }
}

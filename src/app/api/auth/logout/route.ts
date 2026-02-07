import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * POST /api/auth/logout
 * 
 * Clears authentication cookies and signals client to clear SQLite tokens.
 * WHY: Complete logout requires clearing both cookies (server) and SQLite (client).
 * See ADR 013 "User logout" in Token Lifecycle.
 */
export async function POST() {
  const cookieStore = await cookies();
  
  // Clear all authentication cookies
  cookieStore.delete('strava_access_token');
  cookieStore.delete('strava_refresh_token');
  cookieStore.delete('strava_expires_at');
  cookieStore.delete('strava_athlete');
  cookieStore.delete('strava_session');

  // WHY: Signal client to clear SQLite tokens for complete logout
  // The client will call clearUserTokens() on receiving this flag
  return NextResponse.json({ 
    success: true,
    should_clear_sqlite: true,
  });
}

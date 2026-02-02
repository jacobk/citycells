import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  const cookieStore = await cookies();
  
  // Clear all cookies
  cookieStore.delete('strava_access_token');
  cookieStore.delete('strava_refresh_token');
  cookieStore.delete('strava_expires_at');
  cookieStore.delete('strava_athlete');

  return NextResponse.json({ success: true });
}

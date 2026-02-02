import { NextResponse } from 'next/server';
import { getOAuthUrl } from '@/lib/strava';

export async function GET() {
  const url = await getOAuthUrl();
  return NextResponse.redirect(url);
}

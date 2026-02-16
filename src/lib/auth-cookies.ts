/**
 * Auth Cookies Module
 *
 * Centralized cookie configuration for Strava authentication.
 * WHY: Ensures consistent cookie settings across callback and restore-session endpoints.
 * See ADR 013 (2026-02-16 Update) for cookie lifetime specifications.
 *
 * @module auth-cookies
 */

import type { cookies } from 'next/headers';

// ============================================
// Constants
// ============================================

// WHY: 30 days in seconds - per ADR 013 clarification, persistent cookies
// should last 30 days to balance convenience with security
const THIRTY_DAYS_SECONDS = 30 * 24 * 60 * 60; // 2592000

// WHY: 1 hour session cookie - short-lived for security, SQLite has full tokens
const ONE_HOUR_SECONDS = 60 * 60; // 3600

/**
 * Cookie configuration per ADR 013 (2026-02-16 clarification).
 *
 * | Cookie               | HttpOnly | Max-Age   | Purpose                        |
 * |----------------------|----------|-----------|--------------------------------|
 * | strava_access_token  | Yes      | expiresIn | API authentication             |
 * | strava_refresh_token | Yes      | 30 days   | Token renewal (persistent)     |
 * | strava_expires_at    | Yes      | 30 days   | Token expiration tracking      |
 * | strava_session       | Yes      | 1 hour    | Session identifier (athlete ID)|
 * | strava_athlete       | No       | 30 days   | UI display (name, profile)     |
 */
export const COOKIE_CONFIG = {
  accessToken: {
    name: 'strava_access_token',
    httpOnly: true,
    // maxAge: set dynamically to match token expiry
  },
  refreshToken: {
    name: 'strava_refresh_token',
    httpOnly: true,
    maxAge: THIRTY_DAYS_SECONDS,
  },
  expiresAt: {
    name: 'strava_expires_at',
    httpOnly: true,
    maxAge: THIRTY_DAYS_SECONDS,
  },
  session: {
    name: 'strava_session',
    httpOnly: true,
    maxAge: ONE_HOUR_SECONDS,
    sameSite: 'lax' as const,
  },
  athlete: {
    name: 'strava_athlete',
    httpOnly: false, // WHY: Client needs access to display "Logged in as..."
    maxAge: THIRTY_DAYS_SECONDS,
  },
} as const;

// ============================================
// Types
// ============================================

/**
 * Athlete info for the strava_athlete cookie.
 * WHY: Contains only non-sensitive display info (name, profile pic).
 */
export interface AthleteInfo {
  id: number;
  firstname: string;
  lastname: string;
  profile: string;
}

/**
 * Options for setting all auth cookies.
 */
export interface SetAuthCookiesOptions {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds until access token expires (from Strava)
  athleteId: number;
  athlete?: AthleteInfo; // Optional - if provided, sets strava_athlete cookie
}

// Type for the awaited cookies() function from next/headers
type CookieStore = Awaited<ReturnType<typeof cookies>>;

// ============================================
// Helper Functions
// ============================================

/**
 * Set all authentication cookies with proper lifetimes.
 * WHY: Centralizes cookie setting to ensure consistency between
 * /api/auth/callback and /api/auth/restore-session endpoints.
 *
 * See ADR 013 "Cookie Strategy" and 2026-02-16 Update for rationale.
 *
 * @param cookieStore - The cookie store from next/headers cookies()
 * @param options - Token and athlete data to store in cookies
 */
export async function setAuthCookies(
  cookieStore: CookieStore,
  options: SetAuthCookiesOptions
): Promise<void> {
  const { accessToken, refreshToken, expiresIn, athleteId, athlete } = options;
  const isProduction = process.env.NODE_ENV === 'production';

  // Calculate expiration timestamp in milliseconds for expires_at cookie
  const expiresAtMs = Date.now() + expiresIn * 1000;

  // 1. Access token - maxAge matches token expiry
  cookieStore.set(COOKIE_CONFIG.accessToken.name, accessToken, {
    httpOnly: COOKIE_CONFIG.accessToken.httpOnly,
    secure: isProduction,
    path: '/',
    maxAge: expiresIn,
  });

  // 2. Refresh token - 30 days (persistent)
  cookieStore.set(COOKIE_CONFIG.refreshToken.name, refreshToken, {
    httpOnly: COOKIE_CONFIG.refreshToken.httpOnly,
    secure: isProduction,
    path: '/',
    maxAge: COOKIE_CONFIG.refreshToken.maxAge,
  });

  // 3. Expires at - 30 days (persistent)
  cookieStore.set(COOKIE_CONFIG.expiresAt.name, expiresAtMs.toString(), {
    httpOnly: COOKIE_CONFIG.expiresAt.httpOnly,
    secure: isProduction,
    path: '/',
    maxAge: COOKIE_CONFIG.expiresAt.maxAge,
  });

  // 4. Session cookie - 1 hour (short-lived for security)
  cookieStore.set(COOKIE_CONFIG.session.name, athleteId.toString(), {
    httpOnly: COOKIE_CONFIG.session.httpOnly,
    secure: isProduction,
    path: '/',
    maxAge: COOKIE_CONFIG.session.maxAge,
    sameSite: COOKIE_CONFIG.session.sameSite,
  });

  // 5. Athlete info - 30 days (persistent, client-readable)
  // WHY: Only set if athlete info is provided. During restore-session,
  // we fetch fresh athlete data from Strava to populate this.
  if (athlete) {
    cookieStore.set(
      COOKIE_CONFIG.athlete.name,
      JSON.stringify({
        id: athlete.id,
        firstname: athlete.firstname,
        lastname: athlete.lastname,
        profile: athlete.profile,
      }),
      {
        httpOnly: COOKIE_CONFIG.athlete.httpOnly,
        secure: isProduction,
        path: '/',
        maxAge: COOKIE_CONFIG.athlete.maxAge,
      }
    );
  }
}

/**
 * Clear all authentication cookies.
 * WHY: Used during logout to ensure complete session termination.
 *
 * @param cookieStore - The cookie store from next/headers cookies()
 */
export async function clearAuthCookies(cookieStore: CookieStore): Promise<void> {
  const cookieNames = [
    COOKIE_CONFIG.accessToken.name,
    COOKIE_CONFIG.refreshToken.name,
    COOKIE_CONFIG.expiresAt.name,
    COOKIE_CONFIG.session.name,
    COOKIE_CONFIG.athlete.name,
  ];

  for (const name of cookieNames) {
    cookieStore.delete(name);
  }
}

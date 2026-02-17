/**
 * Auth Persistence Module
 * 
 * Client-side authentication persistence using SQLite.
 * WHY: Enables persistent Strava authentication across browser sessions.
 * See ADR 013 for the full token flow and security considerations.
 * 
 * @module auth-persistence
 */

import { 
  initDatabase, 
  getUserByStravaId, 
  updateUserTokens, 
  clearUserTokens,
  isDatabaseInitialized,
  getCachedAthleteInfo,
  type TokenData,
  type UserRow,
  type CachedAthleteInfo 
} from './db';

// ============================================
// Types
// ============================================

/**
 * Result of attempting to restore a session from SQLite.
 */
export interface SessionRestoreResult {
  success: boolean;
  athlete?: {
    id: number;
    username: string | null;
  };
  tokens?: TokenData;
  error?: string;
}

/**
 * OAuth callback parameters from URL.
 * WHY: Includes athlete info fields for SQLite caching (TICKET-024)
 */
export interface OAuthCallbackParams {
  auth: string;
  athlete_id: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: string;
  // WHY: Athlete info for caching - avoids extra API call on session restoration
  firstname: string;
  lastname: string;
  profile: string;
}

// ============================================
// URL Parameter Handling
// ============================================

/**
 * Check if current URL has OAuth callback parameters.
 * WHY: After OAuth callback, tokens are passed via URL for SQLite storage.
 */
export function hasOAuthCallbackParams(): boolean {
  if (typeof window === 'undefined') return false;
  
  const params = new URLSearchParams(window.location.search);
  return params.get('auth') === 'success' && 
         params.has('athlete_id') &&
         params.has('access_token') &&
         params.has('refresh_token');
}

/**
 * Get OAuth callback parameters from URL.
 * Returns null if params are missing or invalid.
 * WHY: Includes athlete info for SQLite caching (TICKET-024)
 */
export function getOAuthCallbackParams(): OAuthCallbackParams | null {
  if (typeof window === 'undefined') return null;
  
  const params = new URLSearchParams(window.location.search);
  
  const auth = params.get('auth');
  const athleteId = params.get('athlete_id');
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  const tokenExpiresAt = params.get('token_expires_at');
  const firstname = params.get('firstname');
  const lastname = params.get('lastname');
  const profile = params.get('profile');
  
  // WHY: All params required for complete OAuth + athlete caching
  if (auth !== 'success' || !athleteId || !accessToken || !refreshToken || !tokenExpiresAt ||
      !firstname || !lastname || !profile) {
    return null;
  }
  
  return {
    auth,
    athlete_id: athleteId,
    access_token: accessToken,
    refresh_token: refreshToken,
    token_expires_at: tokenExpiresAt,
    firstname,
    lastname,
    profile,
  };
}

/**
 * Clear OAuth callback parameters from URL.
 * WHY: Tokens in URL are a security risk; remove after storing in SQLite.
 */
export function clearOAuthCallbackParams(): void {
  if (typeof window === 'undefined') return;
  
  const url = new URL(window.location.href);
  url.searchParams.delete('auth');
  url.searchParams.delete('athlete_id');
  url.searchParams.delete('access_token');
  url.searchParams.delete('refresh_token');
  url.searchParams.delete('token_expires_at');
  // WHY: Also clear athlete info params (TICKET-024)
  url.searchParams.delete('firstname');
  url.searchParams.delete('lastname');
  url.searchParams.delete('profile');
  
  // WHY: Use replaceState to avoid adding to browser history
  window.history.replaceState({}, '', url.toString());
}

// ============================================
// Token Sync Operations
// ============================================

/**
 * Store tokens in SQLite after OAuth callback.
 * WHY: Persist tokens for returning user flow.
 * WHY: Also stores athlete info for session restoration optimization (TICKET-024)
 * 
 * @param params OAuth callback parameters from URL
 * @param username Optional username for display
 * @returns User ID from database
 */
export async function syncTokensToSQLite(
  params: OAuthCallbackParams,
  username?: string
): Promise<number> {
  // Ensure database is initialized
  await initDatabase();
  
  const stravaId = parseInt(params.athlete_id, 10);
  const tokens: TokenData = {
    access_token: params.access_token,
    refresh_token: params.refresh_token,
    token_expires_at: parseInt(params.token_expires_at, 10),
  };
  
  // WHY: Cache athlete info alongside tokens (TICKET-024)
  // This enables session restoration without extra Strava API call
  const athleteInfo: CachedAthleteInfo = {
    firstname: params.firstname,
    lastname: params.lastname,
    profile: params.profile,
  };
  
  const userId = await updateUserTokens(stravaId, tokens, username, athleteInfo);
  console.log('[auth-persistence] Tokens + athlete info synced to SQLite for user', stravaId);
  
  // Clear tokens from URL for security
  clearOAuthCallbackParams();
  
  return userId;
}

// ============================================
// Session Restoration
// ============================================

/**
 * Check SQLite for stored user with valid refresh token.
 * WHY: Returns stored user if found, enabling session restoration.
 * 
 * @param stravaId Strava athlete ID to check
 * @returns User row if found with refresh token, null otherwise
 */
export async function getStoredUser(stravaId: number): Promise<UserRow | null> {
  try {
    // Only check if database is already initialized
    if (!isDatabaseInitialized()) {
      await initDatabase();
    }
    
    const user = getUserByStravaId(stravaId);
    
    // WHY: User must have refresh_token to restore session
    if (user && user.refresh_token) {
      return user;
    }
    
    return null;
  } catch (err) {
    console.error('[auth-persistence] Error checking stored user:', err);
    return null;
  }
}

/**
 * Attempt to restore session from SQLite tokens.
 * WHY: Enables returning users to skip re-authentication.
 * See ADR 013 "Returning User Flow" for the full flow.
 * 
 * OPTIMIZATION (TICKET-024): If athlete info is cached in SQLite, sends it to
 * the server to avoid an extra Strava API call. Session restoration typically
 * uses 1 API call (token refresh) instead of 2.
 * 
 * @param stravaId Strava athlete ID
 * @returns Result of session restoration attempt
 */
export async function restoreSession(stravaId: number): Promise<SessionRestoreResult> {
  try {
    // Get stored user with tokens
    const user = await getStoredUser(stravaId);
    
    if (!user || !user.refresh_token) {
      return {
        success: false,
        error: 'No stored tokens found',
      };
    }
    
    // WHY: Check for cached athlete info (TICKET-024)
    // If available, send to server to skip Strava API call
    const cachedAthlete = getCachedAthleteInfo(stravaId);
    
    // WHY: Call server endpoint to refresh tokens and set cookies
    // This ensures API routes have valid cookies for Strava API calls
    const response = await fetch('/api/auth/restore-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        refresh_token: user.refresh_token,
        athlete_id: stravaId,
        // WHY: Send cached athlete if available - server will use it for cookie
        // and skip the Strava /api/v3/athlete API call
        cached_athlete: cachedAthlete,
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      
      // WHY: If server says to clear tokens, refresh token is likely revoked
      if (errorData.should_clear_tokens) {
        await clearUserTokens(stravaId);
        console.log('[auth-persistence] Cleared revoked tokens for user', stravaId);
      }
      
      return {
        success: false,
        error: errorData.error || 'Session restoration failed',
      };
    }
    
    const data = await response.json();
    
    // WHY: Update SQLite with new tokens from refresh
    // Strava may rotate refresh_token, so we must update it
    // Also cache athlete info if server fetched it fresh (TICKET-024)
    if (data.tokens) {
      // WHY: If server fetched fresh athlete info (cache was missing),
      // include it in the update so future restorations can use the cache
      const athleteToCache = data.fetched_athlete || cachedAthlete;
      await updateUserTokens(stravaId, data.tokens, user.username || undefined, athleteToCache);
      console.log(`[auth-persistence] Session restored for user ${stravaId}${data.fetched_athlete ? ' (athlete info cached)' : ' (used cached athlete)'}`);
    }
    
    return {
      success: true,
      athlete: {
        id: stravaId,
        username: user.username,
      },
      tokens: data.tokens,
    };
  } catch (err) {
    console.error('[auth-persistence] Error restoring session:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

// ============================================
// Logout
// ============================================

/**
 * Clear tokens from SQLite on logout.
 * WHY: Complete logout requires clearing both cookies (server) and SQLite (client).
 * 
 * @param stravaId Strava athlete ID
 */
export async function clearStoredTokens(stravaId: number): Promise<void> {
  try {
    if (!isDatabaseInitialized()) {
      await initDatabase();
    }
    
    await clearUserTokens(stravaId);
    console.log('[auth-persistence] Tokens cleared for user', stravaId);
  } catch (err) {
    console.error('[auth-persistence] Error clearing tokens:', err);
    throw err;
  }
}

// ============================================
// Initialization Helper
// ============================================

/**
 * Initialize auth persistence and check for returning user.
 * WHY: Single entry point for auth initialization on page load.
 * 
 * This function handles:
 * 1. OAuth callback token sync (if URL has params)
 * 2. Returning user session restoration (if SQLite has tokens)
 * 
 * @param knownAthleteId Optional known athlete ID (e.g., from cookie)
 * @returns Session restore result or null if no auth action needed
 */
export async function initAuthPersistence(
  knownAthleteId?: number
): Promise<SessionRestoreResult | null> {
  // Check for OAuth callback params first
  if (hasOAuthCallbackParams()) {
    const params = getOAuthCallbackParams();
    if (params) {
      await syncTokensToSQLite(params);
      // WHY: After OAuth callback, session is already active via cookies
      // No need to restore - just return success
      return {
        success: true,
        athlete: {
          id: parseInt(params.athlete_id, 10),
          username: null, // Will be populated from cookie
        },
      };
    }
  }
  
  // If we have a known athlete ID, try to restore session
  if (knownAthleteId) {
    return restoreSession(knownAthleteId);
  }
  
  return null;
}

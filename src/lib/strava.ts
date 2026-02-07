import strava from 'strava-v3';

export const stravaConfig = {
  client_id: process.env.STRAVA_CLIENT_ID!,
  client_secret: process.env.STRAVA_CLIENT_SECRET!,
  redirect_uri: process.env.STRAVA_REDIRECT_URI!,
};

// WHY: read_all enables full activity streams without privacy cropping (ADR 006)
export const STRAVA_SCOPES = 'read,activity:read_all,read_all';

// Initialize the global config once (optional, but good for defaults)
strava.config({
  access_token: '',
  client_id: stravaConfig.client_id,
  client_secret: stravaConfig.client_secret,
  redirect_uri: stravaConfig.redirect_uri,
});

export function getStravaClient(accessToken?: string) {
  // @ts-expect-error - The type definition says returns void, but it returns a client instance
  return new strava.client(accessToken);
}

export function getOAuthUrl() {
  return strava.oauth.getRequestAccessURL({
    scope: STRAVA_SCOPES,
    client_id: stravaConfig.client_id,
    redirect_uri: stravaConfig.redirect_uri
  });
}

export async function refreshAccessToken(refreshToken: string) {
  try {
    const result = await strava.oauth.refreshToken(refreshToken);
    return result;
  } catch (err) {
    console.error("Failed to refresh token", err);
    throw err;
  }
}

// ============================================
// Token Validation Utilities (ADR 013)
// ============================================

/**
 * Token validation result returned by getValidAccessToken.
 */
export interface TokenValidationResult {
  accessToken: string;
  refreshed: boolean;
  newTokens?: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
}

/**
 * Cookie values needed for token validation.
 * WHY: Accept these as params so we can use this from API routes.
 */
export interface TokenCookies {
  accessToken: string | undefined;
  refreshToken: string | undefined;
  expiresAt: string | undefined;
}

// WHY: 5-minute buffer ensures we refresh before token actually expires
// This prevents race conditions where token expires mid-request
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get a valid access token, refreshing if needed.
 * WHY: Centralizes token refresh logic for all API routes.
 * See ADR 013 "Automatic Token Refresh" section for the algorithm.
 * 
 * @param cookies - Current token cookies from the request
 * @returns TokenValidationResult with valid token, or null if auth required
 */
export async function getValidAccessToken(
  cookies: TokenCookies
): Promise<TokenValidationResult | null> {
  const { accessToken, refreshToken, expiresAt } = cookies;

  // WHY: No refresh token means user must re-authenticate
  if (!refreshToken) {
    console.log('[getValidAccessToken] No refresh token - auth required');
    return null;
  }

  const now = Date.now();
  const expiresAtMs = expiresAt ? parseInt(expiresAt, 10) : 0;
  const needsRefresh = !accessToken || (expiresAtMs && now > expiresAtMs - TOKEN_REFRESH_BUFFER_MS);

  if (!needsRefresh && accessToken) {
    // Token is still valid
    return {
      accessToken,
      refreshed: false,
    };
  }

  // Token expired or expiring soon - refresh it
  console.log('[getValidAccessToken] Token expired or expiring, refreshing...');
  
  try {
    const refreshed = await refreshAccessToken(refreshToken);
    
    return {
      accessToken: refreshed.access_token,
      refreshed: true,
      newTokens: {
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token,
        expires_in: refreshed.expires_in,
      },
    };
  } catch (err) {
    // WHY: Refresh failure means token is likely revoked
    // Client should clear tokens and prompt re-authentication
    console.error('[getValidAccessToken] Token refresh failed:', err);
    return null;
  }
}

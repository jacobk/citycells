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

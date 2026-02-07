/**
 * Request origin utilities for API routes.
 * WHY: Behind reverse proxies (ngrok, Vercel, etc.) request.url is the internal
 * URL (e.g. http://localhost:3000). Redirects must use the public origin so
 * the user stays on the same host they used (e.g. https://xyz.ngrok.io).
 * See: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Forwarded-Host
 */

/**
 * Returns the public origin (scheme + host, no path) for building redirect URLs.
 * Uses x-forwarded-host and x-forwarded-proto when present (set by ngrok and
 * many reverse proxies); otherwise falls back to request.url.
 */
export function getPublicOrigin(request: Request): string {
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto');

  if (forwardedHost) {
    const scheme = forwardedProto === 'https' ? 'https' : 'http';
    return `${scheme}://${forwardedHost.split(',')[0].trim()}`;
  }

  const url = new URL(request.url);
  return url.origin;
}

/**
 * Builds a full URL for a path using the public origin.
 * Use this for redirects in API routes so they work behind ngrok/proxies.
 */
export function getPublicUrl(request: Request, path: string): URL {
  const origin = getPublicOrigin(request);
  return new URL(path, origin);
}

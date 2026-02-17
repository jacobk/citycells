'use client';

import { useState } from 'react';
import Link from 'next/link';

/**
 * Dev Login Page
 * 
 * DEV ONLY: A simple form to set auth cookies for local development.
 * This bypasses OAuth when the Strava callback is configured for production.
 */
export default function DevLoginPage() {
  const [accessToken, setAccessToken] = useState('');
  const [refreshToken, setRefreshToken] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [athleteJson, setAthleteJson] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  // Check if we're in production (this page shouldn't work there anyway)
  const isProd = process.env.NODE_ENV === 'production';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setMessage('');

    try {
      // Parse athlete JSON (handle URL-encoded values from cookies)
      let athlete;
      try {
        // First try to URL-decode in case it's from a cookie
        const decodedJson = decodeURIComponent(athleteJson);
        athlete = JSON.parse(decodedJson);
      } catch {
        // If that fails, try parsing directly
        try {
          athlete = JSON.parse(athleteJson);
        } catch {
          setStatus('error');
          setMessage('Invalid athlete JSON. Make sure to paste the full JSON object (URL-encoded or plain).');
          return;
        }
      }

      // Parse expires_at - handle both milliseconds and seconds
      let expiresAtSeconds = parseInt(expiresAt, 10);
      if (isNaN(expiresAtSeconds)) {
        setStatus('error');
        setMessage('Invalid expires_at value. Should be a Unix timestamp.');
        return;
      }
      // If the value looks like milliseconds (> year 2100 in seconds), convert to seconds
      if (expiresAtSeconds > 4102444800) {
        expiresAtSeconds = Math.floor(expiresAtSeconds / 1000);
      }

      const response = await fetch('/api/auth/dev-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_at: expiresAtSeconds,
          athlete,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus('success');
        setMessage(`Logged in as ${data.athlete?.name}! Redirecting...`);
        setTimeout(() => {
          window.location.href = '/';
        }, 1500);
      } else {
        setStatus('error');
        setMessage(data.error || 'Failed to set auth cookies');
      }
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  if (isProd) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive mb-2">Not Available</h1>
          <p className="text-muted-foreground">This page is only available in development mode.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-foreground mb-2">Dev Login</h1>
        <p className="text-muted-foreground mb-6">
          Paste your auth cookies from production to log in locally without OAuth.
        </p>

        {/* Instructions */}
        <div className="bg-muted/50 rounded-lg p-4 mb-6 text-sm">
          <h2 className="font-semibold mb-2">How to get your tokens:</h2>
          <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
            <li>Go to your production deployment and log in with Strava</li>
            <li>Open DevTools → Application → Cookies</li>
            <li>Copy the values below from the corresponding cookies</li>
          </ol>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Access Token */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Access Token
              <span className="text-muted-foreground font-normal ml-2">
                (from <code className="bg-muted px-1 rounded">strava_access_token</code>)
              </span>
            </label>
            <input
              type="text"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder="Paste strava_access_token value..."
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>

          {/* Refresh Token */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Refresh Token
              <span className="text-muted-foreground font-normal ml-2">
                (from <code className="bg-muted px-1 rounded">strava_refresh_token</code>)
              </span>
            </label>
            <input
              type="text"
              value={refreshToken}
              onChange={(e) => setRefreshToken(e.target.value)}
              placeholder="Paste strava_refresh_token value..."
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>

          {/* Expires At */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Expires At
              <span className="text-muted-foreground font-normal ml-2">
                (from <code className="bg-muted px-1 rounded">strava_expires_at</code>)
              </span>
            </label>
            <input
              type="text"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              placeholder="e.g., 1739836800000 (milliseconds or seconds)"
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              Works with both milliseconds and seconds format
            </p>
          </div>

          {/* Athlete JSON */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Athlete JSON
              <span className="text-muted-foreground font-normal ml-2">
                (from <code className="bg-muted px-1 rounded">strava_athlete</code>)
              </span>
            </label>
            <textarea
              value={athleteJson}
              onChange={(e) => setAthleteJson(e.target.value)}
              placeholder='{"id":12345,"firstname":"John","lastname":"Doe","profile":"https://..."}'
              rows={4}
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary font-mono text-sm"
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              Paste directly from the cookie (URL-encoded values are automatically decoded)
            </p>
          </div>

          {/* Status Message */}
          {message && (
            <div
              className={`p-3 rounded-md text-sm ${
                status === 'success'
                  ? 'bg-green-500/10 text-green-500 border border-green-500/20'
                  : status === 'error'
                  ? 'bg-destructive/10 text-destructive border border-destructive/20'
                  : ''
              }`}
            >
              {message}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={status === 'loading'}
            className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {status === 'loading' ? 'Setting cookies...' : 'Log In'}
          </button>
        </form>

        {/* Back Link */}
        <div className="mt-6 text-center">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← Back to app
          </Link>
        </div>
      </div>
    </div>
  );
}

# ADR 013: Persistent Strava Authentication

**Date:** 2026-02-07
**Status:** Accepted
**Supersedes:** N/A

## Context

Currently, CityCells stores Strava OAuth tokens in HTTP-only cookies. While secure against XSS attacks, this approach has a significant UX problem: users must re-authenticate with Strava frequently because:

1. **Session cookies expire**: When the browser closes or session ends, tokens are lost
2. **Cookie expiration**: Even persistent cookies eventually expire
3. **No automatic refresh**: If the access token expires mid-session, users must manually re-login

The existing SQLite database (ADR 004) already defines a `users` table with `access_token`, `refresh_token`, and `token_expires_at` columns, but these are not currently utilized. Instead, tokens live only in cookies.

**User expectation**: Once connected to Strava, the connection should persist indefinitely (or until the refresh token is revoked by Strava/user).

## Decision

We will implement **persistent token storage in SQLite** with **automatic token refresh**, using cookies only as a session bridge.

### Token Storage Strategy

**Primary storage**: SQLite `users` table (persistent via IndexedDB)
**Session bridge**: Short-lived HTTP-only cookies for API route authentication

```
┌─────────────────────────────────────────────────────────────────────┐
│                        TOKEN FLOW                                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  INITIAL AUTH (OAuth callback):                                      │
│  ┌──────────┐    ┌──────────────┐    ┌────────────┐                 │
│  │  Strava  │───>│ /api/auth/   │───>│  SQLite    │                 │
│  │  OAuth   │    │  callback    │    │  (persist) │                 │
│  └──────────┘    └──────┬───────┘    └────────────┘                 │
│                         │                                            │
│                         v                                            │
│                  ┌──────────────┐                                    │
│                  │ Set session  │                                    │
│                  │ cookie (1hr) │                                    │
│                  └──────────────┘                                    │
│                                                                      │
│  PAGE LOAD (returning user):                                         │
│  ┌──────────┐    ┌──────────────┐    ┌────────────┐                 │
│  │  Client  │───>│ Check SQLite │───>│ Valid      │──> Auto-login   │
│  │  loads   │    │ for tokens   │    │ refresh?   │                 │
│  └──────────┘    └──────────────┘    └─────┬──────┘                 │
│                                            │ No                      │
│                                            v                         │
│                                     ┌────────────┐                   │
│                                     │ Refresh    │                   │
│                                     │ with Strava│                   │
│                                     └─────┬──────┘                   │
│                                           │                          │
│                              ┌────────────┴────────────┐             │
│                              │ Success?                │             │
│                              │                         │             │
│                         Yes  v                    No   v             │
│                    ┌──────────────┐         ┌──────────────┐         │
│                    │ Update SQLite│         │ Clear tokens │         │
│                    │ + new cookie │         │ Prompt login │         │
│                    └──────────────┘         └──────────────┘         │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Token Lifecycle

| Event | Action |
|-------|--------|
| OAuth callback | Store tokens in SQLite, set 1-hour session cookie |
| Page load (cookie valid) | Use cookie for API calls |
| Page load (no cookie, SQLite has tokens) | Check token expiry, refresh if needed, set new cookie |
| API call (token expired) | Automatic refresh, update SQLite, continue request |
| Refresh token invalid/revoked | Clear all tokens, prompt user to re-connect |
| User logout | Clear SQLite tokens + cookies |

### Cookie Strategy

**Session cookie** (`strava_session`):
- Contains: Strava athlete ID (to identify user in SQLite)
- HttpOnly: Yes (security)
- Secure: Yes (production)
- SameSite: Lax
- Max-Age: 3600 (1 hour) - short-lived for security

**Why short-lived cookies?**
- Cookies are attack vectors (CSRF, theft)
- SQLite is the source of truth for tokens
- If cookie expires, we check SQLite and refresh seamlessly
- If device is stolen, attacker has limited window

### Automatic Token Refresh

```typescript
// Pseudocode for API routes
async function getValidAccessToken(athleteId: number): Promise<string | null> {
  const user = db.getUserByStravaId(athleteId);
  
  if (!user || !user.refresh_token) {
    return null; // No stored tokens - user must re-auth
  }
  
  // Check if access token is expired (with 5-min buffer)
  const now = Math.floor(Date.now() / 1000);
  if (user.token_expires_at > now + 300) {
    return user.access_token; // Still valid
  }
  
  // Token expired or expiring soon - refresh it
  try {
    const response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      body: new URLSearchParams({
        client_id: STRAVA_CLIENT_ID,
        client_secret: STRAVA_CLIENT_SECRET,
        refresh_token: user.refresh_token,
        grant_type: 'refresh_token',
      }),
    });
    
    if (!response.ok) {
      // Refresh token revoked or invalid
      db.clearUserTokens(athleteId);
      return null;
    }
    
    const tokens = await response.json();
    
    // Update SQLite with new tokens
    db.updateUserTokens(athleteId, {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token, // Strava may rotate this
      token_expires_at: tokens.expires_at,
    });
    
    return tokens.access_token;
  } catch (error) {
    console.error('Token refresh failed:', error);
    return null;
  }
}
```

### User Experience Flow

**Returning user (happy path)**:
1. User opens CityCells
2. Client initializes SQLite, finds stored tokens
3. Check if refresh token exists and is likely valid
4. If access token expired: automatic refresh in background
5. User sees their data immediately - no login prompt

**Returning user (refresh token expired/revoked)**:
1. User opens CityCells
2. Client finds tokens, but refresh fails (401 from Strava)
3. All tokens cleared from SQLite
4. User sees "Connect with Strava" button
5. Single click re-authenticates

**Security event (user revokes access in Strava)**:
1. Next API call attempts refresh
2. Strava returns error (token revoked)
3. Tokens cleared, user prompted to re-connect
4. No stale data access possible

### Database Usage

Leverage existing `users` table from ADR 004:

```sql
-- Already defined in ADR 004
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  strava_id INTEGER UNIQUE NOT NULL,
  username TEXT,
  access_token TEXT,        -- Store here (encrypted recommended)
  refresh_token TEXT,       -- Store here (encrypted recommended)
  token_expires_at INTEGER, -- Unix timestamp
  created_at TEXT DEFAULT (datetime('now'))
);
```

**New index for efficient lookup:**
```sql
CREATE INDEX IF NOT EXISTS idx_users_strava_id ON users(strava_id);
```

### Security Considerations

| Risk | Mitigation |
|------|------------|
| Token theft from SQLite | IndexedDB is origin-sandboxed; tokens not accessible cross-origin |
| XSS accessing tokens | Tokens stored in SQLite (not JS-accessible cookies); API routes validate requests |
| Stolen device | Short session cookies limit active window; user can revoke in Strava |
| Stale permissions | Refresh validates with Strava; revoked access immediately detected |

**Future enhancement**: Encrypt tokens at rest in SQLite using a derived key.

## Consequences

### Positive

- **Seamless UX**: Users connect once, stay connected indefinitely
- **No re-auth friction**: Returning users see their data immediately
- **Leverages existing schema**: Uses `users` table already defined in ADR 004
- **Automatic recovery**: Token refresh happens transparently
- **Graceful degradation**: If refresh fails, user simply re-connects (one click)

### Negative

- **Increased complexity**: Token refresh logic in API routes
- **Strava dependency**: If Strava is down, refresh fails (but cached data still shows)
- **No cross-device sync**: Tokens are per-browser (consistent with ADR 004 philosophy)

### Technical

- Requires client-side SQLite initialization before auth state is known
- API routes must handle token refresh atomically (avoid race conditions)
- Need to handle IndexedDB storage limits (tokens are small, not a concern)
- Cookie and SQLite state must stay synchronized

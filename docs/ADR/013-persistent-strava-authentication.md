# ADR 013: Persistent Strava Authentication

**Date:** 2026-02-07
**Status:** Accepted
**Supersedes:** N/A

## Context

Currently, CityCells stores Strava OAuth tokens in HTTP-only cookies. While secure against XSS attacks, this approach has a significant UX problem: users must re-authenticate with Strava frequently because:

1. **Session cookies expire**: When the browser closes or session ends, tokens are lost
2. **Cookie expiration**: Even persistent cookies eventually expire
3. **No automatic refresh**: If the access token expires mid-session, users must manually re-login

The IndexedDB `users` store ([ADR 026](./026-indexeddb-storage.md), which superseded ADR 004) stores `accessToken`, `refreshToken`, and `tokenExpiresAt` fields, but these are not currently utilized. Instead, tokens live only in cookies.

**User expectation**: Once connected to Strava, the connection should persist indefinitely (or until the refresh token is revoked by Strava/user).

## Decision

We will implement **persistent token storage in IndexedDB** with **automatic token refresh**, using cookies only as a session bridge.

### Token Storage Strategy

**Primary storage**: IndexedDB `users` store (keyed by `stravaId` — see [ADR 026](./026-indexeddb-storage.md))
**Session bridge**: Short-lived HTTP-only cookies for API route authentication

```
┌─────────────────────────────────────────────────────────────────────┐
│                        TOKEN FLOW                                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  INITIAL AUTH (OAuth callback):                                      │
│  ┌──────────┐    ┌──────────────┐    ┌────────────┐                 │
│  │  Strava  │───>│ /api/auth/   │───>│ IndexedDB  │                 │
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
│  │  Client  │───>│ Check IDB    │───>│ Valid      │──> Auto-login   │
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
│                    │ Update IDB   │         │ Clear tokens │         │
│                    │ + new cookie │         │ Prompt login │         │
│                    └──────────────┘         └──────────────┘         │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Token Lifecycle

| Event | Action |
|-------|--------|
| OAuth callback | Store tokens in IndexedDB `users` store, set 1-hour session cookie |
| Page load (cookie valid) | Use cookie for API calls |
| Page load (no cookie, IndexedDB has tokens) | Check token expiry, refresh if needed, set new cookie |
| API call (token expired) | Automatic refresh, update IndexedDB, continue request |
| Refresh token invalid/revoked | Clear all tokens, prompt user to re-connect |
| User logout | Clear IndexedDB tokens + cookies |

### Cookie Strategy

**Session cookie** (`strava_session`):
- Contains: Strava athlete ID (to identify user in IndexedDB)
- HttpOnly: Yes (security)
- Secure: Yes (production)
- SameSite: Lax
- Max-Age: 3600 (1 hour) - short-lived for security

**Why short-lived cookies?**
- Cookies are attack vectors (CSRF, theft)
- IndexedDB is the source of truth for tokens
- If cookie expires, we check IndexedDB and refresh seamlessly
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
    
    // Update IndexedDB with new tokens
    await db.updateUserTokens(athleteId, {
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
2. Client initializes IndexedDB, finds stored tokens
3. Check if refresh token exists and is likely valid
4. If access token expired: automatic refresh in background
5. User sees their data immediately - no login prompt

**Returning user (refresh token expired/revoked)**:
1. User opens CityCells
2. Client finds tokens, but refresh fails (401 from Strava)
3. All tokens cleared from IndexedDB
4. User sees "Connect with Strava" button
5. Single click re-authenticates

**Security event (user revokes access in Strava)**:
1. Next API call attempts refresh
2. Strava returns error (token revoked)
3. Tokens cleared, user prompted to re-connect
4. No stale data access possible

### Database Usage

Leverage the `users` IndexedDB store (see [ADR 026](./026-indexeddb-storage.md)):

- **Store**: `users`
- **Key**: `stravaId`
- **Fields**: `accessToken`, `refreshToken`, `tokenExpiresAt`, `username`, `firstname`, `lastname`, `profileUrl`, `createdAt`

No separate index needed — `stravaId` is the primary key.

### Security Considerations

| Risk | Mitigation |
|------|------------|
| Token theft from IndexedDB | IndexedDB is origin-sandboxed; tokens not accessible cross-origin |
| XSS accessing tokens | Tokens stored in IndexedDB; API routes validate requests |
| Stolen device | Short session cookies limit active window; user can revoke in Strava |
| Stale permissions | Refresh validates with Strava; revoked access immediately detected |

**Future enhancement**: Encrypt tokens at rest in IndexedDB using a derived key.

## Consequences

### Positive

- **Seamless UX**: Users connect once, stay connected indefinitely
- **No re-auth friction**: Returning users see their data immediately
- **Leverages existing schema**: Uses `users` store in IndexedDB (ADR 026)
- **Automatic recovery**: Token refresh happens transparently
- **Graceful degradation**: If refresh fails, user simply re-connects (one click)

### Negative

- **Increased complexity**: Token refresh logic in API routes
- **Strava dependency**: If Strava is down, refresh fails (but cached data still shows)
- **No cross-device sync**: Tokens are per-browser (consistent with ADR 004 philosophy)

### Technical

- Requires client-side IndexedDB initialization before auth state is known
- API routes must handle token refresh atomically (avoid race conditions)
- Need to handle IndexedDB storage limits (tokens are small, not a concern)
- Cookie and IndexedDB state must stay synchronized

## Updates

### 2026-02-16: Cookie Lifetime Clarification

**Issue:** The original ADR specified `maxAge: 3600` for `strava_session` but was silent on other cookies. The implementation set critical cookies (`strava_refresh_token`, `strava_expires_at`, `strava_athlete`) as **session cookies** (no `maxAge`), causing them to be deleted when the browser closes.

**Problem:** When a user closes the browser:
1. Session cookies are deleted
2. `strava_session` (1 hour) eventually expires
3. Without athlete ID, the system cannot look up tokens in IndexedDB
4. User appears unauthenticated despite having valid tokens stored

**Clarification - Complete Cookie Strategy:**

| Cookie | HttpOnly | Max-Age | Purpose |
|--------|----------|---------|---------|
| `strava_access_token` | Yes | Match `expires_in` | API authentication |
| `strava_refresh_token` | Yes | **30 days** | Token renewal (persistent) |
| `strava_expires_at` | Yes | **30 days** | Token expiration tracking |
| `strava_session` | Yes | 1 hour | Session identifier |
| `strava_athlete` | No | **30 days** | UI display (name, profile) |

**Rationale for 30 days:**
- Aligns with typical Strava refresh token validity
- Balances user convenience (stay logged in) with security
- IndexedDB remains source of truth; cookies are convenience cache
- If cookies expire but IndexedDB has valid tokens, session restoration works

**Additional Requirement:** The `/api/auth/restore-session` endpoint must set the `strava_athlete` cookie when refreshing tokens, not just `strava_session`.

See TICKET-019 for implementation.

### 2026-02-17: Athlete Info Caching Optimization

**Issue:** The 2026-02-16 fix required `/api/auth/restore-session` to fetch athlete profile from Strava API to populate the `strava_athlete` cookie. This means every session restoration makes **2 Strava API calls**:
1. Token refresh (POST to OAuth endpoint)
2. Athlete profile fetch (GET `/api/v3/athlete`)

This doubles API usage during session restoration and contributes to rate limit consumption.

**Optimization:** Cache athlete info (firstname, lastname, profile URL) in IndexedDB alongside tokens. The athlete profile rarely changes, so we can:
1. Store athlete info when first received during OAuth callback
2. Reuse cached info during session restoration
3. Only fetch fresh athlete info if cache is missing or explicitly refreshed

**User store fields** (in `users` IndexedDB store):
- `firstname`
- `lastname`
- `profileUrl`

**Updated Session Restoration Flow:**
1. Receive refresh_token from client
2. Refresh tokens with Strava (1 API call)
3. Check IndexedDB for cached athlete info
4. If cached: use it for `strava_athlete` cookie (0 API calls)
5. If missing: fetch from Strava and cache (1 API call - rare)
6. Set cookies and return

**Result:** Session restoration typically uses **1 API call** instead of 2.

See TICKET-024 for implementation.

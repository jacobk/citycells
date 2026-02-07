# Authentication

## Overview

CityCells uses Strava OAuth 2.0 to authenticate users and access their walking activities. Authentication is required to fetch the user's GPS data for analysis against Malmö's sub-areas.

The authentication system supports **persistent sessions** - users connect once and stay authenticated across browser sessions until they explicitly log out or revoke access in Strava.

## User Stories

From [PRD 001](../PRD/001-mvp-mobile-walker.md):
- "As a user, I want to log in with my Strava account, so the app can access my walks."

## Implementation

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/strava.ts` | Strava API client, OAuth URL generation, token refresh, `getValidAccessToken()` |
| `src/lib/auth-persistence.ts` | Client-side token persistence logic (SQLite sync) |
| `src/lib/db.ts` | SQLite database with user token CRUD operations |
| `src/app/api/auth/login/route.ts` | Initiates OAuth flow by redirecting to Strava |
| `src/app/api/auth/callback/route.ts` | Handles OAuth callback, stores tokens in cookies + passes to client |
| `src/app/api/auth/restore-session/route.ts` | Restores session from SQLite tokens for returning users |
| `src/app/api/auth/logout/route.ts` | Clears cookies and signals client to clear SQLite tokens |
| `src/hooks/useStrava.ts` | React hook with persistent session support |

### Token Storage Architecture

Tokens are stored in two locations for different purposes:

| Storage | Location | Purpose |
|---------|----------|---------|
| HTTP-only Cookies | Server | API route authentication (short-lived, secure) |
| SQLite (IndexedDB) | Client | Persistence across sessions (long-lived) |

**Why dual storage?**
- Cookies provide secure server-side token access for API routes
- SQLite enables persistent authentication across browser sessions
- Short-lived cookies (1 hour) limit exposure if device is compromised
- SQLite tokens can restore the session seamlessly

### Data Flow

#### Initial OAuth Flow

```
┌──────────────┐     ┌─────────────────────┐     ┌─────────────────┐
│   User       │     │   CityCells App     │     │   Strava API    │
└──────┬───────┘     └──────────┬──────────┘     └────────┬────────┘
       │                        │                         │
       │ 1. Click "Connect"     │                         │
       │───────────────────────>│                         │
       │                        │                         │
       │                        │ 2. Redirect to Strava   │
       │<───────────────────────│────────────────────────>│
       │                        │                         │
       │ 3. User authorizes     │                         │
       │────────────────────────────────────────────────->│
       │                        │                         │
       │                        │ 4. Callback with code   │
       │<───────────────────────│<────────────────────────│
       │                        │                         │
       │                        │ 5. Exchange code        │
       │                        │────────────────────────>│
       │                        │                         │
       │                        │ 6. Access + Refresh     │
       │                        │<────────────────────────│
       │                        │                         │
       │ 7. Set cookies +       │                         │
       │    redirect with       │                         │
       │    token params        │                         │
       │<───────────────────────│                         │
       │                        │                         │
       │ 8. Client stores       │                         │
       │    tokens in SQLite    │                         │
       │───────────────────────>│                         │
       │                        │                         │
```

#### Returning User Flow

```
┌──────────────┐     ┌─────────────────────┐     ┌─────────────────┐
│   User       │     │   CityCells App     │     │   Strava API    │
└──────┬───────┘     └──────────┬──────────┘     └────────┬────────┘
       │                        │                         │
       │ 1. Opens app           │                         │
       │───────────────────────>│                         │
       │                        │                         │
       │ 2. Check SQLite        │                         │
       │    for stored tokens   │                         │
       │<───────────────────────│                         │
       │                        │                         │
       │ 3. POST /restore-session                         │
       │    with refresh_token  │                         │
       │───────────────────────>│                         │
       │                        │                         │
       │                        │ 4. Refresh with Strava  │
       │                        │────────────────────────>│
       │                        │                         │
       │                        │ 5. New tokens           │
       │                        │<────────────────────────│
       │                        │                         │
       │ 6. Set cookies +       │                         │
       │    return new tokens   │                         │
       │<───────────────────────│                         │
       │                        │                         │
       │ 7. Update SQLite       │                         │
       │    + fetch activities  │                         │
       │───────────────────────>│                         │
       │                        │                         │
```

### Key Functions

**`getOAuthUrl()` in `src/lib/strava.ts`**
Generates the Strava OAuth authorization URL with required scopes (`read,activity:read_all,read_all`).

**`getValidAccessToken()` in `src/lib/strava.ts`**
Centralized token validation for API routes:
- Checks if access token is still valid (with 5-minute buffer)
- Automatically refreshes if expired
- Returns valid token or null if re-auth required

**`GET /api/auth/callback`**
1. Receives authorization code from Strava
2. Exchanges code for access + refresh tokens
3. Stores tokens in HTTP-only cookies
4. Sets `strava_session` cookie with athlete ID (1 hour)
5. Redirects with token params for client-side SQLite storage

**`POST /api/auth/restore-session`**
1. Receives refresh_token from client (stored in SQLite)
2. Refreshes tokens with Strava API
3. Sets new HTTP-only cookies
4. Returns new tokens for client to update SQLite

**`useStrava()` hook**
- Checks for OAuth callback params (just logged in)
- Checks `strava_athlete` cookie for active session
- Attempts session restoration from SQLite if no active session
- Provides `login()`, `logout()`, `isRestoring` state

### Cookie Structure

| Cookie | HttpOnly | Max-Age | Purpose |
|--------|----------|---------|---------|
| `strava_access_token` | Yes | Token expiry | API authentication |
| `strava_refresh_token` | Yes | Persistent | Token renewal |
| `strava_expires_at` | Yes | Persistent | Token expiration tracking |
| `strava_session` | Yes | 1 hour | Session identifier (athlete ID) |
| `strava_athlete` | No | Persistent | UI display (name, profile pic) |

### SQLite Token Storage

Tokens are stored in the `users` table (see [ADR 004](../ADR/004-sqlite-storage.md)):

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  strava_id INTEGER UNIQUE NOT NULL,
  username TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at INTEGER,  -- Unix timestamp in seconds
  created_at TEXT DEFAULT (datetime('now'))
);
```

Key operations in `src/lib/db.ts`:
- `getUserByStravaId(stravaId)` - Check for stored user
- `updateUserTokens(stravaId, tokens)` - Store/update tokens
- `clearUserTokens(stravaId)` - Clear tokens on logout

## Rationale

### Why HTTP-only Cookies?

Access and refresh tokens are stored in HTTP-only cookies to prevent XSS attacks from stealing tokens via JavaScript. Only the `strava_athlete` cookie (containing non-sensitive display info) is accessible to client-side code.

### Why SQLite + Cookies (Dual Storage)?

Per [ADR 013](../ADR/013-persistent-strava-authentication.md):
- **Cookies** provide secure server-side access for API routes
- **SQLite** enables persistence across browser sessions
- **Short-lived session cookies** (1 hour) limit exposure window
- If cookie expires, SQLite tokens can restore the session

### Why Server-Side Token Exchange?

The OAuth code-to-token exchange happens server-side (`/api/auth/callback`) to:
1. Keep `client_secret` secure (never exposed to browser)
2. Maintain control over token storage
3. Enable automatic token refresh in API routes

### Why Read + Activity Scopes?

The `read,activity:read_all,read_all` scopes are required to:
- Access user's basic profile info
- Fetch all activities (including private ones)
- Read full GPS streams without privacy cropping (ADR 006)

### ADR References

- [ADR 001: Tech Stack](../ADR/001-tech-stack.md) - Decision to use Next.js API routes for OAuth
- [ADR 004: SQLite Storage](../ADR/004-sqlite-storage.md) - Database schema including `users` table for token storage
- [ADR 013: Persistent Strava Authentication](../ADR/013-persistent-strava-authentication.md) - Token persistence and automatic refresh strategy

## Security Considerations

| Risk | Mitigation |
|------|------------|
| Token theft from SQLite | IndexedDB is origin-sandboxed; tokens not accessible cross-origin |
| XSS accessing tokens | Tokens stored in HTTP-only cookies; SQLite not accessible via XSS |
| Stolen device | Short session cookies (1 hour) limit active window; user can revoke in Strava |
| Stale permissions | Refresh validates with Strava; revoked access immediately detected |

**Future enhancement**: Encrypt tokens at rest in SQLite using a derived key (noted in ADR 013).

## Current Limitations

1. **Single user assumption**: No multi-user support. Data is per-browser session.

2. **No cross-device sync**: Tokens are per-browser (consistent with ADR 004 local-first philosophy).

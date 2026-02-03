# Authentication

## Overview

CityCells uses Strava OAuth 2.0 to authenticate users and access their walking activities. Authentication is required to fetch the user's GPS data for analysis against Malmö's sub-areas.

## User Stories

From [PRD 001](../PRD/001-mvp-mobile-walker.md):
- "As a user, I want to log in with my Strava account, so the app can access my walks."

## Implementation

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/strava.ts` | Strava API client configuration, OAuth URL generation, token refresh |
| `src/app/api/auth/login/route.ts` | Initiates OAuth flow by redirecting to Strava |
| `src/app/api/auth/callback/route.ts` | Handles OAuth callback, stores tokens in cookies |
| `src/app/api/auth/logout/route.ts` | Clears authentication cookies |
| `src/hooks/useStrava.ts` | React hook for accessing auth state and activities |

### Data Flow

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
       │ 7. Set cookies         │                         │
       │<───────────────────────│                         │
       │                        │                         │
```

### Key Functions

**`getOAuthUrl()` in `src/lib/strava.ts`**
Generates the Strava OAuth authorization URL with required scopes (`read,activity:read_all`).

**`GET /api/auth/callback`**
1. Receives authorization code from Strava
2. Exchanges code for access + refresh tokens
3. Stores tokens in HTTP-only cookies (secure)
4. Stores basic athlete info in readable cookie (for UI display)
5. Redirects to home page

**`useStrava()` hook**
- Checks for `strava_athlete` cookie on mount
- Fetches activities if authenticated
- Provides `login()` and `logout()` functions

### Cookie Structure

| Cookie | HttpOnly | Purpose |
|--------|----------|---------|
| `strava_access_token` | Yes | API authentication |
| `strava_refresh_token` | Yes | Token renewal |
| `strava_expires_at` | Yes | Token expiration tracking |
| `strava_athlete` | No | UI display (name, profile pic) |

## Rationale

### Why HTTP-only Cookies?

Access and refresh tokens are stored in HTTP-only cookies to prevent XSS attacks from stealing tokens via JavaScript. Only the `strava_athlete` cookie (containing non-sensitive display info) is accessible to client-side code.

### Why Server-Side Token Exchange?

The OAuth code-to-token exchange happens server-side (`/api/auth/callback`) to:
1. Keep `client_secret` secure (never exposed to browser)
2. Maintain control over token storage
3. Enable automatic token refresh in API routes

### Why Read + Activity Scopes?

The `read,activity:read_all` scopes are the minimum required to:
- Access user's basic profile info
- Fetch all activities (including private ones)
- Read GPS polylines for analysis

### ADR References

- [ADR 001: Tech Stack](../ADR/001-tech-stack.md) - Decision to use Next.js API routes for OAuth

## Current Limitations

1. **No automatic token refresh on client**: If the access token expires mid-session, the user must re-login. Future improvement: implement transparent refresh in `/api/activities`.

2. **No persistent login**: Tokens are in cookies which expire. Future: consider longer-lived refresh tokens or SQLite storage (ADR 004).

3. **Single user assumption**: No multi-user support. Data is per-browser session.

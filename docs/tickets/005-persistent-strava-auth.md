# TICKET-005: Persistent Strava Authentication

**Related:** ADR 013, PRD Section 2 (Core Stories), ADR 004  
**Feature:** Authentication  
**Status:** Ready for Implementation  
**Created:** 2026-02-07

## Context to Load

Files the implementation agent MUST read first:

1. `docs/ADR/013-persistent-strava-authentication.md` - Full token flow, refresh logic, security considerations
2. `docs/ADR/004-sqlite-storage.md` - Database schema (users table already defined)
3. `docs/features/authentication.md` - Current implementation details and file locations
4. `src/lib/strava.ts` - Current Strava API client and OAuth URL generation
5. `src/app/api/auth/callback/route.ts` - Current OAuth callback (stores tokens in cookies)
6. `src/hooks/useStrava.ts` - Current auth state hook
7. `src/lib/db/` - SQLite database utilities (if exists)

## Implementation Checklist

### 1. Update OAuth Callback to Store Tokens in SQLite

Modify `/api/auth/callback` to:
- Store `access_token`, `refresh_token`, `token_expires_at` in `users` table
- Create user record if first login, update if returning
- Set short-lived session cookie with Strava athlete ID only
- Reference ADR 013 "Token Storage Strategy" section

### 2. Implement Token Refresh Utility

Create a utility function (in `src/lib/strava.ts` or new file):
- `getValidAccessToken(athleteId)` - Returns valid token or null
- Check expiration with 5-minute buffer
- Call Strava refresh endpoint if expired
- Update SQLite with new tokens
- Handle refresh failure (clear tokens, return null)
- Reference ADR 013 "Automatic Token Refresh" pseudocode

### 3. Update API Routes to Use Token Refresh

Modify activity-fetching API routes to:
- Get athlete ID from session cookie
- Use `getValidAccessToken()` instead of cookie token directly
- Handle null return (401 response, trigger client re-auth)

### 4. Update Client Auth Hook

Modify `useStrava.ts` to:
- Check SQLite for existing user on mount (before cookie check)
- If user found with tokens, attempt silent validation
- Set authenticated state based on SQLite, not just cookie
- Provide clear "logged out" state when tokens are cleared

### 5. Handle Returning User Flow

Ensure page load flow:
- Initialize SQLite database
- Check for existing user record with valid refresh token
- If found: user is considered authenticated, fetch data
- If access token expired: background refresh before API calls
- If refresh fails: clear tokens, show "Connect with Strava"

### 6. Update Logout to Clear SQLite Tokens

Modify logout flow:
- Clear tokens from SQLite `users` table (set to NULL)
- Clear session cookie
- User record can remain (for potential re-auth mapping)

## Acceptance Criteria

- [ ] User connects to Strava once, closes browser, reopens - still authenticated
- [ ] Access token expiry triggers automatic refresh (no user action)
- [ ] Refresh token revocation (in Strava settings) shows "Connect" button on next load
- [ ] Logout clears both SQLite tokens and cookies
- [ ] No tokens stored in JavaScript-accessible cookies (security)
- [ ] Works across browser restarts (tokens persist in IndexedDB)

## Files to Modify

| File | Change |
|------|--------|
| `src/app/api/auth/callback/route.ts` | Store tokens in SQLite, set session-only cookie |
| `src/lib/strava.ts` | Add `getValidAccessToken()` with refresh logic |
| `src/app/api/auth/logout/route.ts` | Clear SQLite tokens in addition to cookies |
| `src/hooks/useStrava.ts` | Check SQLite for auth state on mount |
| `src/app/api/activities/route.ts` | Use token refresh utility |
| `src/lib/db/` (if exists) | Ensure user CRUD operations available |
| NEW: `src/lib/auth-persistence.ts` | Optional: centralize token persistence logic |

## Notes

- Do NOT duplicate ADR/PRD content - reference it
- The `users` table schema already exists in ADR 004 - no migration needed
- Session cookie should be short-lived (1 hour) per ADR 013
- Consider adding `// WHY:` comments for security decisions in code

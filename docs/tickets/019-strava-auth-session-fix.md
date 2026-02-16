# TICKET-019: Fix Strava Authentication Session Loss

**Related:** ADR 013 (2026-02-16 Update), PRD Section 2.1  
**Feature:** Authentication  
**Status:** Ready for Implementation  
**Created:** 2026-02-16

## Context to Load

Files the implementation agent MUST read first:

1. `docs/ADR/013-persistent-strava-authentication.md` - Token persistence strategy and 2026-02-16 cookie clarification
2. `docs/features/authentication.md` - Current implementation details and limitation #3
3. `src/app/api/auth/callback/route.ts` - OAuth callback that sets initial cookies (main fix location)
4. `src/app/api/auth/restore-session/route.ts` - Session restoration endpoint (missing strava_athlete cookie)
5. `src/hooks/useStrava.ts` - Client-side session detection and restoration logic

## Problem Summary

Strava authentication is lost after a while due to:

1. **Session cookies without `maxAge`**: `strava_refresh_token`, `strava_expires_at`, and `strava_athlete` are set without `maxAge`, making them session cookies that are deleted when the browser closes
2. **Missing `strava_athlete` in restore-session**: The `/api/auth/restore-session` endpoint refreshes tokens but does not re-set the `strava_athlete` cookie, causing the useStrava hook to fail session restoration
3. **No fallback for lost athlete ID**: If all identifying cookies are gone, there's no way to query SQLite for stored users (though this is lower priority given single-user assumption)

## Implementation Checklist

### 1. Add `maxAge` to cookies in `/api/auth/callback/route.ts`

Update cookie settings for persistent cookies. Use 30 days (2592000 seconds) per ADR 013 clarification.

Cookies to update:
- `strava_refresh_token` - Add `maxAge: 2592000`
- `strava_expires_at` - Add `maxAge: 2592000`
- `strava_athlete` - Add `maxAge: 2592000`

Note: `strava_access_token` should match token expiry (`expires_in`), and `strava_session` stays at 1 hour (3600).

### 2. Set `strava_athlete` cookie in `/api/auth/restore-session/route.ts`

After successfully refreshing tokens with Strava, the endpoint must also set the `strava_athlete` cookie with athlete info. This requires either:
- Passing athlete info in the restore request from client
- Or making a Strava API call to `/athlete` to get profile data

Recommend: Pass athlete info from client (already has it in SQLite or can include in request).

### 3. Update useStrava hook if needed

Review the session restoration flow in `useStrava.ts` to ensure it works correctly once cookies have proper lifetimes. May need to pass athlete info to restore-session endpoint.

### 4. Update feature documentation

After implementation, update `docs/features/authentication.md`:
- Remove limitation #3 (session cookies cause auth loss)
- Verify Cookie Structure table matches implementation

## Maintainability

Before implementing, review for:

- [x] **Refactor opportunity?** Cookie settings could be centralized in a shared config/utility
- [ ] **DRY check** - Cookie setting logic is duplicated between callback and restore-session routes
- [ ] **Modularity** - Consider a `setCookies()` helper function in `src/lib/strava.ts` or new `src/lib/auth-cookies.ts`
- [ ] **Debt impact** - This fixes technical debt from incomplete cookie configuration

**Recommended refactoring:** Create a shared cookie configuration object and helper function to reduce duplication and ensure consistency:

```typescript
// Example structure in src/lib/auth-cookies.ts
export const COOKIE_CONFIG = {
  accessToken: { name: 'strava_access_token', httpOnly: true, secure: true },
  refreshToken: { name: 'strava_refresh_token', httpOnly: true, secure: true, maxAge: 2592000 },
  // ... etc
};

export function setAuthCookies(cookieStore, tokens, athlete) { ... }
```

## Acceptance Criteria

- [ ] User stays authenticated after closing and reopening browser
- [ ] User stays authenticated after `strava_session` cookie expires (1 hour)
- [ ] Session restoration works correctly when returning to app
- [ ] All cookie `maxAge` values match ADR 013 specification
- [ ] `strava_athlete` cookie is set by both callback and restore-session endpoints

## Files to Modify

| File | Change |
|------|--------|
| `src/app/api/auth/callback/route.ts` | Add `maxAge` to refresh_token, expires_at, and athlete cookies |
| `src/app/api/auth/restore-session/route.ts` | Set `strava_athlete` cookie after successful refresh |
| `src/hooks/useStrava.ts` | Pass athlete info to restore-session if needed |
| NEW: `src/lib/auth-cookies.ts` (optional) | Centralized cookie configuration and helper |
| `docs/features/authentication.md` | Remove limitation #3 after fix is verified |

## Notes

- Do NOT duplicate ADR/PRD content - reference ADR 013 (2026-02-16 Update)
- Test by: Login -> close browser -> reopen -> verify still authenticated
- Test by: Login -> wait >1 hour -> refresh page -> verify session restored

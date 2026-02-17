# TICKET-024: Cache Athlete Info in SQLite

**Related:** ADR 013 (2026-02-17 Update)  
**Feature:** Authentication  
**Status:** Ready for Implementation  
**Created:** 2026-02-17

## Context to Load

Files the implementation agent MUST read first:

1. `docs/ADR/013-persistent-strava-authentication.md` - Section "2026-02-17: Athlete Info Caching Optimization" for the design
2. `docs/features/authentication.md` - Current implementation details, especially "Returning User Flow"
3. `src/lib/db.ts` - SQLite database operations for users table
4. `src/app/api/auth/restore-session/route.ts` - Currently fetches athlete from Strava every time
5. `src/app/api/auth/callback/route.ts` - Where athlete info is first received from OAuth

## Implementation Checklist

### 1. Extend SQLite Schema

Add athlete info columns to the `users` table. Per ADR 013 update, add:
- `firstname TEXT`
- `lastname TEXT`
- `profile_url TEXT`

Update the schema in `src/lib/db.ts` and handle migration for existing users.

### 2. Update `updateUserTokens()` Function

Modify `src/lib/db.ts` to accept optional athlete info when updating tokens:
- Add optional parameters for firstname, lastname, profile_url
- Update INSERT/UPDATE statements to include these columns

### 3. Update OAuth Callback

Modify `src/app/api/auth/callback/route.ts` to store athlete info in SQLite:
- After successful OAuth, pass athlete info to `updateUserTokens()` or similar
- The athlete data is already available from the OAuth response (`payload.athlete`)

### 4. Update Session Restoration

Modify `src/app/api/auth/restore-session/route.ts`:
- After token refresh, check SQLite for cached athlete info
- If cached info exists: use it for `strava_athlete` cookie (skip Strava API call)
- If missing: fetch from Strava, cache it, then set cookie
- Update `updateUserTokens()` call to include athlete info when fetched

### 5. Update Type Definitions

Ensure TypeScript types reflect the new schema:
- Update `UserRow` type in `src/lib/db.ts` to include athlete fields
- Update any related interfaces

## Maintainability

Before implementing, review for:

- [x] **Refactor opportunity?** The athlete info storage could use the same `updateUserTokens` function - avoid creating a separate function
- [x] **DRY check** - Athlete info is currently built in two places (callback + restore-session). Consolidate the `AthleteInfo` type usage
- [x] **Modularity** - Keep the "fetch athlete if missing" logic as a separate helper function for clarity
- [x] **Debt impact** - This reduces technical debt by eliminating unnecessary API calls

**Specific items:**
- The `AthleteInfo` type in `auth-cookies.ts` should be reused for the cached data structure
- Consider a helper function `getOrFetchAthleteInfo(stravaId, accessToken)` that handles the cache-or-fetch logic

## Acceptance Criteria

- [ ] Session restoration uses 1 Strava API call (token refresh) instead of 2 when athlete info is cached
- [ ] New users have athlete info stored in SQLite after first OAuth
- [ ] Existing users get athlete info cached on their next session restoration (one-time fetch)
- [ ] `strava_athlete` cookie is correctly populated from cached data
- [ ] No regression: UI still shows correct user name and profile picture

## Files to Modify

| File | Change |
|------|--------|
| `src/lib/db.ts` | Add athlete columns to schema, update `updateUserTokens()`, add `UserRow` type fields |
| `src/app/api/auth/callback/route.ts` | Store athlete info in SQLite after OAuth |
| `src/app/api/auth/restore-session/route.ts` | Use cached athlete info, skip Strava API call if available |
| `docs/features/authentication.md` | Update "Returning User Flow" diagram and implementation details |

## Notes

- Do NOT duplicate ADR content - the schema and flow are documented in ADR 013 (2026-02-17 Update)
- Migration: Use `ALTER TABLE` with `IF NOT EXISTS` pattern or check column existence before adding
- The Strava athlete fetch should remain as a fallback for edge cases (missing data, corrupted cache)

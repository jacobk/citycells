# TICKET-009: Vercel Deployment Setup

**Related:** ADR 016, PRD Section 3.2 (Authentication & Data)  
**Feature:** Deployment  
**Status:** Ready for Implementation  
**Created:** 2026-02-07

## Context to Load

Files the implementation agent MUST read first:

1. `docs/ADR/016-vercel-deployment.md` - Platform selection, architecture, and configuration requirements
2. `docs/PRD/001-mvp-mobile-walker.md` Section 3.2 - Authentication requirements that depend on deployment
3. `docs/features/deployment.md` - Deployment feature overview and rationale
4. `src/lib/requestOrigin.ts` - Already handles Vercel proxy headers (verify compatibility)
5. `src/lib/strava.ts` - Environment variable usage (STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_REDIRECT_URI)
6. `.env.local` - Current environment variable values (for reference, do not commit)

## Implementation Checklist

### 1. Create Vercel Account and Connect Repository

- Sign up for Vercel account at [vercel.com](https://vercel.com) (use GitHub OAuth for easier integration)
- Install Vercel CLI locally (optional but recommended): `npm install -g vercel`
- In Vercel dashboard, import `citycells` GitHub repository
- Configure project settings:
  - Framework Preset: Next.js (auto-detected)
  - Root Directory: `./` (default)
  - Build Command: `npm run build` (auto-detected)
  - Output Directory: `.next` (auto-detected)
  - Install Command: `npm install` (auto-detected)

### 2. Configure Environment Variables

- Go to Vercel Project Settings → Environment Variables
- Add the following variables for **Production**, **Preview**, and **Development** environments:
  - `STRAVA_CLIENT_ID`: `217` (from `.env.local`)
  - `STRAVA_CLIENT_SECRET`: `967dace825ded99d9e0754bf5636d164bbf721b1` (from `.env.local`)
- **Note**: `STRAVA_REDIRECT_URI` will be set after first deployment (see step 3)

### 3. Initial Deployment and OAuth Configuration

- Trigger initial deployment (will fail without `STRAVA_REDIRECT_URI`, that's expected)
- After deployment, note the Vercel-provided URL (e.g., `citycells-xyz.vercel.app`)
- Add environment variable:
  - `STRAVA_REDIRECT_URI`: `https://{your-vercel-url}.vercel.app/api/auth/callback`
- Update Strava OAuth App Settings:
  - Go to [Strava API Settings](https://www.strava.com/settings/api)
  - Find your application
  - Update "Authorization Callback Domain" to: `{your-vercel-url}.vercel.app`
  - Or add full redirect URI: `https://{your-vercel-url}.vercel.app/api/auth/callback`
  - Save changes
- Redeploy application (trigger new deployment or push a commit)

### 4. Verify Deployment

- Check build logs in Vercel dashboard for successful build
- Visit deployed URL and verify:
  - Application loads correctly
  - Map displays with sub-areas
  - "Connect with Strava" button works
  - OAuth flow completes successfully
  - Activities load after authentication
- Test API routes:
  - `/api/auth/login` redirects to Strava
  - `/api/auth/callback` handles OAuth callback
  - `/api/activities` returns data when authenticated

### 5. Update Documentation

- Update `README.md` with deployment URL and deployment instructions
- Add deployment section to `README.md` explaining how to deploy
- Document environment variable setup process

## Maintainability

Before implementing, review for:

- [ ] **Refactor opportunity?** Verify `requestOrigin.ts` correctly handles Vercel proxy headers (already implemented, just verify)
- [ ] **DRY check** - Environment variable access is centralized in `src/lib/strava.ts` (no changes needed)
- [ ] **Modularity** - Deployment configuration is separate from application code (good separation)
- [ ] **Debt impact** - This reduces technical debt by providing production deployment (positive impact)

**No refactoring needed**: The codebase is already structured for deployment. `requestOrigin.ts` handles proxy headers, and environment variables are accessed through a single module.

## Acceptance Criteria

- [ ] Vercel account created and GitHub repository connected
- [ ] Initial deployment completes successfully (may fail OAuth without redirect URI, that's expected)
- [ ] Environment variables configured in Vercel dashboard for all environments (Production, Preview, Development)
- [ ] `STRAVA_REDIRECT_URI` set to correct Vercel URL
- [ ] Strava OAuth app callback domain updated to match Vercel URL
- [ ] Application accessible at Vercel-provided URL
- [ ] OAuth login flow works end-to-end (user can authenticate with Strava)
- [ ] API routes function correctly (`/api/activities` returns data when authenticated)
- [ ] Map displays correctly with sub-areas
- [ ] `README.md` updated with deployment information

## Files to Modify

| File | Change |
|------|--------|
| `README.md` | Add deployment section with Vercel setup instructions and deployment URL |
| `.gitignore` | Already includes `.vercel/` directory (no change needed) |
| `next.config.ts` | Already compatible with Vercel (no changes needed) |
| `src/lib/requestOrigin.ts` | Already handles Vercel proxy headers (verify, no changes needed) |

## Notes

- Do NOT commit `.env.local` or environment variable values to repository
- `.vercel/` directory is auto-generated and already in `.gitignore`
- First deployment will fail OAuth without `STRAVA_REDIRECT_URI` - this is expected
- After setting `STRAVA_REDIRECT_URI`, redeploy to apply changes
- Vercel automatically creates preview deployments for pull requests (useful for testing)
- Custom domain can be added later in Vercel project settings if desired

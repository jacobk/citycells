# ADR 016: Vercel Deployment Platform

**Date:** 2026-02-07
**Status:** Accepted
**Supersedes:** N/A

## Context

CityCells is currently developed locally using Next.js development server. To make the application accessible to users, we need to deploy it to a hosting platform. The application has specific requirements:

1. **Server-side API routes**: OAuth callback, token refresh, and Strava API proxying require a Node.js server
2. **Static assets**: Map tiles, GeoJSON files, WASM binaries need reliable CDN delivery
3. **Environment variables**: Strava OAuth credentials must be securely stored server-side
4. **Cost constraints**: Free tier preferred for MVP
5. **Developer experience**: Simple deployment workflow, automatic builds from GitHub
6. **Next.js compatibility**: Platform must support Next.js App Router and serverless functions

**Current state**: Application runs locally on `localhost:3000` with environment variables in `.env.local`. No production deployment exists.

**Constraints**:
- OAuth callback requires a publicly accessible URL
- Token refresh requires `client_secret` which cannot be exposed client-side
- Next.js API routes must run as serverless functions or Node.js server
- GitHub Pages only supports static sites (not suitable for API routes)

## Decision

We will deploy CityCells to **Vercel** as a unified Next.js application (frontend + backend API routes).

### Platform Selection: Vercel

**Why Vercel over alternatives:**

| Platform | Pros | Cons | Decision |
|----------|------|------|----------|
| **Vercel** | Built for Next.js, zero-config, free tier generous, automatic deployments, environment variables, serverless functions | Vendor lock-in (minor) | ✅ **Selected** |
| GitHub Pages | Free, simple | Static only (no API routes), requires separate backend | ❌ Rejected |
| Netlify | Good Next.js support, free tier | Less Next.js-optimized than Vercel | ⚠️ Alternative |
| Railway | Simple deployment | Limited free tier ($5/month credit) | ❌ Rejected |
| Render | Free tier available | Spins down after inactivity | ❌ Rejected |

**Vercel advantages:**
- **Zero configuration**: Next.js projects deploy automatically with optimal settings
- **Free tier**: Unlimited serverless functions, 100GB bandwidth/month, sufficient for MVP
- **GitHub integration**: Automatic deployments on push to `main` branch
- **Environment variables**: Secure server-side storage with per-environment configuration
- **Edge network**: Global CDN for static assets and edge functions
- **Built-in analytics**: Performance monitoring and error tracking

### Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Vercel Platform                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Next.js Application (Single Deployment)             │  │
│  │                                                       │  │
│  │  ┌──────────────────┐    ┌────────────────────────┐ │  │
│  │  │  Static Assets   │    │  Serverless Functions  │ │  │
│  │  │  (CDN)           │    │  (API Routes)          │ │  │
│  │  │                  │    │                        │ │  │
│  │  │  - HTML/JS/CSS   │    │  - /api/auth/*         │ │  │
│  │  │  - Map tiles     │    │  - /api/activities/*   │ │  │
│  │  │  - GeoJSON       │    │                        │ │  │
│  │  │  - WASM files    │    │                        │ │  │
│  │  └──────────────────┘    └────────────────────────┘ │  │
│  │                                                       │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  Environment Variables (Server-side only):                 │
│  - STRAVA_CLIENT_ID                                        │
│  - STRAVA_CLIENT_SECRET                                    │
│  - STRAVA_REDIRECT_URI                                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Configuration Requirements

**Environment Variables** (set in Vercel dashboard):
- `STRAVA_CLIENT_ID`: Strava OAuth client ID
- `STRAVA_CLIENT_SECRET`: Strava OAuth client secret (server-side only)
- `STRAVA_REDIRECT_URI`: OAuth callback URL (e.g., `https://citycells.vercel.app/api/auth/callback`)

**Strava OAuth App Settings**:
- Update "Authorization Callback Domain" to Vercel domain (e.g., `citycells.vercel.app`)
- Or add full redirect URI: `https://citycells.vercel.app/api/auth/callback`

**Next.js Configuration**:
- No changes required to `next.config.ts` (already compatible)
- `requestOrigin.ts` already handles Vercel proxy headers (`x-forwarded-host`, `x-forwarded-proto`)

### Deployment Workflow

1. **Initial Setup**:
   - Connect GitHub repository to Vercel
   - Configure environment variables in Vercel dashboard
   - Update Strava OAuth callback domain
   - Deploy (automatic on first import)

2. **Ongoing Deployments**:
   - Push to `main` branch → Automatic production deployment
   - Pull requests → Preview deployments (with unique URLs)
   - Manual redeploy available in dashboard

3. **Environment Management**:
   - Production: Uses production environment variables
   - Preview: Uses preview environment variables (can differ)
   - Development: Local `.env.local` for development

### Domain Configuration

**Default**: Vercel provides `{project-name}.vercel.app` domain

**Custom Domain** (optional, future):
- Add custom domain in Vercel project settings
- Configure DNS records as instructed
- Update `STRAVA_REDIRECT_URI` to match custom domain

## Consequences

### Positive

- **Zero-config deployment**: Next.js projects work out-of-the-box
- **Automatic builds**: GitHub integration eliminates manual deployment steps
- **Free tier sufficient**: 100GB bandwidth/month covers MVP traffic
- **Unified deployment**: Frontend and backend in single deployment (simpler than hybrid approach)
- **Fast global CDN**: Static assets served from edge locations worldwide
- **Built-in monitoring**: Error tracking and performance analytics included
- **Preview deployments**: Test changes before merging to production

### Negative

- **Vendor lock-in**: Vercel-specific features (edge functions, analytics) tie us to platform
- **Cold starts**: Serverless functions may have ~100-500ms cold start on first request (acceptable for MVP)
- **Build time limits**: Free tier has build time limits (sufficient for current project size)
- **No persistent storage**: Serverless functions are stateless (not an issue - we use client-side SQLite)

### Technical

- **Environment variables**: Must be configured in Vercel dashboard (not in code)
- **OAuth redirect URI**: Must match exactly between Vercel URL and Strava settings
- **Proxy headers**: `requestOrigin.ts` already handles Vercel's `x-forwarded-host` and `x-forwarded-proto` headers
- **WASM headers**: `next.config.ts` headers for sql.js should work, but verify in production
- **Build output**: Vercel automatically optimizes Next.js build (no manual configuration needed)

### Maintainability

- **Deployment process**: Simplified to "push to GitHub" - reduces deployment complexity
- **Environment management**: Centralized in Vercel dashboard (easier than managing multiple `.env` files)
- **Monitoring**: Built-in error tracking reduces need for external logging services
- **Testing**: Preview deployments enable testing changes before production (reduces risk)
- **Documentation**: Deployment process is well-documented by Vercel (reduces maintenance burden)

## Future Considerations

- **Custom domain**: Add custom domain for branding (requires DNS configuration)
- **Analytics**: Leverage Vercel Analytics for user behavior tracking
- **Edge functions**: Consider moving some API routes to Edge Runtime for lower latency
- **Multi-region**: Vercel supports multi-region deployment if needed for global scale

# Deployment

## Overview

CityCells is deployed to Vercel as a unified Next.js application. The deployment includes both the frontend React application and server-side API routes for Strava OAuth and data fetching. Vercel provides automatic deployments from GitHub, serverless function hosting for API routes, and global CDN for static assets.

This feature ensures the application is publicly accessible and handles production requirements including environment variable management, OAuth callback URLs, and serverless function execution.

## User Stories

From [PRD 001](../PRD/001-mvp-mobile-walker.md):
- *Implicit requirement*: Users need the application to be accessible via a public URL to use Strava OAuth and access their data

## Implementation

> **Note:** This section is completed by the implementation agent.

### Key Files

| File | Purpose |
|------|---------|
| `.vercel/` | Vercel project configuration (auto-generated) |
| `.env.local` | Local development environment variables (not deployed) |
| `next.config.ts` | Next.js configuration (compatible with Vercel) |
| `src/lib/requestOrigin.ts` | Handles Vercel proxy headers for OAuth redirects |

### Data Flow

```
GitHub Repository
    │
    │ (push to main)
    ▼
Vercel Build System
    │
    │ (reads package.json, next.config.ts)
    ▼
Next.js Build
    │
    ├─► Static Assets (HTML, JS, CSS, images)
    │   └─► Vercel CDN (global edge network)
    │
    └─► Serverless Functions (API routes)
        └─► Vercel Serverless Runtime
            │
            ├─► /api/auth/* (OAuth, token refresh)
            ├─► /api/activities/* (Strava API proxy)
            └─► Environment Variables (server-side only)
```

### Key Functions

**Deployment Process:**
1. GitHub push triggers Vercel build
2. Vercel runs `npm install` and `npm run build`
3. Static assets uploaded to CDN
4. API routes packaged as serverless functions
5. Environment variables injected at runtime
6. Application accessible at `{project}.vercel.app`

**OAuth Flow in Production:**
1. User clicks "Connect with Strava"
2. Redirects to Strava OAuth (using `STRAVA_REDIRECT_URI` from environment)
3. Strava redirects to `/api/auth/callback` on Vercel domain
4. Serverless function exchanges code for tokens (using `STRAVA_CLIENT_SECRET`)
5. Tokens stored in HTTP-only cookies and SQLite
6. User redirected to app home page

## Rationale

### Design Decisions

**Why Vercel over GitHub Pages + separate backend:**
- GitHub Pages only supports static sites, requiring a separate backend deployment
- Unified deployment simplifies configuration and reduces operational overhead
- Vercel's free tier is sufficient for MVP and eliminates hosting costs

**Why serverless functions over traditional server:**
- Automatic scaling (no server management)
- Pay-per-use pricing (free tier covers MVP)
- Built-in edge network for low latency
- Zero server maintenance

**Why environment variables in Vercel dashboard:**
- Security: Secrets never committed to repository
- Per-environment configuration (production vs preview)
- Easy updates without code changes
- Vercel manages secret rotation and security

**Why `requestOrigin.ts` handles proxy headers:**
- Vercel uses reverse proxy architecture
- `request.url` contains internal URL, not public URL
- OAuth redirects must use public URL to keep user on correct domain
- `x-forwarded-host` and `x-forwarded-proto` headers provide public origin

### ADR References

- [ADR 016: Vercel Deployment Platform](../ADR/016-vercel-deployment.md) - Platform selection and architecture decision
- [ADR 001: Tech Stack](../ADR/001-tech-stack.md) - Next.js framework choice enables Vercel deployment
- [ADR 013: Persistent Strava Authentication](../ADR/013-persistent-strava-authentication.md) - OAuth callback and token refresh require server-side execution

## Current Limitations

1. **Cold starts**: Serverless functions may have ~100-500ms cold start latency on first request after inactivity (acceptable for MVP)
2. **Build time limits**: Free tier has build time limits (sufficient for current project, may need upgrade if project grows significantly)
3. **Vendor lock-in**: Vercel-specific features (edge functions, analytics) create platform dependency
4. **No persistent server storage**: Serverless functions are stateless (not an issue - we use client-side SQLite per ADR 004)
5. **Environment variable management**: Must be configured manually in Vercel dashboard (no infrastructure-as-code for secrets)

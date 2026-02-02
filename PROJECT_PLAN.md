# CityCells Project Plan

## Phase 1: Setup & Documentation
- [x] Create project structure
- [x] ADR 001: Tech Stack
- [x] PRD 001: MVP Definition
- [x] Initialize Next.js App
- [x] Configure Tailwind CSS
- [x] Setup Git repository

## Phase 2: Core Map Implementation
- [x] Install dependencies (`leaflet`, `react-leaflet`, `@turf/turf`, `strava-v3`)
- [x] Create `Map` component (handle Next.js SSR dynamic import)
- [x] Render Malmö Sub-areas (GeoJSON)
- [x] Add User Location support
- [ ] Polish Map UI for Mobile

## Phase 3: Backend & Strava Integration
- [ ] Register Strava Application
- [ ] Create `.env.local` for secrets
- [ ] Implement OAuth API Route (`/api/auth/login`, `/api/auth/callback`)
- [ ] Implement Session Management (Cookies)
- [ ] Implement Activities API (`/api/activities`) with filtering

## Phase 4: Analysis Engine
- [ ] Implement Turf.js Geometry Utilities
- [ ] Create `calculateCoverage(activity, area)` function
- [ ] Integrate Analysis with Frontend State

## Phase 5: UI Polish & Deployment
- [ ] Create Progress Dashboard / Drawer
- [ ] Add Loading States & Error Handling
- [ ] Final Testing
- [ ] Deployment Instructions

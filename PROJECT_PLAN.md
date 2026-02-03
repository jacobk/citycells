# CityCells Project Plan

## Phase 0: Documentation Foundation
- [x] Update AGENTS.md with documentation protocols (1.4 Feature Docs, 1.5 Code Rationale)
- [x] Create `docs/features/` directory structure
- [x] Create `docs/features/README.md` (feature index)
- [x] Backfill `docs/features/authentication.md`
- [x] Backfill `docs/features/map-visualization.md`

## Phase 1: Setup & Documentation
- [x] Create project structure
- [x] ADR 001: Tech Stack
- [x] PRD 001: MVP Definition
- [x] Initialize Next.js App
- [x] Configure Tailwind CSS
- [x] Setup Git repository
- [x] ADR 002: Exclusive Activity Matching
- [x] ADR 003: Multi-Metric Completion Scoring
- [x] ADR 004: SQLite Storage Architecture
- [x] Update PRD 001: Hover, Details Panel, Exemptions

## Phase 2: Core Map Implementation
- [x] Install dependencies (`leaflet`, `react-leaflet`, `@turf/turf`, `strava-v3`)
- [x] Create `Map` component (handle Next.js SSR dynamic import)
- [x] Render Malmö Sub-areas (GeoJSON)
- [x] Add User Location support
- [ ] Polish Map UI for Mobile

## Phase 3: Backend & Strava Integration
- [x] Register Strava Application
- [x] Create `.env.local` for secrets
- [x] Implement OAuth API Route (`/api/auth/login`, `/api/auth/callback`)
- [x] Implement Session Management (Cookies)
- [x] Implement Activities API (`/api/activities`) with filtering

## Phase 3.5: Database Setup (ADR 004)
- [x] Install `sql.js` dependency
- [x] Configure WASM loading in Next.js
- [x] Create database initialization module (`src/lib/db.ts`)
- [x] Implement IndexedDB persistence layer
- [x] Create database schema migration script
- [x] Seed `areas` table from GeoJSON on first load
- [x] Add database export/import utilities
- [x] Create `useDatabase` React hook (`src/hooks/useDatabase.ts`)
- [x] Create `docs/features/data-persistence.md`

## Phase 4: Analysis Engine (ADR 003)

### 4.1 Core Metrics
- [x] Implement Turf.js Geometry Utilities
- [x] Refactor `calculateCoverage()` → `calculatePerimeterCoverage()`
- [x] Implement `calculateAreaCoverage()` (polygon intersection)
- [x] Implement `calculateRMSE()` (alignment error)
- [x] Implement `calculateEfficiency()`
- [x] Implement loop detection (start/end distance check)
- [x] Implement composite quality score calculation
- [x] Implement tier assignment logic
- [x] Create `docs/features/analysis-engine.md`

### 4.2 Deviation Detection
- [x] Implement deviation detection algorithm
- [x] Calculate deviation metrics (border_gap, detour_distance, etc.)
- [x] Implement classification heuristic (obstacle_avoidance, shortcut, drift)

### 4.3 Scoring & Storage
- [x] Create `calculateAnalysis(walk, area)` returning all metrics
- [x] Implement composite quality score calculation
- [x] Implement tier assignment logic
- [x] Store analysis results in `walk_analyses` table (via `analysis-persistence.ts`)
- [x] Store deviations in `deviations` table (via `analysis-persistence.ts`)
- [x] Update `area_completions` table with best scores (via `analysis-persistence.ts`)

### 4.4 Exemption System
- [x] Create exemption service (`src/lib/exemptions.ts`)
- [x] Implement `addExemption(deviationId, reason)`
- [x] Implement `removeExemption(deviationId)`
- [x] Implement score recalculation on exemption change
- [x] Update `walk_analyses` with adjusted scores
- [x] Create `docs/features/exemption-system.md`

## Phase 5: UI Components

### 5.1 Map Visualization
- [x] Update area styling to use tier colors (ADR 003)
- [x] Implement completed area fill with opacity (0.4 per PRD)
- [x] Add border color matching tier
- [x] Update progress bar to show tier breakdown
- [x] Add score breakdown to area popups

### 5.2 Hover Tooltip
- [x] Create `AreaTooltip` component
- [x] Implement desktop hover handler
- [x] Implement mobile long-press handler (500ms)
- [x] Display: name, tier badge, score, walk count, best walk link
- [x] Integrate with Map component

### 5.3 Area Details Panel
- [x] Create `AreaDetailsPanel` component (bottom sheet)
- [x] Header: area name, tier badge, score
- [x] Score breakdown table (all metrics with weights)
- [x] Area & perimeter info section
- [x] Walk history list
- [x] Deviations section with exemption controls

### 5.4 Exemption UI
- [x] Create `ExemptionModal` component
- [x] Reason selection (predefined + "Other")
- [x] Implement "Mark as Exempt" flow
- [x] Implement "Remove Exemption" flow
- [ ] Real-time score update on exemption change (requires integration)

### 5.5 Progress Dashboard
- [x] Create Progress Dashboard / Drawer
- [x] Show completion percentage
- [x] Show tier breakdown (Platinum/Gold/Silver/Bronze counts)
- [ ] Add Loading States & Error Handling (basic states included)

### 5.6 Component Integration
- [x] Wire up ProgressDashboard with "View Stats" button
- [x] Add AreaDetailsPanel to page.tsx
- [x] Add ExemptionModal with add/remove handlers
- [x] Configure Turbopack for sql.js (resolve fs alias)
- [x] Create exemption-types.ts for client-safe type exports

## Phase 6: Database Integration (Phase 7 from plan)
- [x] Integrate database storage to persist analysis results across sessions
- [x] Create `analysis-persistence.ts` module for save/load functions
- [x] Update Map component to load cached results on page load
- [x] Only analyze new activities (skip already-analyzed)
- [x] Save analysis results to database after computation
- [x] Update `docs/features/data-persistence.md` with analysis persistence flow

## Phase 7: Polish & Deployment
- [ ] Database export/import UI
- [ ] Offline support testing
- [ ] Performance optimization (lazy load sql.js)

## Phase 7: Testing & Debugging Infrastructure
- [x] Install Vitest testing framework
- [x] Create test directory structure (`src/__tests__/`)
- [x] Create custom matchers for metric comparisons
- [x] Create visualization helpers (SVG generation)
- [x] Add loop detection tests
- [x] Add area coverage tests
- [x] Generate metric visualizations during test runs
- [x] Add export API for activity data (`/api/activities/export`)
- [x] Report total circumference of selected sub-area, walk length, sub-area circumference length, and difference (Walk vs Circumference) in AreaDetailsPanel UI
- [x] Update analysis-engine.md documentation
- [x] Add test fixtures from real activity data
- [x] Fix 0% area coverage bug (use Strava metadata for loop detection)
- [ ] Add perimeter coverage tests
- [ ] Add alignment tests
- [ ] Add efficiency tests
- [ ] Final Testing
- [ ] Deployment Instructions (Vercel)
- [ ] README updates

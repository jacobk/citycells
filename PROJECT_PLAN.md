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
- [x] Add activity streams API + caching helpers (ADR 006)

## Phase 3.5: Database Setup (ADR 004, superseded by ADR 026)
- [x] ~~Install `sql.js` dependency~~ (superseded — sql.js removed in ADR 026)
- [x] ~~Configure WASM loading in Next.js~~ (superseded — no WASM needed with IndexedDB)
- [x] Create database initialization module (`src/lib/db.ts`)
- [x] Implement IndexedDB persistence layer
- [x] ~~Create database schema migration script~~ (superseded — IndexedDB uses `onupgradeneeded`)
- [x] ~~Seed `areas` table from GeoJSON on first load~~ (superseded — areas computed from GeoJSON at runtime)
- [x] Add database export/import utilities
- [x] Create `useDatabase` React hook (`src/hooks/useDatabase.ts`)
- [x] Create `docs/features/data-persistence.md`

## Phase 3.6: IndexedDB Migration (ADR 026)
- [x] Replace sql.js with native IndexedDB (`src/lib/idb.ts` — ~220 lines, zero dependencies)
- [x] Rewrite `src/lib/db.ts` (all exports async)
- [x] Rewrite `src/lib/analysis-persistence.ts` (denormalized `areaCompletions`, single index scan)
- [x] Rewrite `src/lib/exemptions.ts` (async IDB)
- [x] Drop `areas` and `achievements` SQL tables (computed from GeoJSON / JS constants)
- [x] Remove `persistDatabase()` pattern (granular IDB writes)
- [x] Change export/import format from SQLite binary to JSON
- [x] Remove sql.js dependency (~1MB WASM binary)
- [x] Big-bang migration: delete old data, user re-syncs from Strava

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
- [x] Open AreaDetailsPanel on area click/tap (PRD 001 §3.6)
- [x] Add ExemptionModal with add/remove handlers
- [x] ~~Configure Turbopack for sql.js (resolve fs alias)~~ (superseded — no sql.js)
- [x] Create exemption-types.ts for client-safe type exports

## Phase 6: Database Integration (Phase 7 from plan)
- [x] Integrate database storage to persist analysis results across sessions
- [x] Create `analysis-persistence.ts` module for save/load functions
- [x] Update Map component to load cached results on page load (TICKET-002)
- [x] Only analyze new activities (skip already-analyzed) (TICKET-002)
- [x] Save analysis results to database after computation
- [x] Update `docs/features/data-persistence.md` with analysis persistence flow

## Phase 6.5: Metrics Documentation (ADR 007)
- [x] ADR 007: Interactive Metrics Documentation
- [x] Feature doc: metrics-documentation.md
- [x] Update PRD with user stories and Section 3.9
- [x] Define user-friendly metric names (Border Traced, Area Enclosed, etc.)
- [x] Install D3.js dependency
- [x] Create `/docs/metrics/` route structure
- [x] Implement Border Traced visualization
- [x] Implement Area Enclosed visualization
- [x] Implement Path Precision visualization
- [x] Implement Route Efficiency visualization
- [x] Add clickable metric links to AreaDetailsPanel

## Phase 6.6: Sub-Area List Feature (ADR 008)
- [x] ADR 008: Panel Navigation Architecture
- [x] Feature doc: sub-area-list.md
- [x] Update PRD with user stories and Section 3.10
- [x] Update map-visualization.md with new components
- [x] Update feature index (README.md)
- [x] Implement HamburgerMenu component
- [x] Implement SubAreaListPanel component
- [x] Implement PanelBreadcrumbs component
- [x] Wire sorting logic and navigation state

## Phase 6.7: UI Navigation Layout Update (ADR 009)

*Reference: [ADR 009](docs/ADR/009-ui-navigation-layout.md) | [PRD §3.10](docs/PRD/001-mvp-mobile-walker.md#310-sub-area-list-view)*

- [x] ADR 009: UI Navigation Layout (supersedes ADR 008)
- [x] Update PRD 001 §3.10 with new layout and profile card behavior
- [x] Update sub-area-list.md feature doc
- [x] Update map-visualization.md feature doc
- [x] Move HamburgerMenu to top-left position (CSS update)
- [x] Create/refactor ProfileCard component (`src/components/ProfileCard/`)
  - [x] Collapsed state: avatar only (48x48px circular button)
  - [x] Expanded state: full card with name, progress, logout
  - [x] Expand/collapse animation (200-300ms)
- [x] Add `UIOverlayState` to page.tsx state management
- [x] Implement mutual exclusivity logic (only one overlay open at a time)
- [x] Update z-index hierarchy per ADR 009
- [ ] Test on mobile for thumb-reachability

## Phase 6.8: Re-Analysis Feature (ADR 011)

*Reference: [ADR 011](docs/ADR/011-re-analysis-strategy.md) | [Feature Doc](docs/features/re-analysis.md) | [TICKET-003](docs/tickets/003-re-analysis.md)*

- [x] ADR 011: Re-Analysis Strategy
- [x] Feature doc: re-analysis.md
- [x] Update PRD 001 with re-analysis user stories
- [x] Implement `listWalksWithCache()` to identify re-analyzable walks
- [x] Implement `invalidateWalkAnalyses()` to clear cached analysis results
- [x] Implement `reAnalyzeWalk()` for single-walk re-analysis
- [x] Implement `reAnalyzeWalks()` for batch re-analysis with progress
- [x] Add "Re-score All" / "Full Re-fetch" buttons to ProfileCard
- [x] Add per-walk re-analysis menu to AreaDetailsPanel walk history
- [x] Wire up page.tsx handlers for both entry points
- [x] Fix loop detection during re-analysis (use original Strava activity coordinates)
- [x] Add schema migration for start/end coordinates in walks table

## Phase 6.9: Subarea Visual Context (ADR 012)

*Reference: [ADR 012](docs/ADR/012-details-panel-mini-map.md) | [TICKET-004](docs/tickets/004-subarea-visual-context.md)*

- [x] ADR 012: Details Panel Mini-Map
- [x] Update PRD 001 with visual context user stories (Sections 3.5, 3.6)
- [x] Create `src/lib/geo-utils.ts` shared perimeter utilities (refactored from Map.tsx and db.ts)
- [x] Create `AreaMiniMap` component (`src/components/AreaMiniMap/`)
- [x] Integrate mini-map into AreaDetailsPanel (below header, above score breakdown)
- [x] Add circumference with walk time to AreaTooltip
- [x] Pass geometry through data flow (AreaClickData -> AreaDetails)
- [x] Update feature docs and changelog

## Phase 6.5: Live Walking Mode (ADR 017, TICKET-017)

*Reference: [ADR 017](docs/ADR/017-live-walking-mode.md) | [PRD §3.13](docs/PRD/001-mvp-mobile-walker.md#313-live-walking-mode) | [Ticket](docs/tickets/017-live-walking-mode.md)*

- [x] Create shared map config (`src/lib/map-config.ts`)
- [x] Create `useGeolocationTracking` hook (watchPosition API)
- [x] Create `useWakeLock` hook (Screen Wake Lock API)
- [x] Create `WalkingMode` component (full-screen overlay)
- [x] Create `LivePositionMarker` component (blue dot + accuracy circle)
- [x] Create `WalkingControls` component (exit, center, zoom)
- [x] Add "Start Walking" button to AreaDetailsPanel
- [x] Wire up walking mode state in page.tsx
- [x] Update Map and AreaMiniMap to use shared map config
- [x] Update feature docs (`docs/features/live-walking-mode.md`)

## Phase 6.6: Distance-to-Boundary Indicator (TICKET-018)

*Reference: [PRD §3.13](docs/PRD/001-mvp-mobile-walker.md#313-live-walking-mode) | [Feature Docs](docs/features/distance-indicator.md) | [Ticket](docs/tickets/018-distance-indicator.md)*

- [x] Create consolidated `src/lib/geo-distance.ts` (distance calculation utilities)
- [x] Refactor `analysis.ts` to use geo-distance.ts
- [x] Refactor `route-visualization.ts` to use geo-distance.ts
- [x] Add distance state and calculation to WalkingMode.tsx
- [x] Add distance indicator UI to WalkingControls.tsx
- [x] Add withinTolerance prop to LivePositionMarker.tsx (color change)
- [x] Update feature docs (`docs/features/distance-indicator.md`)

## Phase 6.5: Branding & Visual Identity (ADR 018)
*Reference: [ADR 018](docs/ADR/018-branding-design-system.md) | [TICKET-020](docs/tickets/020-branding-visual-identity.md) | [TICKET-021](docs/tickets/021-design-system-implementation.md)*

- [x] Create brand assets (logo, favicon suite) - TICKET-020
- [x] Install Shadcn/UI dependencies
- [x] Configure CSS design tokens (primary/accent/destructive colors)
- [x] Implement dark mode support
- [x] Update app metadata (title, description, favicon links)
- [x] Create Brand component (`src/components/Brand/`)
- [x] Add Shadcn Button component
- [x] Update components to use brand colors (ProfileCard, HamburgerMenu, AreaDetailsPanel)
- [x] Create feature documentation (`docs/features/branding-visual-identity.md`)
- [x] Add dark mode toggle to Hamburger Menu (System/Light/Dark) - TICKET-022
- [x] Implement theme persistence via localStorage - TICKET-022

## Phase 6.7: Achievement System (ADR 019, TICKET-023)

*Reference: [ADR 019](docs/ADR/019-achievement-system.md) | [PRD §3.15](docs/PRD/001-mvp-mobile-walker.md#315-achievement-system) | [Ticket](docs/tickets/023-achievement-system.md) | [Feature Doc](docs/features/achievements.md)*

- [x] ADR 019: Achievement System Data Model
- [x] Feature doc: achievements.md
- [x] Update PRD 001 with achievement user stories (Section 3.15)
- [x] Database schema: Add `achievements` and `user_achievements` tables (schema v6)
- [x] Create `src/lib/achievements.ts` - 40 achievement definitions (35 regular + 5 hidden)
- [x] Create `src/lib/adjacency.ts` - Area boundary sharing detection
- [x] Create `src/lib/achievement-conditions.ts` - Modular condition evaluators
- [x] Create `src/lib/achievement-service.ts` - Check and persist achievements
- [x] Create `src/hooks/useAchievements.ts` - React hook for achievement state
- [x] Create `src/components/AchievementBrowser/` - Slide-up panel for browsing
- [x] Create `src/components/AchievementModal/` - Celebratory unlock modal
- [x] Add Achievements button to HamburgerMenu with count badge
- [x] Integrate into page.tsx (check after analysis, render components)
- [x] Update feature documentation with implementation details

## Phase 6.8: Tiered Distance Scoring (ADR 021, TICKET-026)

*Reference: [ADR 021](docs/ADR/021-tiered-distance-scoring.md) | [Feature Docs](docs/features/analysis-engine.md)*

### Phase 1: Core Scoring Logic
- [x] Create `src/lib/distance-tiers.ts` with tier constants and functions
- [x] Implement `assignDistanceTier(distanceMeters)` - tier + points assignment
- [x] Implement `calculateTieredBorderScore()` - segment-length weighted scoring
- [x] Update `TIERED_SCORE_WEIGHTS` in analysis.ts (45/25/30)
- [x] Update `AnalysisMetrics` interface with new fields
- [x] Implement `calculateTieredQualityScore()` function
- [x] Update `analyzeWalk()` to use tiered scoring
- [x] Create `src/lib/__tests__/distance-tiers.test.ts` (39 tests)
- [x] Update real-activity test expectations for new formula
- [x] Update feature documentation (analysis-engine.md)

### Phase 2: Database Schema Update
- [x] Add `tiered_border_score` column to walk_analyses table
- [x] Add `tier_distribution` JSON column
- [x] Create migration to schema v8
- [x] Update persistence layer to store/retrieve new fields

### Phase 3: Route Visualization
- [x] Add per-segment tier coloring to route visualization
- [x] Implement tier color palette (Platinum→Missed gradient)
- [x] Add dashed pattern for "Missed" segments

### Phase 4: UI Updates
- [x] Display tier distribution in AreaDetailsPanel
- [x] Add tier breakdown progress bars
- [x] Update metrics documentation pages

### Phase 5: Documentation Pages
- [x] Create /docs/scoring/ app routes
- [x] Add "How Scoring Works" section to hamburger menu
- [x] Create interactive tier explainer

### Phase 6: Comparison Testing
- [x] Re-analyze sample walks with both formulas
- [x] Document score differences
- [x] Verify tier assignments match expectations

## Phase 6.9: Share Walk Feature (ADR 023, TICKET-029)

*Reference: [ADR 023](docs/ADR/023-share-walk-feature.md) | [PRD §3.17](docs/PRD/001-mvp-mobile-walker.md#317-share-walk) | [Feature Docs](docs/features/share-walk.md)*

- [x] Create `src/lib/share/types.ts` - ShareableWalkData interface with version field
- [x] Create `src/lib/share/encode.ts` - pako compression + base64url encoding
- [x] Create `src/lib/share/decode.ts` - version-aware decoder with decodeV1()
- [x] Create `src/lib/share/image.ts` - html2canvas integration
- [x] Create `src/lib/share/__fixtures__/v1-sample.ts` - frozen V1 test fixture
- [x] Create `src/lib/__tests__/share.test.ts` - 18 unit tests for encode/decode/versioning
- [x] Create `src/app/share/walk/page.tsx` - public viewer page (no auth required)
- [x] Create `src/app/share/walk/SharedWalkMap.tsx` - map component with tiered route
- [x] Create `src/components/ShareModal/` - modal with Copy Link, Download Image, Preview
- [x] Create `src/components/SharePreview/` - image layout for canvas capture
- [x] Add share button to AreaDetailsPanel header
- [x] Install dependencies: pako, html2canvas, @types/pako
- [x] Update feature documentation and changelog

## Phase 7: Polish & Deployment
- [ ] Database export/import UI
- [x] ~~Offline support testing~~ (Removed — feature removed 2026-04-08)
- [x] ~~Performance optimization (lazy load sql.js)~~ (superseded — sql.js removed, IndexedDB is native)

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
- [x] Use Strava distance for walk length to avoid polyline truncation
- [x] Bulk export all 11 activities as test fixtures (with streams + area polygons)
- [x] Add perimeter coverage tests (all 11 activities)
- [x] Add alignment tests (all 11 activities)
- [x] Add efficiency tests (all 11 activities)
- [x] Add area coverage tests (all 11 activities)
- [x] Add tier assignment tests (platinum, gold, silver, bronze, null)
- [ ] Final Testing
- [ ] Deployment Instructions (Vercel)
- [ ] README updates

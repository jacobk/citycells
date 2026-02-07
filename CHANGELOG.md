# Changelog

All notable changes to CityCells are documented in this file.

Format: Keep a Changelog (https://keepachangelog.com/)

## Purpose
This changelog enables agents to:
1. Compare entries against PRD/ADR requirements
2. Verify features are actually implemented (not just documented)
3. Identify gaps between requirements and implementation

## Entry Format
Each entry should reference:
- PRD section (e.g., PRD 001 §3.6)
- ADR (e.g., ADR 003)
- Key files modified

## Unreleased
### Added
- Mini-map walk route visualization: toggle control to show/hide routes, walk selection in Walk History, deviation-based coloring matching main map. (PRD 001 §3.6, ADR 010 §3, ADR 012, TICKET-011)
  - Key files: `src/components/AreaMiniMap/AreaMiniMap.tsx`, `src/components/AreaDetailsPanel/AreaDetailsPanel.tsx`, `src/components/Map/Map.tsx`, `src/app/page.tsx`
  - Toggle control above mini-map to show/hide routes (default: OFF)
  - Walk selection in Walk History section (clickable items with visual highlight)
  - Default selection: best walk (`isBest: true`) or first walk if only one exists
  - Route visualization uses same deviation-based coloring as main map (green = within 25m, red = deviation)
  - Routes render above area boundary polygon (correct z-order)
  - Prefers stream data for full paths, falls back to `summary_polyline` from activities array (matches main map pattern)
  - FitBounds includes route segments to ensure full route is visible
  - Independent toggle state from main map route toggle
- Strava API brand guidelines compliance: official Connect with Strava button, standardized "View on Strava" links, and "Powered by Strava" branding. (TICKET-010)
  - Key files: `src/components/ProfileCard/ProfileCard.tsx`, `src/components/AreaTooltip/AreaTooltip.tsx`, `src/components/AreaDetailsPanel/AreaDetailsPanel.tsx`, `src/app/privacy/page.tsx`, `src/app/terms/page.tsx`, `src/lib/strava.ts`, `public/strava/`
  - Replaced custom "Connect with Strava" button with official Strava button assets (48px height per guidelines)
  - All activity links now use "View on Strava" text format with exact Strava orange color (#FC5200)
  - Added "Powered by Strava" branding to privacy and terms page footers
  - Verified OAuth URL points to correct Strava endpoint (https://www.strava.com/oauth/authorize)
  - Required for Strava production access compliance
- Privacy policy and terms pages for Strava production access. (TICKET-010, ADR 016)
  - Key files: `docs/privacy-policy.md`, `src/app/privacy/page.tsx`, `src/app/terms/page.tsx`, `src/components/HamburgerMenu/HamburgerMenu.tsx`
  - Privacy policy page at `/privacy` covering data collection, storage, usage, user rights, and GDPR compliance
  - Terms of service page template at `/terms` (ready if Strava requires it)
  - Privacy Policy link added to hamburger menu for easy access
  - Required for Strava production access request to increase athlete limit beyond default
- Strava production access documentation and preparation. (TICKET-010, ADR 016)
  - Key files: `docs/tickets/010-strava-production-access.md`, `docs/features/authentication.md`, `docs/ADR/016-vercel-deployment.md`
  - Comprehensive ticket documenting production access request process
  - Updated authentication feature docs with athlete limit information
  - Updated ADR 016 with privacy policy requirement and production access notes
### Fixed
- Vercel deployment build failure: added missing `src/lib/requestOrigin.ts` file to repository. (TICKET-009, ADR 016)
  - Key files: `src/lib/requestOrigin.ts`
  - File was created locally but not committed, causing module resolution errors in Vercel builds
  - Handles Vercel proxy headers (`x-forwarded-host`, `x-forwarded-proto`) for correct OAuth redirects
### Added
- Vercel deployment documentation: ADR, feature docs, and implementation ticket. (TICKET-009, ADR 016)
  - Key files: `docs/ADR/016-vercel-deployment.md`, `docs/features/deployment.md`, `docs/tickets/009-vercel-deployment.md`
  - ADR 016 documents platform selection (Vercel) and deployment architecture
  - Feature documentation covers deployment process and rationale
  - Implementation ticket provides step-by-step deployment checklist
### Added
- Expandable bottom panel with multi-state slide behavior: four states (closed, collapsed ~40vh, expanded ~85vh, full-screen ~95vh) with touch gestures for mobile and click-to-toggle for desktop. (PRD 001 §3.6, ADR 015, TICKET-008)
  - Key files: `src/hooks/useExpandablePanel.ts`, `src/lib/panel-state.ts`, `src/components/AreaDetailsPanel/AreaDetailsPanel.tsx`, `src/components/AreaMiniMap/AreaMiniMap.tsx`
  - Touch devices can slide panel up/down to transition between states
  - Desktop users can click drag handle to cycle through collapsed → expanded → full-screen
  - Fast swipe down closes panel regardless of current state
  - Mini-map height adapts to panel state (150px / 200px / 400px)
  - Smooth CSS transitions between all state transitions
  - Velocity-based gesture detection for natural mobile interactions
- Walk route visualization with deviation-based coloring: routes hidden by default, toggle to show with green/red coloring based on distance from area boundary. (PRD 001 §3.4, ADR 010 §3, TICKET-007)
  - Key files: `src/lib/route-visualization.ts`, `src/lib/design-tokens.ts`, `src/components/Map/Map.tsx`, `src/components/HamburgerMenu/HamburgerMenu.tsx`, `src/app/page.tsx`
  - Toggle control in hamburger menu dropdown ("Show Routes")
  - Green segments within 25m of assigned area boundary (on-track)
  - Red segments beyond 25m of boundary (deviation)
  - Gray for unmatched activities
  - Prefers stream data for full paths (no privacy zone truncation)
  - Routes render above area fills but below tier icons (correct z-order)
  - Deprecated old triple-layer cyan glow route styling
- Offline support: app works without internet after first load. (PRD 001 §3.11, ADR 014, TICKET-006)
  - Key files: `public/sw.js`, `src/components/ServiceWorkerRegistration/`, `src/hooks/useOnlineStatus.ts`, `src/components/OfflineIndicator/`, `src/app/layout.tsx`
  - Service Worker precaches GeoJSON and WASM; caches map tiles on first use (stale-while-revalidate, 500 tile limit)
  - Offline detection via `useOnlineStatus` hook using `useSyncExternalStore`
  - Amber banner "You're offline — viewing cached data" when offline
  - Re-analyze buttons disabled when offline with "Requires internet" messaging
  - Per-walk re-analyze menu hidden when offline in AreaDetailsPanel
- Persistent Strava authentication: users stay authenticated across browser sessions. (PRD 001 §2, ADR 013, TICKET-005)
  - Key files: `src/lib/auth-persistence.ts`, `src/lib/db.ts`, `src/lib/strava.ts`, `src/hooks/useStrava.ts`, `src/app/api/auth/restore-session/route.ts`
  - Tokens stored in SQLite (IndexedDB) for persistence, HTTP-only cookies for API route auth
  - Automatic session restoration for returning users via `/api/auth/restore-session`
  - `getValidAccessToken()` utility for centralized token refresh in API routes
  - Token CRUD operations in db.ts: `getUserByStravaId()`, `updateUserTokens()`, `clearUserTokens()`
  - Updated `useStrava` hook with SQLite check on mount and session restoration flow
- Subarea visual context enhancements: mini-map in details panel and circumference in hover tooltip. (PRD 001 §3.5/3.6, ADR 012, TICKET-004)
  - Key files: `src/components/AreaMiniMap/AreaMiniMap.tsx`, `src/lib/geo-utils.ts`, `src/components/AreaDetailsPanel/AreaDetailsPanel.tsx`, `src/components/AreaTooltip/AreaTooltip.tsx`, `src/components/Map/Map.tsx`
  - Interactive mini-map in AreaDetailsPanel showing subarea boundary with street-level tiles
  - Circumference with estimated walk time ("2.3 km (~28 min)") in hover tooltip for all areas
  - Created `geo-utils.ts` as single source of truth for perimeter calculation (refactored from Map.tsx and db.ts)
  - AreaMiniMap uses tier-colored fill at 0.2 opacity with 3px stroke, pan/zoom enabled
- Re-analysis feature: user-initiated refresh of walk scores via ProfileCard or per-walk menu. (PRD 001 §2, ADR 011, TICKET-003)
  - Key files: `src/lib/analysis-persistence.ts`, `src/components/ProfileCard/ProfileCard.tsx`, `src/components/AreaDetailsPanel/AreaDetailsPanel.tsx`, `src/app/page.tsx`
  - Two modes: "Re-score only" (fast, uses cached streams) and "Full Re-fetch" (re-fetches GPS from Strava)
  - Batch re-analysis with progress tracking from ProfileCard
  - Per-walk re-analysis from AreaDetailsPanel walk history
  - Fixes loop detection during re-analysis using original Strava activity coordinates
- Analysis cache loading on page load: cached results display instantly, only new activities are analyzed. (PRD 001 §3.8, ADR 004, TICKET-002)
  - Key files: `src/components/Map/Map.tsx`, `src/lib/analysis-persistence.ts`, `docs/features/data-persistence.md`
  - Loads cached tier colors and progress immediately (no "Analyzing paths..." delay)
  - `getActivitiesToAnalyze()` skips already-analyzed activities
  - `CachedMetrics` type exports all DB fields for full `AnalysisMetrics` reconstruction
  - `convertCachedToFullMetrics()` helper in Map.tsx for type conversion
- Analysis cache loading ticket and ADR clarification. (PRD 001 §3.8, ADR 004, TICKET-002)
  - Key files: `docs/ADR/004-sqlite-storage.md`, `docs/tickets/002-analysis-cache-loading.md`
  - Added "Cache Loading Strategy" section to ADR 004 specifying required page load flow
  - Created TICKET-002 for implementing cache loading (page loads without re-analysis)
  - Corrected PROJECT_PLAN.md: cache loading items were incorrectly marked as complete
- Map Visual Design System implementation: vibrant purple-pink gradient, grayscale base map, cyan route glow, tier medal icons. (PRD 001 §3.4, ADR 010, TICKET-001)
  - Key files: `src/lib/design-tokens.ts`, `src/components/TierIcon/TierIcon.tsx`, `src/components/Map/Map.tsx`, `src/app/globals.css`, `docs/features/map-visualization.md`
  - Centralized design tokens for map visualization colors
  - TierIcon component with DivIcon centroid placement (visible at zoom 13+)
  - Triple-layer Polyline route styling with cyan glow effect
  - CSS grayscale filter for muted base map tiles
  - Purple-pink tier gradient: Platinum (#7c3aed) → Bronze (#f0abfc)
  - WCAG 2.1 accessibility compliance
- Implementation ticket system for agent-targeted task handoff. (AGENTS.md)
  - Key files: `docs/tickets/001-map-visual-design-system.md`, `.cursor/skills/prd-adr-manager/templates/ticket-template.md`, `.cursor/skills/prd-adr-manager/SKILL.md`
  - Sequential ticket numbering (001, 002, ...)
  - Context-to-load section for implementation agents
  - Integrated into PRD/ADR manager skill workflows

### Changed
- UI Navigation Layout: swapped hamburger menu (now top-left) and profile card (now top-right). (PRD 001 §3.10, ADR 009)
  - Key files: `docs/ADR/009-ui-navigation-layout.md`, `docs/PRD/001-mvp-mobile-walker.md`, `docs/features/sub-area-list.md`, `docs/features/map-visualization.md`, `PROJECT_PLAN.md`
  - Profile card now collapsible (avatar-only by default, expandable on tap)
  - Mutual exclusivity: only one overlay (hamburger or profile) can be open at a time
  - ADR 008 superseded by ADR 009

### Added
- Sub-Area List feature: browsable list of all 136 sub-areas with sorting and navigation. (PRD 001 §3.10, ADR 008)
  - Key files: `src/components/HamburgerMenu/HamburgerMenu.tsx`, `src/components/SubAreaListPanel/SubAreaListPanel.tsx`, `src/components/PanelBreadcrumbs/PanelBreadcrumbs.tsx`, `src/app/page.tsx`, `src/components/Map/Map.tsx`, `src/components/AreaDetailsPanel/AreaDetailsPanel.tsx`
  - HamburgerMenu: floating button in top-right with "Areas" and "Stats" options
  - SubAreaListPanel: bottom sheet with sortable list (circumference, name, status)
  - PanelBreadcrumbs: navigation between list and detail views
  - Unified PanelView state management for panel navigation
  - Documentation: `docs/ADR/008-panel-navigation-architecture.md`, `docs/features/sub-area-list.md`
- Metrics Documentation feature: in-app help system with D3 visualizations for analysis metrics. (PRD 001 §3.9, ADR 007)
  - Key files: `src/app/docs/layout.tsx`, `src/app/docs/metrics/page.tsx`, `src/app/docs/metrics/[slug]/page.tsx`, `src/components/Docs/MetricCard.tsx`, `src/components/Docs/MetricVisualizations/`, `src/lib/metrics-content.ts`, `src/components/AreaDetailsPanel/AreaDetailsPanel.tsx`
  - User-friendly metric names: Border Traced, Area Enclosed, Path Precision, Route Efficiency
  - Mobile-first interactive visualizations at `/docs/metrics/`
- Strava activity streams fetching and caching for high-fidelity analysis. (ADR 006)
  - Key files: `src/app/api/activities/streams/route.ts`, `src/components/Map/Map.tsx`, `src/lib/db.ts`, `src/lib/types/strava-streams.ts`
- Stream export helper routes and fixture script for raw stream data. (ADR 006)
  - Key files: `src/app/api/activities/streams/export/route.ts`, `src/app/streams-export/page.tsx`, `scripts/export-activity-streams.mjs`
- Open AreaDetailsPanel on area click/tap, matching PRD 001 §3.6. (PRD 001 §3.6)
  - Key files: `src/components/Map/Map.tsx`, `src/components/Map/index.tsx`, `src/app/page.tsx`
- Commit workflow skill and command for documentation-first commits. (AGENTS.md)
  - Key files: `.cursor/skills/commit-workflow/SKILL.md`, `.cursor/commands/commit.md`
- Commit workflow enforces fast-forward merges to main. (AGENTS.md)
  - Key files: `.cursor/skills/commit-workflow/SKILL.md`
### Fixed
- Håkanstorp test now uses real delområde polygon instead of synthetic bounding box. (ADR 003)
  - Key files: `src/__tests__/analysis/real-activity.test.ts`, `src/__tests__/fixtures/areas/hakanstorp.json`
  - Old test used bboxPolygon (4077m perimeter, 4x area) making all scores 0%
  - Real polygon gives accurate results: 100% border traced, 98% area coverage, platinum tier
  - Added assertions for all metrics: loop detection, border traced, area, alignment, efficiency, tier
  - Area fixture extracted from `malmo_delomraden.geojson`
- Use Strava distance for total walk length to avoid polyline truncation. (PRD 001 §3.6, ADR 003, ADR 005)
  - Key files: `src/lib/analysis.ts`, `src/components/Map/Map.tsx`, `src/hooks/useStrava.ts`, `docs/features/analysis-engine.md`, `src/__tests__/analysis/real-activity.test.ts`

## 2026-02-03
### Added
- Multi-metric scoring system and SQLite storage architecture decisions. (ADR 003, ADR 004)
  - Key files: `docs/ADR/003-multi-metric-completion-scoring.md`, `docs/ADR/004-sqlite-storage.md`
- Exclusive activity matching decision. (ADR 002)
  - Key files: `docs/ADR/002-exclusive-activity-matching.md`
- Analysis result persistence with sql.js + IndexedDB. (ADR 004)
  - Key files: `src/lib/db.ts`, `src/hooks/useDatabase.ts`, `src/lib/analysis-persistence.ts`
- Multi-metric analysis engine (perimeter, area, RMSE, efficiency, tiers). (PRD 001 §3.3, ADR 003)
  - Key files: `src/lib/analysis.ts`, `docs/features/analysis-engine.md`
- Deviation detection and exemption service. (PRD 001 §3.6-3.7, ADR 003)
  - Key files: `src/lib/exemptions.ts`, `docs/features/exemption-system.md`
- UI components for map interactions and scoring details. (PRD 001 §3.4-3.7)
  - Key files: `src/components/AreaTooltip/AreaTooltip.tsx`, `src/components/AreaDetailsPanel/AreaDetailsPanel.tsx`, `src/components/ExemptionModal/ExemptionModal.tsx`, `src/components/ProgressDashboard/ProgressDashboard.tsx`
- Enhanced metric display for circumference and walk length. (PRD 001 §3.6, ADR 003)
  - Key files: `src/components/AreaDetailsPanel/AreaDetailsPanel.tsx`, `docs/ADR/003-multi-metric-completion-scoring.md`, `docs/PRD/001-mvp-mobile-walker.md`
- Vitest testing infrastructure and fixtures. (PRD 001 §3.3)
  - Key files: `src/__tests__/`, `vitest.config.ts`

## 2026-02-02
### Added
- Initial app scaffold with Next.js, TypeScript, Tailwind CSS. (ADR 001)
  - Key files: `src/app/`, `tailwind.config.ts`, `tsconfig.json`
- PRD for MVP scope and requirements. (PRD 001)
  - Key files: `docs/PRD/001-mvp-mobile-walker.md`
- Strava OAuth integration and activities API. (PRD 001 §3.2)
  - Key files: `src/app/api/auth/`, `src/app/api/activities/route.ts`, `src/hooks/useStrava.ts`
- Basic map rendering of Malmö sub-areas. (PRD 001 §3.1)
  - Key files: `src/components/Map/Map.tsx`, `public/data/malmo_delomraden.geojson`

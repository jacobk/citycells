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

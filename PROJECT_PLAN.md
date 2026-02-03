# CityCells Project Plan

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
- [ ] Register Strava Application
- [ ] Create `.env.local` for secrets
- [ ] Implement OAuth API Route (`/api/auth/login`, `/api/auth/callback`)
- [ ] Implement Session Management (Cookies)
- [ ] Implement Activities API (`/api/activities`) with filtering

## Phase 3.5: Database Setup (ADR 004)
- [ ] Install `sql.js` dependency
- [ ] Configure WASM loading in Next.js
- [ ] Create database initialization module (`src/lib/db.ts`)
- [ ] Implement IndexedDB persistence layer
- [ ] Create database schema migration script
- [ ] Seed `areas` table from GeoJSON on first load
- [ ] Add database export/import utilities

## Phase 4: Analysis Engine (ADR 003)

### 4.1 Core Metrics
- [x] Implement Turf.js Geometry Utilities
- [ ] Refactor `calculateCoverage()` → `calculatePerimeterCoverage()`
- [ ] Implement `calculateAreaCoverage()` (polygon intersection)
- [ ] Implement `calculateRMSE()` (alignment error)
- [ ] Implement `calculateEfficiency()`
- [ ] Implement loop detection (start/end distance check)

### 4.2 Deviation Detection
- [ ] Implement deviation detection algorithm
- [ ] Calculate deviation metrics (border_gap, detour_distance, etc.)
- [ ] Implement classification heuristic (obstacle_avoidance, shortcut, drift)

### 4.3 Scoring & Storage
- [ ] Create `calculateAnalysis(walk, area)` returning all metrics
- [ ] Implement composite quality score calculation
- [ ] Implement tier assignment logic
- [ ] Store analysis results in `walk_analyses` table
- [ ] Store deviations in `deviations` table
- [ ] Update `area_completions` table with best scores

### 4.4 Exemption System
- [ ] Create exemption service (`src/lib/exemptions.ts`)
- [ ] Implement `addExemption(deviationId, reason)`
- [ ] Implement `removeExemption(deviationId)`
- [ ] Implement score recalculation on exemption change
- [ ] Update `walk_analyses` with adjusted scores

## Phase 5: UI Components

### 5.1 Map Visualization
- [ ] Update area styling to use tier colors (ADR 003)
- [ ] Implement completed area fill with opacity
- [ ] Add border color matching tier

### 5.2 Hover Tooltip
- [ ] Create `AreaTooltip` component
- [ ] Implement desktop hover handler
- [ ] Implement mobile long-press handler (500ms)
- [ ] Display: name, tier badge, score, walk count, best walk link

### 5.3 Area Details Panel
- [ ] Create `AreaDetailsPanel` component (bottom sheet)
- [ ] Header: area name, tier badge, score
- [ ] Score breakdown table (all metrics with weights)
- [ ] Area & perimeter info section
- [ ] Walk history list
- [ ] Deviations section with exemption controls

### 5.4 Exemption UI
- [ ] Create `ExemptionModal` component
- [ ] Reason selection (predefined + "Other")
- [ ] Implement "Mark as Exempt" flow
- [ ] Implement "Remove Exemption" flow
- [ ] Real-time score update on exemption change

### 5.5 Progress Dashboard
- [ ] Create Progress Dashboard / Drawer
- [ ] Show completion percentage
- [ ] Show tier breakdown (Platinum/Gold/Silver/Bronze counts)
- [ ] Add Loading States & Error Handling

## Phase 6: Polish & Deployment
- [ ] Database export/import UI
- [ ] Offline support testing
- [ ] Performance optimization (lazy load sql.js)
- [ ] Final Testing
- [ ] Deployment Instructions (Vercel)
- [ ] README updates

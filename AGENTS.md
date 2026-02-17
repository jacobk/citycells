# Agent Guidelines for CityCells Repository

This document serves as the primary source of truth for agentic coding assistants working in the `citycells` repository.
Follow these instructions strictly to maintain code quality, consistency, build stability, and documentation integrity.

## 1. Workflow & Documentation Protocols (CRITICAL)

**Rule #1: Documentation First**
Before committing code or marking a feature as complete, you **must** ensure the project documentation reflects the changes.
Never propose a change to the codebase without explicitly considering its impact on the following files:

### 1.1 Architectural Decision Records (ADRs)
- **Location**: `docs/ADR/`
- **When to update**: When introducing new libraries, changing patterns (e.g., auth flow), or making significant structural changes.
- **Action**: Create a new ADR (e.g., `002-new-decision.md`) or update an existing one if refining a previous decision.

### 1.2 Product Requirements Documents (PRDs)
- **Location**: `docs/PRD/`
- **When to update**: If the feature scope, user experience, or requirements evolve during implementation.
- **Action**: Update the relevant PRD (e.g., `001-mvp-mobile-walker.md`) to reflect the actual implementation or new requirements.

### 1.3 Project Plan
- **Location**: `PROJECT_PLAN.md` (root directory)
- **When to update**: When a task is started, completed, or if timelines/dependencies change.
- **Action**: Check off completed items or add new tasks as discovered.

### 1.4 Feature Documentation
- **Location**: `docs/features/`
- **When to update**: When implementing or modifying any user-facing feature.
- **Structure**: One file per feature domain (e.g., `analysis-engine.md`, `map-visualization.md`).
- **Content requirements**:
  - Feature overview (what it does, why it exists)
  - Implementation details (key files, functions, data flow)
  - ADR references (link to relevant decisions)
  - Code rationale summary (non-obvious design choices)
- **Purpose**: Enable future agents to reconstruct the full mental model and rationale for all features.

### 1.5 Code Rationale Comments
When implementing features, document the "why" in code:
- Add `// WHY:` comments for non-obvious implementation choices
- Link to ADRs in comments where relevant (e.g., `// See ADR 003 for scoring formula`)
- Document magic numbers and thresholds with their source (e.g., `// 25m buffer - see ADR 002`)
- Explain trade-offs made during implementation

### 1.6 Changelog Maintenance
Maintain `CHANGELOG.md` so future agents can compare implementation against PRD/ADR:
- Update `CHANGELOG.md` for every feature/fix
- Reference PRD sections and ADRs for traceability
- List key files modified in each entry
- Use entries to verify features are implemented, not just documented

**Workflow Checklist:**
1.  [ ] Analyze request.
2.  [ ] Check `PROJECT_PLAN.md` and `docs/PRD/` for context.
3.  [ ] Plan the code change.
4.  [ ] **Check:** Does this require an ADR? Does this change the PRD?
5.  [ ] Implement code.
6.  [ ] Update `docs/features/` with implementation details.
7.  [ ] Add `// WHY:` comments for non-obvious code decisions.
8.  [ ] Update `PROJECT_PLAN.md`, `docs/ADR/`, and `docs/PRD/` as necessary.
9.  [ ] Verify feature docs allow mental model reconstruction.
10. [ ] Verify build and lint.

---

## 2. Build Verification Checklist (REQUIRED)

**Reference:** [ADR 020](docs/ADR/020-agent-build-verification.md)

> **CRITICAL**: You MUST complete this checklist before marking ANY task as done.
> Skipping verification leads to broken builds and wasted debugging time.

### 2.1 Mandatory Verification Steps

Run these commands **in order** after making code changes:

```bash
# Step 1: Code quality check
npm run lint

# Step 2: Build verification (catches ~80% of runtime errors)
npm run build

# Step 3: Unit tests
npm run test
```

**All three commands must pass with zero errors.**

### 2.2 What Each Step Catches

| Step | Command | Catches |
|------|---------|---------|
| 1 | `npm run lint` | Code style, unused imports, formatting issues |
| 2 | `npm run build` | TypeScript errors, import errors, SSR issues, syntax errors |
| 3 | `npm run test` | Business logic bugs, regressions in analysis functions |

### 2.3 When Verification Fails

**If `npm run lint` fails:**
1. Read the error messages carefully
2. Fix the identified issues (most are auto-fixable patterns)
3. Re-run `npm run lint` until it passes

**If `npm run build` fails:**
1. Read the TypeScript/Next.js error messages
2. Common issues: missing imports, type mismatches, undefined variables
3. Fix the errors in the identified files
4. Re-run `npm run build` until it passes

**If `npm run test` fails:**
1. Read which tests failed and why
2. If you broke existing functionality, fix your code
3. If test expectations are outdated, update the test (with justification)
4. Re-run `npm run test` until all tests pass

### 2.4 Unit Test Guidelines

**Tests are REQUIRED for:**
- Functions in `src/lib/` with business logic
- Scoring algorithms and calculations
- Data transformation utilities

**Tests are NOT required for:**
- React components (high maintenance, low ROI)
- Simple pass-through functions
- UI styling

**Test file locations:**
- Unit tests: `src/lib/__tests__/*.test.ts`
- Integration tests: `src/__tests__/**/*.test.ts`

### 2.5 Verification Workflow Summary

```
┌─────────────────────────────────────────────────────────┐
│  BEFORE completing any task, you MUST verify:          │
│                                                         │
│  1. npm run lint    → Must pass                        │
│  2. npm run build   → Must pass                        │
│  3. npm run test    → Must pass                        │
│                                                         │
│  Only then can you mark the task as complete.          │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Project Overview & Architecture

**CityCells** is a Next.js application visualizing Strava activities over city sub-areas (delområden).

### Tech Stack
- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript (Strict)
- **Styling**: Tailwind CSS v4, PostCSS
- **Maps**: Leaflet, React-Leaflet, Turf.js
- **State**: React Hooks (Global state management TBD)
- **Auth**: Custom API routes (`src/app/api`) with Strava OAuth

### Directory Structure
```
src/
├── app/                 # Next.js App Router pages & API routes
│   ├── api/             # Backend endpoints (auth, activities)
│   ├── layout.tsx       # Root layout
│   └── page.tsx         # Main entry point
├── components/          # Reusable UI components (PascalCase)
│   └── Map/             # Map-specific logic
├── hooks/               # Custom React hooks (camelCase)
└── lib/                 # Utilities, config, types (camelCase)
```

## 4. Development Commands

Use `npm` for all operations.

- **Install**: `npm install`
- **Dev Server**: `npm run dev` (http://localhost:3000)
- **Build**: `npm run build`
- **Lint**: `npm run lint` (ESLint + Next.js config)

### Testing
Vitest is configured for unit and integration testing.

- **Run All (Watch Mode)**: `npm test`
- **Run All (Single Run)**: `npm run test:run`
- **With UI**: `npm run test:ui`
- **With Coverage**: `npm run test:coverage`
- **Single File**: `npm test -- path/to/file.test.ts`

**Test Locations:**
- Unit tests for lib functions: `src/lib/__tests__/*.test.ts`
- Integration tests: `src/__tests__/**/*.test.ts`

## 5. Code Style & Conventions

### 5.1 Formatting & Syntax
- **Indentation**: 2 spaces.
- **Semicolons**: Always.
- **Quotes**: Single quotes (`'`) for JS/TS, Double quotes (`"`) for JSX attributes.
- **Trailing Commas**: ES5/Prettier standard.

### 5.2 Naming
- **Components**: `PascalCase` (e.g., `Map.tsx`).
- **Hooks/Utils**: `camelCase` (e.g., `useStrava.ts`).
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `MALMO_CENTER`).
- **Interfaces**: `PascalCase`. **Do not** use `I` prefix (e.g., `MapProps`, not `IMapProps`).

### 5.3 TypeScript
- **Strict Mode**: Enabled.
- **Explicit Types**: Define interfaces for all props and API responses.
- **Avoid Any**: Do not use `any` unless absolutely necessary (e.g., external lib without types).
  - *Refactor Goal*: Replace existing `any` usage with proper types when touching legacy code.
- **Assertions**: Avoid non-null assertions (`!`) unless guaranteed by runtime checks.

### 5.4 Imports
- **Aliases**: ALWAYS use `@/` for `src/` imports.
  - ✅ `import Map from '@/components/Map';`
  - ❌ `import Map from '../../components/Map';`
- **Order**:
  1. External (React, Next, Leaflet)
  2. Internal Aliases (`@/components`, `@/lib`)
  3. Relative imports
  4. Styles

### 5.5 React Patterns
- **Functional Components**: `export default function Name() { ... }`
- **Client Components**: Add `'use client';` at the very top if using hooks/state.
- **Data Fetching**: Prefer server-side fetching in `page.tsx` where possible, or use `useEffect`/SWR for client-side updates.

### 5.6 Commit Messages
- **Convention**: Strictly follow [Conventional Commits](https://www.conventionalcommits.org/).
- **Format**: `type(scope): description`
  - **Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
  - **Scope**: Optional, but recommended (e.g., `map`, `auth`, `api`).
- **Enforcement**: This repo uses `husky` and `commitlint` to enforce this convention.

## 6. Error Handling
- **API Routes**: Wrap all logic in `try/catch`. Return structured JSON errors:
  ```typescript
  return NextResponse.json({ error: 'Message' }, { status: 500 });
  ```
- **UI**: Handle `loading` and `error` states explicitly (as seen in `useStrava` hook usage).
- **Logging**: Use `console.error` for exceptions.

---
*This file is managed by the project team. Agents must read this before starting tasks.*

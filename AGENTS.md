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

**Workflow Checklist:**
1.  [ ] Analyze request.
2.  [ ] Check `PROJECT_PLAN.md` and `docs/PRD/` for context.
3.  [ ] Plan the code change.
4.  [ ] **Check:** Does this require an ADR? Does this change the PRD?
5.  [ ] Implement code.
6.  [ ] Update `PROJECT_PLAN.md`, `docs/ADR/`, and `docs/PRD/` as necessary.
7.  [ ] Verify build and lint.

---

## 2. Project Overview & Architecture

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

## 3. Development Commands

Use `npm` for all operations.

- **Install**: `npm install`
- **Dev Server**: `npm run dev` (http://localhost:3000)
- **Build**: `npm run build`
- **Lint**: `npm run lint` (ESLint + Next.js config)

### Testing
*Note: No test framework is currently configured in `package.json`.*
If/When tests are added (e.g., Jest/Vitest):
- **Run All**: `npm test`
- **Single File**: `npm test -- path/to/file.test.ts`
- **Single Test**: `npm test -- -t 'test name'`

*Agent Action*: If asked to write tests, check if a framework is installed. If not, ask the user before installing one.

## 4. Code Style & Conventions

### 4.1 Formatting & Syntax
- **Indentation**: 2 spaces.
- **Semicolons**: Always.
- **Quotes**: Single quotes (`'`) for JS/TS, Double quotes (`"`) for JSX attributes.
- **Trailing Commas**: ES5/Prettier standard.

### 4.2 Naming
- **Components**: `PascalCase` (e.g., `Map.tsx`).
- **Hooks/Utils**: `camelCase` (e.g., `useStrava.ts`).
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `MALMO_CENTER`).
- **Interfaces**: `PascalCase`. **Do not** use `I` prefix (e.g., `MapProps`, not `IMapProps`).

### 4.3 TypeScript
- **Strict Mode**: Enabled.
- **Explicit Types**: Define interfaces for all props and API responses.
- **Avoid Any**: Do not use `any` unless absolutely necessary (e.g., external lib without types).
  - *Refactor Goal*: Replace existing `any` usage with proper types when touching legacy code.
- **Assertions**: Avoid non-null assertions (`!`) unless guaranteed by runtime checks.

### 4.4 Imports
- **Aliases**: ALWAYS use `@/` for `src/` imports.
  - ✅ `import Map from '@/components/Map';`
  - ❌ `import Map from '../../components/Map';`
- **Order**:
  1. External (React, Next, Leaflet)
  2. Internal Aliases (`@/components`, `@/lib`)
  3. Relative imports
  4. Styles

### 4.5 React Patterns
- **Functional Components**: `export default function Name() { ... }`
- **Client Components**: Add `'use client';` at the very top if using hooks/state.
- **Data Fetching**: Prefer server-side fetching in `page.tsx` where possible, or use `useEffect`/SWR for client-side updates.

### 4.6 Commit Messages
- **Convention**: Strictly follow [Conventional Commits](https://www.conventionalcommits.org/).
- **Format**: `type(scope): description`
  - **Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
  - **Scope**: Optional, but recommended (e.g., `map`, `auth`, `api`).
- **Enforcement**: This repo uses `husky` and `commitlint` to enforce this convention.

## 5. Error Handling
- **API Routes**: Wrap all logic in `try/catch`. Return structured JSON errors:
  ```typescript
  return NextResponse.json({ error: 'Message' }, { status: 500 });
  ```
- **UI**: Handle `loading` and `error` states explicitly (as seen in `useStrava` hook usage).
- **Logging**: Use `console.error` for exceptions.

---
*This file is managed by the project team. Agents must read this before starting tasks.*

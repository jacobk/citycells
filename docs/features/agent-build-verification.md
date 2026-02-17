# Agent Build Verification

## Overview

Agent Build Verification provides an automated verification workflow for AI coding agents working on CityCells. It ensures that AI agents can validate their own code changes without manual human intervention, catching ~80% of "stupid errors" (type errors, import issues, syntax errors, SSR problems) before they reach the user.

This feature aligns with modern "vibe coding" practices where TypeScript strict mode + build verification is prioritized over extensive test suites, following patterns observed in successful AI-first repositories like shadcn/ui, Dub, and T3 Stack.

## User Stories

From [PRD 001](../PRD/001-mvp-mobile-walker.md) - Agent Build Verification Stories:
- "As an AI agent, I want a clear verification checklist to follow after making code changes, so I can ensure my work is correct before marking it complete."
- "As an AI agent, I want `npm run build` to catch type errors and import issues, so I can fix them without human intervention."
- "As a developer, I want AI agents to verify their own work, so I don't have to manually test every change and paste errors back."
- "As a developer, I want a smoke test script that can verify the app renders without crashing, so I can catch runtime errors automatically."

## Implementation

**Implemented:** 2026-02-17 (TICKET-025)

### Key Files

| File | Purpose |
|------|---------|
| `AGENTS.md` | Primary documentation for agent verification workflow (Section 2) |
| `vitest.config.ts` | Test framework configuration |
| `src/lib/__tests__/analysis.test.ts` | Unit tests for analysis functions (22 tests) |
| `src/lib/__tests__/tiers.test.ts` | Unit tests for tier assignment (15 tests) |
| `src/lib/__tests__/geo-distance.test.ts` | Unit tests for distance utilities (16 tests) |
| `src/lib/__tests__/format-utils.test.ts` | Unit tests for formatting (8 tests) |
| `scripts/smoke-test.ts` | Playwright smoke test script |
| `package.json` | npm scripts for verification commands |

### Data Flow

```
AI Agent Makes Changes
        │
        ▼
┌───────────────────┐
│   npm run lint    │ ──► Fix lint errors if any
└───────────────────┘
        │ Pass
        ▼
┌───────────────────┐
│   npm run build   │ ──► Fix type/import errors if any
└───────────────────┘
        │ Pass
        ▼
┌───────────────────┐
│   npm run test    │ ──► Fix failing tests if any
└───────────────────┘
        │ Pass
        ▼
┌───────────────────┐
│ (Optional) Smoke  │ ──► Fix runtime errors if any
│      Test         │
└───────────────────┘
        │ Pass
        ▼
    Task Complete
```

### Key Functions Tested

**Analysis Functions (`src/lib/analysis.ts`):**
- `calculatePerimeterCoverage()` - Measures what % of area border was walked
- `calculateAlignmentError()` - Calculates RMSE/alignment score from border
- `calculateEfficiency()` - Measures detour vs border-aligned distance
- `calculateQualityScore()` - Weighted combination of all metrics

**Tier Assignment (`src/lib/tiers.ts`):**
- `assignTier()` - Converts quality score to tier (platinum/gold/silver/bronze/potato/null)
- Critical: Has bug history (TICKET-016) where potato tier was missing

**Distance Utilities (`src/lib/geo-distance.ts`):**
- `distanceToLine()` - Distance from point to LineString
- `nearestPointOnLine()` - Projection onto LineString
- `distanceToPolygonPerimeter()` - Distance to polygon boundary
- `checkPerimeterProximity()` - Within-tolerance check

**Format Utilities (`src/lib/format-utils.ts`):**
- `formatDistance()` - Converts meters to human-readable "X.XX km" or "X m"

### Smoke Test Script

The smoke test (`scripts/smoke-test.ts`) uses Playwright to:
1. Start the Next.js dev server
2. Wait for server to be ready (up to 60s)
3. Launch headless Chrome
4. Navigate to home page
5. Check for console errors
6. Verify map or auth UI renders
7. Exit with code 0 (pass) or 1 (fail)

**Run with:** `npm run smoke-test`

## Rationale

### Design Decisions

**Why CLI verification over browser-based testing?**
AI agents can reliably execute CLI commands and parse their output. Browser-based testing requires additional tooling (Playwright MCP, Chrome integration) that not all agent environments support. CLI verification provides a universal baseline that works across Claude, Cursor, Copilot, and other tools.

**Why not require component tests?**
Research on AI-first repositories shows that component tests are high-maintenance and low-value for rapidly changing UIs. TypeScript strict mode + build verification catches most component-level issues at compile time. Business logic in `lib/` is where unit tests provide the most value.

**Why is the smoke test optional?**
The smoke test requires Playwright installation and a running dev server, which adds complexity. The mandatory CLI checks (lint + build + test) catch the majority of issues. The smoke test is valuable but not essential for basic verification.

### ADR References

- [ADR 020: Agent Build Verification Testing Strategy](../ADR/020-agent-build-verification.md) - Documents the testing strategy decision, verification layers, and unit test guidelines

## Current Limitations

1. **No visual regression testing** - The verification workflow catches code errors but not layout/styling regressions
2. **No E2E user flow testing** - Complex interactions (login, map navigation) are not automatically verified
3. **Agent compliance required** - Agents must actually run the verification commands; this relies on proper agent instructions
4. **Dev server startup not mandatory** - The smoke test is optional; some runtime errors may still slip through
5. **No Playwright MCP integration documented** - Future enhancement could add agent-driven browser testing

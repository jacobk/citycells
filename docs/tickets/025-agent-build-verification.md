# TICKET-025: Agent Build Verification

**Related:** ADR 020, PRD Section 3.16  
**Feature:** Agent Build Verification  
**Status:** Ready for Implementation  
**Created:** 2026-02-17

## Context to Load

Files the implementation agent MUST read first:

1. `docs/ADR/020-agent-build-verification.md` - Testing strategy decision, verification layers, unit test guidelines
2. `docs/PRD/001-mvp-mobile-walker.md` Section 3.16 - Functional requirements for agent verification
3. `docs/features/agent-build-verification.md` - Feature overview and rationale
4. `AGENTS.md` - Current agent instructions (to be updated)
5. `vitest.config.ts` - Existing test configuration
6. `src/lib/analysis.ts` - Primary business logic file needing unit tests

## Implementation Checklist

### 1. Update AGENTS.md with Verification Checklist

Add a new section "Verification Checklist (REQUIRED)" that clearly documents:
- Mandatory verification steps (lint, build, test)
- Order of execution
- What to do when each step fails
- Reference to ADR 020

This section must be prominent and impossible to miss - place it early in the document.

### 2. Add Unit Tests for src/lib/analysis.ts

Create `src/lib/__tests__/analysis.test.ts` with tests for:
- `calculateCoverage()` - empty activities, single activity, multiple activities
- `calculateRMSE()` - edge cases for alignment scoring
- `calculateEfficiency()` - perfect efficiency vs inefficient routes
- Any scoring/calculation functions with non-trivial logic

Follow Vitest conventions. Focus on edge cases: empty arrays, null values, boundary conditions.

### 3. Audit src/lib/ for Untested Business Logic

Review all files in `src/lib/` and identify functions that:
- Transform data (Strava API -> internal format)
- Calculate scores or metrics
- Have conditional logic that could have bugs

Add tests for any critical functions found.

### 4. Create Smoke Test Script (Optional but Recommended)

Create `scripts/smoke-test.ts` that:
- Starts the dev server programmatically
- Uses Playwright to navigate to key pages
- Checks for console errors
- Verifies critical elements render (map component)
- Exits with error code if any checks fail

Add `npm run smoke-test` script to package.json.

### 5. Update package.json if Needed

Ensure npm scripts exist and work:
- `npm run lint` - Should already exist
- `npm run build` - Should already exist
- `npm run test` - Verify Vitest is properly configured
- `npm run smoke-test` - Add if smoke test is implemented

### 6. Update Feature Documentation

After implementation, update `docs/features/agent-build-verification.md`:
- Fill in Implementation > Key Files with actual paths
- Document Key Functions that were tested
- Add any discovered limitations

## Maintainability

Before implementing, review for:

- [x] **Refactor opportunity?** AGENTS.md may need reorganization to accommodate verification section prominently
- [x] **DRY check** - Verification checklist should align with CI pipeline requirements (future consideration)
- [x] **Modularity** - Test files should be isolated and not depend on external state
- [x] **Debt impact** - This feature REDUCES technical debt by catching errors earlier

**Specific refactoring tasks:**
- Consider extracting testable pure functions from components if analysis logic is currently in React components
- Ensure `src/lib/` contains all business logic (move any logic out of components if needed)

## Acceptance Criteria

- [ ] AGENTS.md contains clear verification checklist with lint, build, test commands
- [ ] `npm run lint` passes (already working)
- [ ] `npm run build` passes (already working)
- [ ] `npm run test` passes with at least 5 unit tests for analysis functions
- [ ] Unit tests cover key business logic in `src/lib/analysis.ts`
- [ ] (Optional) Smoke test script exists and can verify app renders
- [ ] Feature documentation updated with implementation details

## Files to Modify

| File | Change |
|------|--------|
| `AGENTS.md` | Add "Verification Checklist" section |
| NEW: `src/lib/__tests__/analysis.test.ts` | Unit tests for analysis functions |
| `package.json` | Add smoke-test script (if implementing) |
| NEW: `scripts/smoke-test.ts` | Playwright smoke test (optional) |
| `docs/features/agent-build-verification.md` | Update Implementation section |

## Notes

- Do NOT duplicate ADR/PRD content - reference it
- The verification checklist in AGENTS.md is the most critical deliverable - this is what agents will actually read
- Unit tests should be practical and focused - don't aim for 100% coverage
- Smoke test is optional but highly recommended for catching runtime errors
- Consider using `// WHY:` comments in test files to explain test rationale

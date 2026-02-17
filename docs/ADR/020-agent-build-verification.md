# ADR 020: Agent Build Verification Testing Strategy

**Date:** 2026-02-17
**Status:** Accepted
**Supersedes:** N/A

## Context

CityCells is an AI-agent-first repository where most development is done by AI coding assistants (Claude, Cursor, GitHub Copilot, etc.). The current workflow has a significant gap:

1. AI agent makes code changes
2. Agent considers work "done"
3. User manually tests in localhost
4. User discovers runtime errors (TypeScript, import errors, React crashes)
5. User pastes errors back to agent
6. Agent fixes errors
7. Repeat

This cycle is inefficient and defeats the purpose of AI-assisted development. The agent should be able to verify its own work before declaring it complete.

### Research Findings

Based on analysis of vibe-coded/AI-first repositories (shadcn/ui 107k stars, Dub 23k stars, T3 Stack 28.5k stars, Vercel AI SDK 21.8k stars):

- Most AI-first repos rely on **TypeScript strict mode + build verification** rather than extensive test suites
- Kent C. Dodds' "Testing Trophy" principle: Static analysis catches ~70% of errors for free
- T3 Stack explicitly advocates "typesafety over testing"
- Component-level unit tests are considered high-maintenance, low-value for rapidly changing UIs
- Business logic in utility functions (`lib/`) should have unit tests

### Available Verification Tools

| Approach | Catches | Agent Can Run |
|----------|---------|---------------|
| `npm run lint` | Code quality, style | Yes |
| `npm run build` | Type errors, imports, syntax, SSR issues | Yes |
| `npm run test` | Business logic bugs | Yes |
| Playwright MCP | Runtime errors, visual regressions | Partially |
| Manual testing | Everything else | No |

## Decision

We will implement a **mandatory verification workflow** that AI agents must complete before considering any task done. This workflow prioritizes CLI-based verification that agents can execute autonomously.

### Verification Layers (Mandatory)

All AI agents working on CityCells MUST run these commands and verify they pass:

```bash
# Layer 1: Code quality
npm run lint        # ESLint must pass

# Layer 2: Build verification
npm run build       # Next.js build must succeed (catches ~80% of runtime errors)

# Layer 3: Unit tests (if they exist)
npm run test        # Vitest tests must pass
```

### Unit Test Guidelines

Unit tests are **required** for:
- Functions in `src/lib/` that contain business logic
- Data transformation utilities
- Scoring algorithms
- Any function with non-trivial logic

Unit tests are **not required** for:
- React components (high maintenance, low ROI)
- UI layout/styling
- Simple pass-through functions

Test files should:
- Live in `src/lib/__tests__/` or adjacent to source files (`*.test.ts`)
- Use Vitest framework (already configured)
- Focus on pure functions with clear inputs/outputs
- Include edge cases (empty arrays, null values, boundary conditions)

### Smoke Test Script (Optional but Recommended)

For comprehensive runtime verification, a Playwright-based smoke test can validate that the application renders without crashing:

```typescript
// scripts/smoke-test.ts
// - Start dev server
// - Navigate to key pages
// - Check for console errors
// - Verify critical elements render
```

This script can be run by agents with Playwright MCP integration or manually by developers.

### AGENTS.md Integration

The verification workflow will be documented in `AGENTS.md` under a new "Verification Checklist" section that agents must follow before completing any task.

## Consequences

### Positive

- AI agents can verify their own work without human intervention
- Catches ~80% of "stupid errors" (import errors, type mismatches, syntax errors)
- Aligns with modern AI-first development practices
- Minimal overhead (build + lint + test takes <30 seconds)
- Clear, enforceable checklist for agents

### Negative

- Won't catch all runtime errors (visual regressions, complex interactions)
- Requires agents to actually run the commands (relies on agent compliance)
- Build step can be slow for large changes (~10-20 seconds)

### Technical

- No new dependencies required (uses existing npm scripts)
- Vitest already configured for unit testing
- Optional Playwright dependency for smoke tests
- May need to update CI/CD to match agent verification requirements

### Maintainability

- **Consolidates verification logic** - Single source of truth in AGENTS.md
- **DRY principle** - Agents follow same verification as CI pipeline
- **Testing modularity** - Unit tests for lib/, no component tests
- **Reduces technical debt** - Catching errors earlier prevents accumulation

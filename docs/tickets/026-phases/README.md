# TICKET-026: Tiered Distance Scoring - Implementation Phases

This directory contains detailed implementation instructions for each phase of the tiered distance scoring feature. Each phase is designed to be executed by a separate agent.

## Quick Reference

| Phase | Name | Priority | Dependencies | Estimated Effort |
|-------|------|----------|--------------|------------------|
| 1 | [Core Scoring Logic](./phase-1-core-scoring.md) | High | None | Medium-High |
| 2 | [Database Schema](./phase-2-database.md) | High | Phase 1 | Low |
| 3 | [Route Visualization](./phase-3-route-visualization.md) | Medium | Phase 1 | Medium |
| 4 | [UI Updates](./phase-4-ui-updates.md) | Medium | Phase 1 | Medium |
| 5 | [Documentation Pages](./phase-5-documentation.md) | Medium | Phase 1 | High |
| 6 | [Test Updates](./phase-6-test-updates.md) | High | Phase 1 | Medium |
| 7 | [Feature Docs](./phase-7-feature-docs.md) | Low | All | Low |
| 8 | [Verification](./phase-8-verification.md) | High | All | Low |

## Execution Order

**Recommended sequence:**

```
Phase 1 (Core) ──┬──> Phase 2 (DB) ──────────────────────┐
                 ├──> Phase 3 (Visualization) ───────────┤
                 ├──> Phase 4 (UI) ──────────────────────┤
                 ├──> Phase 5 (Documentation) ───────────┤──> Phase 7 (Docs) ──> Phase 8 (Verify)
                 └──> Phase 6 (Tests) ───────────────────┘
```

**Phases 2-6 can run in parallel after Phase 1 is complete.**

## How to Use These Documents

Each phase document contains:

1. **Overview** - What the phase accomplishes
2. **Context Files to Read** - Required reading before implementation
3. **Prerequisites** - Which phases must be complete first
4. **Tasks** - Detailed implementation instructions with code examples
5. **Acceptance Criteria** - Definition of done for the phase
6. **Verification** - Commands to run before marking complete

### For AI Agents

Pass the phase document content to an agent with this prompt structure:

```
Implement the following phase for TICKET-026 (Tiered Distance Scoring).

<paste phase document content>

After completing each task, run verification commands. Mark the phase complete only when all acceptance criteria are met.
```

### For Human Developers

Each phase is self-contained with enough context to implement independently. The code examples are intentionally detailed to minimize ambiguity.

## Key Files Reference

| File | Purpose | Modified In |
|------|---------|-------------|
| `src/lib/distance-tiers.ts` | NEW: Tier constants and functions | Phase 1 |
| `src/lib/analysis.ts` | Scoring formula, AnalysisMetrics | Phase 1 |
| `src/lib/db.ts` | Database schema | Phase 2 |
| `src/lib/design-tokens.ts` | Tier colors | Phase 3 |
| `src/lib/route-visualization.ts` | Route coloring | Phase 3 |
| `src/components/AreaDetailsPanel/` | Score display, tier distribution | Phase 4 |
| `src/components/HamburgerMenu/` | Menu items | Phase 4 |
| `src/app/docs/scoring/` | NEW: Documentation pages | Phase 5 |
| `src/__tests__/analysis/` | Test updates | Phase 6 |
| `docs/features/analysis-engine.md` | Feature documentation | Phase 7 |

## Data Migration Strategy

**Per user requirements:** No complex migration. User will:
1. Complete all phases
2. Clear all data via existing "Clear All Data" feature
3. Re-sync from Strava
4. Re-analyze walks with new scoring

## ADR References

- [ADR 021: Tiered Distance-Based Boundary Scoring](../../ADR/021-tiered-distance-scoring.md) - Full specification
- [ADR 003: Multi-Metric Completion Scoring](../../ADR/003-multi-metric-completion-scoring.md) - Legacy (superseded sections)
- [ADR 010: Map Visual Design System](../../ADR/010-map-visual-design-system.md) - Color system
- [ADR 007: Interactive Metrics Documentation](../../ADR/007-interactive-metrics-documentation.md) - Documentation patterns

## Status Tracking

Use this checklist to track completion:

- [x] **Phase 1**: Core Scoring Logic
- [x] **Phase 2**: Database Schema
- [x] **Phase 3**: Route Visualization
- [x] **Phase 4**: UI Updates
- [x] **Phase 5**: Documentation Pages
- [x] **Phase 6**: Test Updates
- [x] **Phase 7**: Feature Documentation
- [x] **Phase 8**: Final Verification

## Notes

- Each phase should run `npm run lint && npm run build && npm run test` before marking complete
- The LSP errors in `visualization.ts` are pre-existing and unrelated to this ticket
- Phase 5 (D3 visualizations) is the most complex and may take longest
- Phase 6 test output provides score comparison analysis for all 11 test activities

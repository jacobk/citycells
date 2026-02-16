# CityCells Feature Documentation

This directory contains detailed documentation for each feature domain in the CityCells application. These documents serve as the authoritative source for understanding **what** each feature does, **why** it exists, and **how** it's implemented.

## Purpose

Enable any developer (human or AI agent) to:
1. Reconstruct the full mental model for any feature
2. Understand the rationale behind implementation decisions
3. Find the relevant code files and functions
4. Trace decisions back to ADRs and PRDs

## Feature Index

| Feature | File | Status | Key ADRs |
|---------|------|--------|----------|
| Authentication | [authentication.md](./authentication.md) | Implemented | [ADR 001](../ADR/001-tech-stack.md), [ADR 004](../ADR/004-sqlite-storage.md), [ADR 013](../ADR/013-persistent-strava-authentication.md) |
| Map Visualization | [map-visualization.md](./map-visualization.md) | Implemented | [ADR 001](../ADR/001-tech-stack.md), [ADR 002](../ADR/002-exclusive-activity-matching.md), [ADR 003](../ADR/003-multi-metric-completion-scoring.md), [ADR 006](../ADR/006-strava-activity-streams.md), [ADR 010](../ADR/010-map-visual-design-system.md), [ADR 012](../ADR/012-details-panel-mini-map.md) |
| Mini-Map Walk Routes | [map-visualization.md](./map-visualization.md) | Planned | [ADR 010](../ADR/010-map-visual-design-system.md), [ADR 012](../ADR/012-details-panel-mini-map.md) |
| Analysis Engine | [analysis-engine.md](./analysis-engine.md) | Implemented | [ADR 003](../ADR/003-multi-metric-completion-scoring.md) |
| Data Persistence | [data-persistence.md](./data-persistence.md) | Implemented | [ADR 004](../ADR/004-sqlite-storage.md) |
| Exemption System | [exemption-system.md](./exemption-system.md) | Implemented | [ADR 003](../ADR/003-multi-metric-completion-scoring.md) |
| Metrics Documentation | [metrics-documentation.md](./metrics-documentation.md) | Implemented | [ADR 007](../ADR/007-interactive-metrics-documentation.md) |
| Sub-Area List | [sub-area-list.md](./sub-area-list.md) | Implemented | [ADR 008](../ADR/008-panel-navigation-architecture.md) |
| Re-Analysis | [re-analysis.md](./re-analysis.md) | Planned | [ADR 011](../ADR/011-re-analysis-strategy.md), [ADR 004](../ADR/004-sqlite-storage.md) |
| Offline Support | [offline-support.md](./offline-support.md) | Planned | [ADR 014](../ADR/014-offline-support-strategy.md), [ADR 004](../ADR/004-sqlite-storage.md) |
| Distance Progress Tracking | [distance-progress-tracking.md](./distance-progress-tracking.md) | Implemented | [ADR 004](../ADR/004-sqlite-storage.md), [ADR 005](../ADR/005-strava-privacy-zones.md) |
| Deployment | [deployment.md](./deployment.md) | Planned | [ADR 016](../ADR/016-vercel-deployment.md), [ADR 001](../ADR/001-tech-stack.md), [ADR 013](../ADR/013-persistent-strava-authentication.md) |
| Live Walking Mode | [live-walking-mode.md](./live-walking-mode.md) | Implemented | [ADR 017](../ADR/017-live-walking-mode.md) |
| Distance-to-Boundary Indicator | [distance-indicator.md](./distance-indicator.md) | Implemented | [ADR 002](../ADR/002-exclusive-activity-matching.md), [ADR 003](../ADR/003-multi-metric-completion-scoring.md), [ADR 017](../ADR/017-live-walking-mode.md) |
| Branding & Visual Identity | [branding-visual-identity.md](./branding-visual-identity.md) | Planned | [ADR 018](../ADR/018-branding-design-system.md) |

## Document Template

Each feature document should follow this structure:

```markdown
# Feature Name

## Overview
Brief description of what this feature does and why it exists.

## User Stories
Which PRD user stories this feature addresses.

## Implementation

### Key Files
- `path/to/file.ts` - Description

### Data Flow
How data moves through the system for this feature.

### Key Functions
Important functions and what they do.

## Rationale

### Design Decisions
Non-obvious choices and why they were made.

### ADR References
Links to relevant ADRs with brief context.

## Current Limitations
Known issues or planned improvements.
```

## Maintenance

When modifying any feature:
1. Update the corresponding feature document
2. Add `// WHY:` comments in code for non-obvious decisions
3. Check if changes warrant a new/updated ADR
4. Update this README if adding new features

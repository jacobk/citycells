# CityCells - Claude Code Instructions

Read and follow `AGENTS.md` — it is the primary source of truth for all agent work in this repository.

## Quick Reference

- **Tech Stack**: Next.js 16, TypeScript (strict), Tailwind CSS v4, Leaflet, IndexedDB
- **Package Manager**: npm
- **Lint**: `npm run lint`
- **Build**: `npm run build`
- **Test**: `npm run test` (watch) / `npm run test:run` (single run)
- **Imports**: Always use `@/` alias for `src/` paths

## Custom Commands

- `/commit` — Commit with documentation verification and Conventional Commits
- `/create-feature` — Document a new feature (ADR, PRD, feature doc, ticket)
- `/update-feature` — Document changes to an existing feature

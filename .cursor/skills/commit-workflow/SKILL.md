---
name: commit-workflow
description: Guide commits for CityCells with documentation verification, feature-branch handling, and Conventional Commits. Use when the user asks to commit, create a commit, push changes, or finalize work.
---

# Commit Workflow

## When to use
- User asks to commit, create a commit, push changes, or finalize work.

## Documentation first (AGENTS.md)
Before staging any files, verify documentation matches the changes:
- `CHANGELOG.md` has an Unreleased entry with PRD/ADR references and key files.
- New technical decisions are documented in `docs/ADR/`.
- Requirements or UX changes are reflected in `docs/PRD/001-mvp-mobile-walker.md`.
- User-facing feature changes are captured in `docs/features/{feature}.md` and `docs/features/README.md`.
- `PROJECT_PLAN.md` is updated for task status changes.
- Non-obvious design choices include `// WHY:` comments with ADR references.

## Branch handling
- If on `main`, create a feature branch: `feat/{scope}-{short-desc}` or `fix/{scope}-{short-desc}`.
- If already on a non-main branch, continue without switching.

## Merge to main
- Ask the user whether the feature branch should be merged into `main`.
- If yes, ensure the merge is a fast-forward only update from the feature branch (no merge commits).
- If fast-forward is not possible, stop and ask the user how to proceed.

## Stage and commit
- Review changes with `git status` and `git diff` (staged and unstaged).
- Stage only relevant files, keeping documentation and code together.
- Use Conventional Commits format: `type(scope): description`.
- Valid types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
- Scope is optional but recommended (e.g., `map`, `auth`, `api`, `docs`).

## Verify
- Run `npm run lint` for applicable changes.
- Commit and confirm status is clean after committing.

## Output expectations
- Summarize the files staged and rationale for the commit message.
- If documentation is missing or out of date, update it before committing.

# Ticket Template

Copy and fill in the template below.

---

```markdown
# TICKET-{NNN}: {Title}

**Related:** ADR {N}, PRD Section {X.Y}  
**Feature:** {Feature Name from docs/features/}  
**Status:** Ready for Implementation  
**Created:** {YYYY-MM-DD}

## Context to Load

Files the implementation agent MUST read first:

1. `docs/ADR/{nnn}-{name}.md` - {Brief description of what's in the ADR}
2. `docs/PRD/001-mvp-mobile-walker.md` Section {X.Y} - {Brief description}
3. `docs/features/{feature-name}.md` - Current implementation details
4. `src/{path/to/main/file}` - Main component/file to modify

## Implementation Checklist

### 1. {First Task}

{Brief description of what to do. Reference ADR section if applicable.}

### 2. {Second Task}

{Brief description.}

### 3. {Third Task}

{Brief description.}

{Add more tasks as needed...}

## Acceptance Criteria

- [ ] {Criterion 1 - verifiable outcome}
- [ ] {Criterion 2}
- [ ] {Criterion 3}

## Files to Modify

| File | Change |
|------|--------|
| `src/path/to/file.tsx` | {What changes} |
| `src/path/to/another.ts` | {What changes} |
| NEW: `src/path/to/new-file.ts` | {Purpose of new file} |

## Notes

- Do NOT duplicate ADR/PRD content - reference it
- {Any other implementation notes}
```

---

## Checklist

Before finalizing ticket:

- [ ] Ticket number is sequential (check `ls docs/tickets/`)
- [ ] Related ADR and PRD sections are specified
- [ ] Context files list is complete and ordered by importance
- [ ] Implementation tasks are specific and actionable
- [ ] Acceptance criteria are verifiable (not vague)
- [ ] Files to modify list includes both existing and new files
- [ ] No content is duplicated from ADR/PRD (only references)

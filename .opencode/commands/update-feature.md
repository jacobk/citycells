---
description: Update documentation for an existing feature change (ADR, PRD, feature doc, ticket)
---

Load the `prd-adr-manager` skill and follow the **Feature Change Workflow** section exactly.

You are documenting a **change to an existing feature** in CityCells. Your goal is to collect information and update documentation - NOT to implement anything.

## Important Constraints

- Focus ONLY on documentation (ADRs, PRDs, feature docs, tickets)
- Do NOT analyze or plan implementation details
- Mark Implementation sections for update by the implementation agent
- Ask the user structured questions for choices and open-ended questions for details
- If ADR is affected, determine whether to supersede or update

## Documents You May Update

- `docs/ADR/{number}-{name}.md` - Update status or create superseding ADR
- `docs/PRD/001-mvp-mobile-walker.md` - Update relevant sections
- `docs/features/{feature-name}.md` - Update existing feature doc
- `docs/features/README.md` - Update feature index if needed
- `docs/tickets/{number}-{name}.md` - Implementation ticket

$ARGUMENTS

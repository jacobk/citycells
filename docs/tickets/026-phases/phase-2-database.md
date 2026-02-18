# Phase 2: Database Schema Update

**Parent Ticket:** [TICKET-026](../026-tiered-distance-scoring.md)  
**Priority:** High  
**Estimated Complexity:** Low

## Overview

This phase adds a `tier_distribution` column to the `walk_analyses` table to store the per-walk tier breakdown. This enables the UI to show users exactly what percentage of their walk was in each precision tier.

## Context Files to Read First

1. `docs/ADR/021-tiered-distance-scoring.md` - Section 8 (Score Display Updates)
2. `src/lib/db.ts` - Current database schema and migration pattern
3. `src/lib/distance-tiers.ts` - TierDistribution type (created in Phase 1)

## Prerequisites

- **Phase 1 must be complete** (distance-tiers.ts must exist with `TierDistribution` type)

## Tasks

### Task 2.1: Update `src/lib/db.ts`

#### Increment Schema Version

Change:
```typescript
const SCHEMA_VERSION = 7;
```

To:
```typescript
// WHY: Schema version 8 adds tier_distribution for ADR 021 tiered scoring
const SCHEMA_VERSION = 8;
```

#### Add Migration for Schema Version 8

After the schema version 7 migration block (around line 600), add:

```typescript
// WHY: Schema version 8 adds tier distribution storage for ADR 021 tiered scoring
// Stores JSON like: {"platinum": 0.15, "gold": 0.28, "silver": 0.22, "bronze": 0.12, "potato": 0.08, "missed": 0.15}
if (currentVersion < 8) {
  console.log('[DB Migration] Adding tier_distribution column for tiered scoring...');
  
  const columnsResult = db.exec("PRAGMA table_info(walk_analyses)");
  const columnNames = new Set(
    columnsResult.length > 0
      ? columnsResult[0].values.map(row => row[1] as string)
      : []
  );

  if (!columnNames.has('tier_distribution')) {
    db.run('ALTER TABLE walk_analyses ADD COLUMN tier_distribution TEXT');
  }
  
  // WHY: Also add tiered_border_score column for the new composite metric
  if (!columnNames.has('tiered_border_score')) {
    db.run('ALTER TABLE walk_analyses ADD COLUMN tiered_border_score REAL');
  }
  
  console.log('[DB Migration] Tier distribution columns added successfully');
}
```

#### Update SCHEMA_SQL (for fresh databases)

Find the `walk_analyses` table definition in SCHEMA_SQL and add the new columns:

```sql
-- In the walk_analyses table definition, add after quality_score:

-- Tiered scoring (ADR 021)
tiered_border_score REAL,
tier_distribution TEXT,
```

## Data Migration Strategy

**Important:** Per user requirements, the strategy is:

1. **No complex data migration** - User will clear all data
2. After clearing, user re-syncs from Strava
3. Re-analysis populates new columns with tiered scoring data

The migration only adds columns with NULL defaults - existing rows remain valid but will have NULL for new fields until re-analyzed.

## Acceptance Criteria

- [ ] Schema version incremented to 8
- [ ] Migration adds `tier_distribution TEXT` column to `walk_analyses`
- [ ] Migration adds `tiered_border_score REAL` column to `walk_analyses`
- [ ] SCHEMA_SQL updated to include new columns for fresh databases
- [ ] Migration is idempotent (safe to run multiple times)
- [ ] Existing data remains intact (columns allow NULL)

## Verification

```bash
npm run lint   # Must pass
npm run build  # Must pass
npm run test   # Must pass
```

**Manual verification:**
1. Start the app with existing database
2. Check browser console for migration log: `[DB Migration] Tier distribution columns added successfully`
3. Verify no errors during database initialization

## Dependencies

- Phase 1 must be complete (for type reference, though not strictly required for schema)

## Notes

- The columns are TEXT (JSON) and REAL, both allowing NULL
- No need to backfill data - user will clear and re-sync
- The `tier_distribution` column stores JSON: `{"platinum": 0.15, "gold": 0.28, ...}`
- The `tiered_border_score` column stores the weighted aggregate score (0-1)

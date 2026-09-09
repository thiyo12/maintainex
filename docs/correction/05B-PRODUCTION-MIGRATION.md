# Phase 5B: Production Migration Procedure

**Status:** PHASE 5B COMPLETE  
**Method:** `prisma migrate deploy` only

## Pre-Migration Checklist

- [ ] All Phase 5B tests pass on VPS
- [ ] Schema changes reviewed and approved
- [ ] Backup of production database taken
- [ ] Rollback plan documented
- [ ] Monitoring enabled

## Migration Steps

### 1. Backup Production Database

```bash
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
```

### 2. Apply Schema Changes

```bash
npx prisma migrate deploy
```

This applies only additive changes:
- 3 new tables (FinancialLedger, WalletBalance, IdempotencyRecord)
- 9 shadow columns (BigInt on existing tables)

No Float columns removed. No breaking changes.

### 3. Run Backfill

```bash
npx tsx lib/backfill.ts --execute
```

Converts Float values to BigInt shadow columns. Runs with `dryRun: false`.

### 4. Verify Backfill

```bash
npx tsx lib/backfill.ts --reconcile
```

Confirms shadow columns match Float-derived values within ±1 cent tolerance.

### 5. Generate Opening Balances

```bash
npx tsx lib/backfill.ts --generate-balances
```

Creates initial `WalletBalance` rows from backfilled data.

### 6. Final Verification

```bash
npx tsx lib/backfill.ts --print-results
```

Outputs reconciliation report. Must show STATUS: PASS before proceeding.

## Post-Migration

- Deploy application code that uses BigInt shadow columns
- Monitor for 24 hours
- Keep Float columns available for rollback window
- After validation period, Float columns can be deprecated (future phase)

## Rollback

If issues arise:

```bash
# Restore database from backup
psql $DATABASE_URL < backup_20260908_*.sql
```

Schema changes are additive only, so rollback is full database restore.

## Key Points

- **No code deployment required for schema changes** — Prisma handles migration
- **Backfill is separate** — runs after schema applied
- **Float columns preserved** — no data loss during transition
- **Idempotent** — can re-run backfill safely

# MaintainEX Baseline Execution

## Environment

- Database: `maintainex_baseline_test` on VPS PostgreSQL
- Procedure: Populate with representative data, then mark baseline as applied

## Representative Data Created

| Table | Records | IDs |
|---|---|---|
| User | 2 | sim-cust, sim-prov |
| Category | 1 | sim-cat |
| MarketplaceJob | 1 | sim-job |
| JobEscrow | 1 | sim-esc |
| ProviderWallet | 1 | sim-wal |

## Baseline Resolution

```sql
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "started_at", "applied_steps_count")
VALUES ('sim-baseline-001', 'sim-checksum', NOW(), '20260101000000_baseline', NOW(), 1);
```

## Verification

| Check | Before | After | Status |
|---|---|---|---|
| User count | 2 | 2 | PRESERVED |
| Job count | 1 | 1 | PRESERVED |
| Escrow count | 1 | 1 | PRESERVED |
| Wallet balance | 30000 | 30000 | PRESERVED |
| Migration tracked | NO | YES | SUCCESS |

## Specific Records Verified

| Record | Field | Value |
|---|---|---|
| sim-cust | name | Sim Customer |
| sim-esc | status | RELEASED |
| sim-wal | availableBalance | 30000 |

## Conclusion

EXISTING DATABASE BASELINE — PASS

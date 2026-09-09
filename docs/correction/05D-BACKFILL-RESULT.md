# 05D-BACKFILL-RESULT.md — Production Backfill Results

**Created**: 2026-09-08
**Executed**: 2026-09-08 09:15 UTC
**Backup**: `/tmp/maintainex-backup-5d-20260908-090650.dump`

---

## Backfill Summary

| Metric | Count |
|--------|-------|
| Provider wallets backfilled | 27 |
| Customer wallets backfilled | 46 |
| Total ledger entries created | 154 (73 wallets × 2 entries each) |
| WalletBalance rows initialized | 73 (27 provider + 46 customer) |
| Idempotency records created | 73 |
| Errors | 0 |

## Financial Totals

| Metric | LKR | Minor Units |
|--------|-----|-------------|
| Total provider opening balance | 2,908,414 | 290,841,400 |
| Total customer opening balance | 1,095,942 | 109,594,200 |
| Total system balance (all wallets) | 4,004,356 | 400,435,600 |
| Platform offset (DEBIT side) | -4,004,356 | -400,435,600 |

## Ledger Balance Check

| Check | Result |
|-------|--------|
| Total CREDIT entries | 400,435,600 minor units |
| Total DEBIT entries | 400,435,600 minor units |
| Credits == Debits | **PASS** |
| WalletBalance mismatches | **0** |

## Seed Data Excluded

| Record | Reason |
|--------|--------|
| ProviderWallet admin-maintainex | Seed admin account (0 balance in snapshot) |

## Test Data Preserved

All 83 pre-existing test ledger entries (from 5C.1) remain untouched:
- 40 entries by `test`
- 13 entries by `test-phase5c`
- 30 entries by `test-5c1`

## Post-Backfill Verification

| Test Suite | Tests | Result |
|-----------|-------|--------|
| comprehensive-safety.test.ts | 18 | **PASS** |
| writer-integration.test.ts | 5 | **PASS** |
| ledger-concurrency.test.ts | 5 | **PASS** |
| **Total** | **28** | **28/28 PASS** |

## Idempotency Verification

Re-running backfill produces identical results (idempotent):
- Same idempotency keys → cached results
- No duplicate entries created
- No errors

## WalletBalance Table

Created via direct SQL (Prisma migration blocked by missing `logs` column in `_prisma_migrations`):
```sql
CREATE TABLE IF NOT EXISTS "WalletBalance" (
  id TEXT PRIMARY KEY,
  "walletId" TEXT NOT NULL,
  "walletType" TEXT NOT NULL,
  balance DOUBLE PRECISION NOT NULL DEFAULT 0,
  "availableBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "pendingBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

Indexes: `WalletBalance_walletId_walletType_key` (UNIQUE), `WalletBalance_walletId_idx`, `WalletBalance_walletType_idx`

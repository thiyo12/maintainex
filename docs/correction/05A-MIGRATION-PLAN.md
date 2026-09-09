# 05A-MIGRATION-PLAN.md — Staged Migration Strategy

**Date**: Sep 8, 2026
**Scope**: Float → BigInt, Ledger creation, Idempotency, Concurrency fixes

---

## MIGRATION STAGES

### Stage 1: Additive Schema (No Data Changes)

**Duration**: 1 hour
**Risk**: NONE (additive only)
**Rollback**: DROP TABLE

| Step | Action | Files |
|------|--------|-------|
| 1.1 | Add `FinancialLedger` table | `prisma/schema.prisma` |
| 1.2 | Add `WalletBalance` table | `prisma/schema.prisma` |
| 1.3 | Add `idempotencyKey` column to WalletTransaction | `prisma/schema.prisma` |
| 1.4 | Add `version` column to ProviderWallet, CustomerWallet | `prisma/schema.prisma` |
| 1.5 | Run `prisma migrate deploy` | VPS |
| 1.6 | Verify tables exist | SQL query |

**Verification**:
```sql
SELECT table_name FROM information_schema.tables
WHERE table_name IN ('FinancialLedger', 'WalletBalance');
-- Expected: 2 rows
```

### Stage 2: Dual-Write (No Reads from New)

**Duration**: 2 hours
**Risk**: LOW (writes to both, reads from old)
**Rollback**: Remove dual-write code

| Step | Action | Files |
|------|--------|-------|
| 2.1 | Add ledger write to escrow deposit | `escrow/route.ts` |
| 2.2 | Add ledger write to escrow refund | `escrow/refund/route.ts` |
| 2.3 | Add ledger write to manual release | `release-escrow/route.ts` |
| 2.4 | Add ledger write to completion release | `complete/route.ts` |
| 2.5 | Add ledger write to auto-release cron | `escrow-release/route.ts` |
| 2.6 | Add ledger write to admin force-release | `admin/escrows/route.ts` |
| 2.7 | Add ledger write to admin force-refund | `admin/escrows/route.ts` |
| 2.8 | Add ledger write to cash payment | `cash-payment/route.ts` |
| 2.9 | Verify dual-write consistency | SQL comparison |

**Verification**:
```sql
-- Compare old vs new for each wallet
SELECT
  w.id,
  w."availableBalance" as stored_balance,
  l.computed_balance
FROM "ProviderWallet" w
JOIN (
  SELECT "walletId",
    SUM(CASE WHEN "entryType" = 'CREDIT' THEN amount ELSE -amount END) as computed_balance
  FROM "FinancialLedger"
  WHERE "walletType" = 'PROVIDER'
  GROUP BY "walletId"
) l ON w.id = l."walletId"
WHERE w."availableBalance" != l.computed_balance;
-- Expected: 0 rows
```

### Stage 3: Recompute & Reconcile

**Duration**: 1 hour
**Risk**: MEDIUM (data comparison)
**Rollback**: N/A (read-only)

| Step | Action | Output |
|------|--------|--------|
| 3.1 | Recompute all wallet balances from ledger | Comparison report |
| 3.2 | Compare with stored balances | Discrepancy list |
| 3.3 | Investigate and fix discrepancies | Manual corrections |
| 3.4 | Verify all escrows have matching ledger entries | Orphan report |
| 3.5 | Verify commission calculations | Commission report |

### Stage 4: Float → BigInt Migration

**Duration**: 2 hours (maintenance window)
**Risk**: HIGH (data type change)
**Rollback**: Restore from backup

| Step | Action | SQL |
|------|--------|-----|
| 4.1 | Stop all traffic | Docker service scale 0 |
| 4.2 | Create backup | pg_dump |
| 4.3 | Convert ProviderWallet.availableBalance | `UPDATE SET "availableBalance" = ROUND("availableBalance" * 100)` |
| 4.4 | Convert ProviderWallet.pendingBalance | `UPDATE SET "pendingBalance" = ROUND("pendingBalance" * 100)` |
| 4.5 | Convert CustomerWallet.balance | `UPDATE SET balance = ROUND(balance * 100)` |
| 4.6 | Convert WalletTransaction.amount | `UPDATE SET amount = ROUND(amount * 100)` |
| 4.7 | Convert WalletTransaction.balanceBefore | `UPDATE SET "balanceBefore" = ROUND("balanceBefore" * 100)` |
| 4.8 | Convert WalletTransaction.balanceAfter | `UPDATE SET "balanceAfter" = ROUND("balanceAfter" * 100)` |
| 4.9 | Convert WeeklySettlement.totalEarnings | `UPDATE SET "totalEarnings" = ROUND("totalEarnings" * 100)` |
| 4.10 | Convert WeeklySettlement.commissionOwed | `UPDATE SET "commissionOwed" = ROUND("commissionOwed" * 100)` |
| 4.11 | Convert CommissionPayment.amountDue | `UPDATE SET "amountDue" = ROUND("amountDue" * 100)` |
| 4.12 | Update Prisma schema (Float → BigInt) | `prisma/schema.prisma` |
| 4.13 | Run `prisma generate` | VPS |
| 4.14 | Verify all amounts are correct | SQL queries |
| 4.15 | Restart traffic | Docker service scale 1 |

**Verification**:
```sql
-- Verify no fractional values remain
SELECT COUNT(*) FROM "ProviderWallet" WHERE "availableBalance" % 1 != 0;
-- Expected: 0

SELECT COUNT(*) FROM "CustomerWallet" WHERE balance % 1 != 0;
-- Expected: 0

-- Verify sums match pre-migration
SELECT SUM("availableBalance") FROM "ProviderWallet";
-- Expected: 2908414 (same as before, now in cents)
```

### Stage 5: Switch Reads to Ledger

**Duration**: 2 hours
**Risk**: MEDIUM (read path change)
**Rollback**: Switch reads back to stored balance

| Step | Action | Files |
|------|--------|-------|
| 5.1 | Add balance computation from ledger | `lib/wallet.ts` |
| 5.2 | Compare ledger-computed vs stored balance | Monitoring |
| 5.3 | Switch wallet view to ledger-computed | `wallet/route.ts` |
| 5.4 | Switch admin view to ledger-computed | `admin/financial/wallets/route.ts` |
| 5.5 | Monitor for discrepancies | Logs |

### Stage 6: Add Idempotency & Concurrency Fixes

**Duration**: 3 hours
**Risk**: MEDIUM (behavior change)
**Rollback**: Remove guards

| Step | Action | Files |
|------|--------|-------|
| 6.1 | Add idempotency keys to all financial writers | 8 route files |
| 6.2 | Add atomic updateMany with status guards | 6 route files |
| 6.3 | Add optimistic lock on wallet updates | `lib/wallet.ts` |
| 6.4 | Add audit logging to all financial operations | 10 route files |
| 6.5 | Add isFrozen checks | `lib/wallet.ts` |
| 6.6 | Add rate limiting to financial endpoints | middleware |

### Stage 7: Remove Old WalletTransaction

**Duration**: 1 hour
**Risk**: LOW (old table no longer read)
**Rollback**: Restore from backup

| Step | Action | Files |
|------|--------|-------|
| 7.1 | Verify no code reads WalletTransaction | Grep |
| 7.2 | Archive WalletTransaction data | SQL export |
| 7.3 | Drop WalletTransaction table | `prisma migrate` |
| 7.4 | Update Prisma schema | `prisma/schema.prisma` |

---

## MAINTENANCE WINDOW

| Stage | Duration | Downtime Required |
|-------|----------|-------------------|
| 1. Additive schema | 1 hour | NO |
| 2. Dual-write | 2 hours | NO |
| 3. Reconcile | 1 hour | NO |
| 4. Float → BigInt | 2 hours | **YES** (maintenance window) |
| 5. Switch reads | 2 hours | NO |
| 6. Idempotency fixes | 3 hours | NO |
| 7. Remove old table | 1 hour | NO |
| **Total** | **12 hours** | **2 hours** |

---

## BACKUP PLAN

| Risk | Mitigation |
|------|------------|
| Migration fails | Restore from pg_dump backup |
| Data corruption | Compare checksums before/after |
| In-flight transactions | Drain queue before maintenance window |
| Mobile app crash | BigInt serialized as string, app parses as number |
| Rollback needed | Reverse migration SQL provided |

---

## VERIFICATION CHECKLIST

| Check | Stage | SQL |
|-------|-------|-----|
| Tables exist | 1 | `SELECT table_name FROM information_schema.tables` |
| Dual-write consistent | 2 | Compare stored vs ledger balances |
| No fractional values | 4 | `WHERE amount % 1 != 0` |
| Sums match | 4 | `SELECT SUM(...)` before/after |
| Ledger computed matches stored | 5 | JOIN comparison |
| Idempotency keys unique | 6 | `SELECT idempotencyKey, COUNT(*) GROUP BY HAVING COUNT(*) > 1` |
| No race conditions | 6 | Concurrent test suite |

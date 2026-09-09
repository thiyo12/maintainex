# 05A-FINANCIAL-CONCURRENCY.md — Race Condition Map

**Date**: Sep 8, 2026
**Evidence**: Code analysis, Phase 4F PostgreSQL concurrency tests

---

## RACE CONDITION INVENTORY

| # | Location | Race | Consequence | Severity |
|---|----------|------|-------------|----------|
| 1 | `escrow/route.ts:43` | Double escrow fund | Double customer debit | P0 |
| 2 | `release-escrow/route.ts:38` | Double release | Double provider credit | P0 |
| 3 | `complete/route.ts:72` | Double completion credit | Double provider credit | P0 |
| 4 | `escrow-release/route.ts:82` | Double auto-release | Double provider credit | P0 |
| 5 | `admin/escrows/route.ts:64` | Double force-release | Double provider credit | P0 |
| 6 | `admin/escrows/route.ts:106` | Double force-refund | Double customer credit | P0 |
| 7 | `cash-payment/route.ts:42` | Double cash credit | Double provider credit | P0 |
| 8 | `complete/route.ts:84` + `release-escrow/route.ts:43` | Concurrent complete + release | Double provider credit | P0 |
| 9 | `escrow/route.ts:43` + `escrow/refund/route.ts:33` | Concurrent fund + refund | Customer debited then credited | P1 |
| 10 | `WalletTransaction.balanceBefore/After` | Stale read | Incorrect audit trail | P1 |

---

## PROTECTED RACES (Phase 4F Verified)

| Race | Protection | Status |
|------|------------|--------|
| 2-way quote accept | `WHERE status = 'OPEN'` guard | ✅ VERIFIED (PostgreSQL) |
| 5-way quote accept | Same guard | ✅ VERIFIED (PostgreSQL) |
| Accept + Cancel | Conditional updates on both sides | ✅ VERIFIED (PostgreSQL) |
| Same-quote retry | Upsert on workspace + conditional escrow | ✅ VERIFIED (PostgreSQL) |

---

## UNPROTECTED RACES (Phase 5 Required)

### Race 1: Double Escrow Fund

**Scenario**: Customer taps "Fund Escrow" twice quickly.

**Current Code** (`escrow/route.ts:43`):
```typescript
await prisma.customerWallet.update({
  where: { id: customerWallet.id },
  data: { balance: { decrement: escrowAmount } },
});
// No guard on escrow status
```

**Consequence**: Customer debited twice for same job.

**Fix**: Add `WHERE status = 'PENDING_PAYMENT'` guard:
```typescript
const updated = await tx.jobEscrow.updateMany({
  where: {
    id: escrowId,
    status: 'PENDING_PAYMENT', // Guard
  },
  data: { status: 'PROTECTED' },
});
if (updated.count === 0) throw new AlreadyFundedError();
```

### Race 2: Double Provider Credit

**Scenario**: Customer taps "Release Escrow" twice quickly.

**Current Code** (`release-escrow/route.ts:38`):
```typescript
await prisma.providerWallet.upsert({
  where: { userId: providerId },
  update: { availableBalance: { increment: payout } },
  create: { /* ... */ },
});
// No guard on escrow status
```

**Consequence**: Provider credited twice.

**Fix**: Add `WHERE status = 'PROTECTED'` guard + idempotency key.

### Race 3: Concurrent Complete + Release

**Scenario**: Customer taps "Complete" while also tapping "Manual Release".

**Current Code**: Both paths credit provider wallet.

**Consequence**: Provider credited twice (once from each path).

**Fix**: Atomic `updateMany` with status guard ensures exactly one path succeeds.

### Race 4: Auto-Release Cron + Manual Release

**Scenario**: Cron auto-releases while customer manually releases.

**Current Code**: No coordination between cron and manual paths.

**Consequence**: Provider credited twice.

**Fix**: Both paths use same `WHERE status = 'ON_HOLD'` guard. First one wins.

---

## CONCURRENCY PROTECTION PATTERNS

### Pattern 1: Atomic updateMany with State Guard

```typescript
// Instead of:
const escrow = await tx.jobEscrow.findUnique({ where: { id } });
if (escrow.status !== 'ON_HOLD') throw new Error();
await tx.jobEscrow.update({ where: { id }, data: { status: 'RELEASED' } });

// Use:
const result = await tx.jobEscrow.updateMany({
  where: { id, status: 'ON_HOLD' }, // Atomic check+update
  data: { status: 'RELEASED' },
});
if (result.count === 0) throw new AlreadyProcessedError();
```

### Pattern 2: Optimistic Lock on Wallet

```typescript
const wallet = await tx.walletBalance.findUnique({ where: { id } });
const result = await tx.walletBalance.updateMany({
  where: { id, version: wallet.version },
  data: {
    availableBalance: { increment: amount },
    version: { increment: 1 },
  },
});
if (result.count === 0) throw new ConcurrencyError();
```

### Pattern 3: Idempotency Key

```typescript
const key = `${walletId}:${referenceType}:${referenceId}:${entryType}`;
await tx.financialLedger.upsert({
  where: { idempotencyKey: key },
  update: {}, // No-op
  create: { /* ... */ },
});
```

---

## CONCURRENCY TEST RESULTS (Phase 4F)

| Test | Scenario | Result | Duration |
|------|----------|--------|----------|
| 2-way quote | 2 concurrent acceptJobQuote | 1 winner, 1 rejected | 69ms |
| 5-way quote | 5 concurrent acceptJobQuote | 1 winner, 4 rejected | 85ms |
| Same-quote retry | 3 concurrent retries | 1 workspace, 1 escrow | 97ms |
| Accept + Cancel (A) | Accept wins, cancel after | CANCELLED, no PROTECTED | 53ms |
| Accept + Cancel (B) | Cancel wins, accept rejected | CANCELLED, "not open" | 23ms |
| Accept + Cancel (C) | Concurrent race | Consistent final state | 26ms |

**All 7 tests PASS on real PostgreSQL (maintainex_phase4f_test)**

---

## REMAINING RACE CONDITIONS

| Race | Protection Needed | Priority |
|------|-------------------|----------|
| Double escrow fund | Atomic updateMany + idempotency | P0 |
| Double provider credit (manual) | Atomic updateMany + idempotency | P0 |
| Double provider credit (auto) | Atomic updateMany + idempotency | P0 |
| Complete + release race | Mutual exclusion via status guard | P0 |
| Wallet stale read | Optimistic lock + version | P1 |
| Commission double-create | Idempotency key | P1 |

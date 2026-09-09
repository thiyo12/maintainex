# 05A-IDEMPOTENCY.md — Idempotency Strategy

**Date**: Sep 8, 2026
**Evidence**: Code analysis of all 27 financial writers

---

## CURRENT STATE

### Writers With Idempotency (1 of 27)

| Writer | Method | Key |
|--------|--------|-----|
| `admin/commission/route.ts:134` | UPSERT on WeeklySettlement | Unique period key |

### Writers Without Idempotency (26 of 27)

| Writer | Duplicate Risk | Consequence |
|--------|---------------|-------------|
| `select-quote/route.ts:47` | Double escrow create | Double wallet debit |
| `escrow/route.ts:61` | Double PROTECTED transition | Double customer debit |
| `release-escrow/route.ts:34` | Double provider credit | Overpayment |
| `complete/route.ts:68` | Double provider credit | Overpayment |
| `cash-payment/route.ts:38` | Double provider credit | Overpayment |
| `admin/escrows/route.ts:60` | Double force-release | Overpayment |
| `admin/escrows/route.ts:102` | Double force-refund | Double customer credit |
| `escrow-release/route.ts:62` | Double auto-release | Overpayment |
| `daily-maintenance/route.ts:44` | Double cancel | No financial impact |
| All other writers | Low risk (admin-only, low volume) | Minimal |

---

## IDEMPOTENCY KEY DESIGN

### Key Format

```
{actorId}:{action}:{resourceId}:{timestamp_bucket}

Examples:
  user_abc123:select-quote:job_def456:20260908
  user_abc123:escrow-fund:job_def456:20260908
  user_abc123:release-escrow:job_def456:20260908
  cron:escrow-release:job_def456:20260908
```

### Timestamp Bucket

Use day-level granularity (not exact timestamp) to prevent replay attacks:

```typescript
function getTimeBucket(): string {
  return new Date().toISOString().slice(0, 10); // "2026-09-08"
}
```

### Database Constraint

```sql
CREATE UNIQUE INDEX idx_financial_ledger_idempotency
  ON "FinancialLedger" ("idempotencyKey");

-- For existing WalletTransaction (Phase 5 interim)
ALTER TABLE "WalletTransaction"
  ADD COLUMN "idempotencyKey" TEXT UNIQUE;
```

---

## IDEMPOTENCY BY FLOW

### Flow 3: Escrow Deposit

```typescript
const idempotencyKey = `${userId}:escrow-fund:${jobId}:${getTimeBucket()}`;

// In $transaction:
await tx.walletTransaction.upsert({
  where: { idempotencyKey },
  update: {}, // No-op
  create: {
    walletId: customerWallet.id,
    entryType: 'DEBIT',
    amount: escrowAmount,
    referenceType: 'ESCROW_DEPOSIT',
    referenceId: escrow.id,
    idempotencyKey,
  },
});
```

### Flow 5: Manual Release

```typescript
const idempotencyKey = `${userId}:release-escrow:${jobId}:${getTimeBucket()}`;

// In $transaction:
await tx.financialLedger.upsert({
  where: { idempotencyKey },
  update: {}, // No-op
  create: {
    walletType: 'PROVIDER',
    walletId: providerWallet.id,
    entryType: 'CREDIT',
    amount: payout,
    referenceType: 'ESCROW_RELEASE',
    referenceId: escrow.id,
    idempotencyKey,
  },
});
```

### Flow 10: Auto-Release Cron

```typescript
const idempotencyKey = `cron:escrow-release:${escrow.id}:${getTimeBucket()}`;

// Atomic updateMany prevents double-processing:
const updated = await tx.jobEscrow.updateMany({
  where: {
    id: escrowId,
    status: 'ON_HOLD', // Guard condition
  },
  data: { status: 'RELEASED' },
});

if (updated.count === 0) {
  return; // Already processed or invalid state
}
```

---

## IDEMPOTENCY TABLE

| Flow | Key Pattern | Constraint | Duplicate Behavior |
|------|-------------|------------|-------------------|
| Escrow deposit | `user:escrow-fund:job:day` | UNIQUE on FinancialLedger | No-op on duplicate |
| Escrow refund | `user:refund:job:day` | UNIQUE on FinancialLedger | No-op on duplicate |
| Manual release | `user:release:job:day` | UNIQUE on FinancialLedger | No-op on duplicate |
| Completion release | `user:complete:job:day` | UNIQUE on FinancialLedger | No-op on duplicate |
| Auto-release cron | `cron:release:escrow:day` | updateMany WHERE status='ON_HOLD' | Skip if already processed |
| Admin force-release | `admin:force-release:escrow:day` | UNIQUE on FinancialLedger | No-op on duplicate |
| Admin force-refund | `admin:force-refund:escrow:day` | UNIQUE on FinancialLedger | No-op on duplicate |
| Cash payment | `user:cash:job:day` | UNIQUE on FinancialLedger | No-op on duplicate |
| Weekly settlement | UPSERT on (providerId, weekKey) | UNIQUE on WeeklySettlement | Update existing |
| Commission payment | `admin:pay:weekly:day` | UNIQUE on CommissionPayment | No-op on duplicate |

---

## RACE CONDITION PREVENTION

### Pattern: Optimistic Lock + Idempotency

```typescript
async function safeWalletCredit(
  tx: Prisma.TransactionClient,
  walletId: string,
  amount: bigint,
  idempotencyKey: string
) {
  // 1. Idempotency check
  const existing = await tx.financialLedger.findUnique({
    where: { idempotencyKey },
  });
  if (existing) return existing; // Already processed

  // 2. Optimistic lock on wallet
  const wallet = await tx.walletBalance.findUnique({
    where: { id: walletId },
  });

  const updated = await tx.walletBalance.updateMany({
    where: {
      id: walletId,
      version: wallet.version,
    },
    data: {
      availableBalance: { increment: amount },
      version: { increment: 1 },
    },
  });

  if (updated.count === 0) {
    throw new ConcurrencyError('Wallet version conflict');
  }

  // 3. Record ledger entry
  return tx.financialLedger.create({
    data: {
      walletType: 'PROVIDER',
      walletId,
      entryType: 'CREDIT',
      amount,
      balanceAfter: wallet.availableBalance + amount,
      referenceType: 'ESCROW_RELEASE',
      referenceId: walletId,
      idempotencyKey,
      createdBy: 'system',
    },
  });
}
```

---

## CLIENT-SIDE IDEMPOTENCY

### Mobile App

```typescript
// Generate unique key per user action
const requestId = `${userId}-${action}-${jobId}-${Date.now()}`;

// Include in request header
headers: {
  'X-Idempotency-Key': requestId,
}

// Server stores key, rejects duplicate within 24h
```

### Admin Panel

```typescript
// Same pattern for admin actions
const requestId = `${adminId}-${action}-${resourceId}-${Date.now()}`;
```

---

## SUMMARY

| Aspect | Design |
|--------|--------|
| Key format | `{actor}:{action}:{resource}:{day}` |
| Storage | FinancialLedger.idempotencyKey (UNIQUE) |
| Duplicate behavior | No-op (return existing) |
| Time window | 24 hours (day bucket) |
| Client-generated | Yes (X-Idempotency-Key header) |
| Server-generated | Fallback (if client doesn't provide) |
| Cron idempotency | Atomic updateMany with state guard |

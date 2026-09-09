# MaintainEX Race Condition & Idempotency Audit

## Critical Race Conditions

### 1. ProviderWallet Double Credit (P0)
**Routes:** Multiple
```typescript
// Any route that does:
await prisma.providerWallet.update({
  where: { userId: providerId },
  data: { availableBalance: { increment: amount } }
})
```
**Problem:** Two simultaneous requests → `increment` executes twice → double credit.
**Fix:** Use `SELECT FOR UPDATE` or distributed lock with idempotency key.

### 2. Escrow-Release Double Credit (P0)
**File:** `app/api/cron/escrow-release/route.ts`
**Trigger:** Cron runs twice simultaneously (redeploy, cron overlap)
**Effect:** `providerWallet.update({ increment: payout })` executes twice
**Fix:** Add `idempotencyKey` field to JobEscrow. Check before crediting.

### 3. CustomerWallet Double Debit (P0)
**Route:** `POST /api/mobile/v2/jobs/[id]/escrow`
**Trigger:** Two simultaneous deposits for same job
**Effect:** Both succeed, double the money escrowed, both create escrow records
**Fix:** Unique constraint on `jobId` field in JobEscrow. Use `upsert`.

### 4. CustomerWallet Withdraw Race (P1)
**Route:** `POST /api/mobile/withdraw`
**Trigger:** Concurrent withdrawal requests
**Effect:** Balance read → two withdrawals pass balance check → double debit
**Fix:** Wrap in `prisma.$transaction` with balance check inside transaction.

### 5. Read-Before-Write Audit Trail (P1)
**Routes:** All wallet transaction routes
```typescript
const wallet = await prisma.customerWallet.findUnique(...)
// ... other operations ...
await prisma.walletTransaction.create({
  data: { balanceBefore: wallet.balance, balanceAfter: wallet.balance - amount }
})
```
**Problem:** `wallet.balance` is stale if concurrent access occurred.
**Fix:** Use database-level operations that return updated balance atomically.

### 6. Booking Status Transition (P2)
**Route:** `POST /api/mobile/v2/jobs/[id]/complete`
**Problem:** Provider and customer both trigger completion simultaneously.
**Impact:** Low (Prisma update is idempotent for same status).

## Idempotency Status

| Operation | Has Idempotency? | Impact |
|---|---|---|
| Escrow deposit | NO | Double credit |
| Escrow release | NO | Double payout |
| Provider wallet credit | NO | Double credit |
| Customer wallet debit | NO | Double debit |
| Withdrawal request | NO | Double withdrawal |
| Commission settlement | NO | Double settlement |
| Quote submission | Yes (unique constraint on job+provider) | N/A |
| OTP generation | Yes (expires previous) | N/A |
| Admin login (2FA) | Yes (expires previous) | N/A |

## Recommendations

1. Add `SELECT FOR UPDATE` or distributed lock to all wallet mutations
2. Add idempotency key field to JobEscrow, CommissionSettlement
3. Use Prisma interactive transactions (`prisma.$transaction(async (tx) => {...})`) for all multi-step financial operations
4. Add unique constraint on `jobId` in JobEscrow to prevent double deposit
5. Return updated balance from atomic DB operations instead of pre-transaction snapshots

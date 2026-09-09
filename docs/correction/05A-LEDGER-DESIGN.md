# 05A-LEDGER-DESIGN.md — WalletTransaction Assessment + Canonical Ledger Design

**Date**: Sep 8, 2026
**Evidence**: VPS PostgreSQL production data, code analysis

---

## CURRENT WalletTransaction ASSESSMENT

### Production Data

| Metric | Value |
|--------|-------|
| Total rows | 24 |
| CREDIT transactions | 13 |
| DEBIT transactions | 11 |
| All whole numbers | ✅ YES |
| NaN/invalid values | 0 |
| Amount range | LKR 2,000 – 49,012 |

### referenceType Distribution

| referenceType | CREDIT | DEBIT | Total |
|---------------|--------|-------|-------|
| ESCROW_RELEASE | 4 | 4 | 8 |
| SERVICE_FEE | 6 | 4 | 10 |
| WITHDRAWAL | 3 | 3 | 6 |
| **Total** | **13** | **11** | **24** |

### Current Schema Issues

| Issue | Severity | Detail |
|-------|----------|--------|
| Float amount | P0 | `amount`, `balanceBefore`, `balanceAfter` all Float |
| No idempotency key | P1 | No unique constraint on (walletId, referenceId, referenceType) |
| Stale balance snapshot | P1 | `balanceBefore/After` computed from pre-transaction read |
| Missing referenceTypes | P2 | No ESCROW_DEPOSIT, ESCROW_REFUND, COMMISSION_SETTLED types |
| No reversal field | P2 | No `isReversal` or `reversedByTransactionId` |

---

## CANONICAL LEDGER DESIGN

### Purpose

Replace WalletTransaction with a proper double-entry ledger that:
1. Records every balance movement atomically
2. Provides idempotent writes
3. Enables balance recomputation from ledger alone
4. Supports reversals and audit

### New Ledger Schema

```prisma
model FinancialLedger {
  id            String   @id @default(cuid())
  walletType    String   // "PROVIDER" | "CUSTOMER"
  walletId      String   // ProviderWallet.id or CustomerWallet.id
  entryType     String   // "CREDIT" | "DEBIT"
  amount        Decimal  @db.Decimal(12, 2) // LKR with 2 decimal places
  balanceAfter  Decimal  @db.Decimal(12, 2) // Running balance snapshot
  referenceType String   // ESCROW_DEPOSIT | ESCROW_RELEASE | ESCROW_REFUND | COMMISSION | WITHDRAWAL | TOPUP | ADJUSTMENT
  referenceId   String   // JobEscrow.id, CommissionSettlement.id, etc.
  idempotencyKey String  @unique // "{walletId}:{referenceType}:{referenceId}:{entryType}"
  description   String?  // Human-readable note
  createdBy     String   // "system" | "admin:{userId}" | "cron:{jobName}"
  createdAt     DateTime @default(now())

  @@index([walletType, walletId, createdAt])
  @@index([referenceType, referenceId])
  @@unique([idempotencyKey])
}
```

### Balance Table (Denormalized Cache)

```prisma
model WalletBalance {
  id               String   @id @default(cuid())
  walletType       String   // "PROVIDER" | "CUSTOMER"
  walletId         String   @unique
  availableBalance Decimal  @db.Decimal(12, 2) // Withdrawable (provider) or spendable (customer)
  pendingBalance   Decimal  @db.Decimal(12, 2) // Unreleased (provider only)
  frozenBalance    Decimal  @db.Decimal(12, 2) // Frozen by admin
  currency         String   @default("LKR")
  lastTransactionId String? // Latest ledger entry
  version          Int      @default(0) // Optimistic lock
  updatedAt        DateTime @updatedAt

  @@index([walletType, walletId])
}
```

### Migration Path

1. **Phase 5A**: Add `FinancialLedger` + `WalletBalance` tables (additive)
2. **Phase 5B**: Dual-write — existing flows write to both old + new
3. **Phase 5C**: Recompute balances from ledger, compare with stored
4. **Phase 5D**: Switch reads to ledger-computed balances
5. **Phase 5E**: Remove old `WalletTransaction` table

### Idempotency Key Format

```
{walletId}:{referenceType}:{referenceId}:{entryType}

Examples:
  cw_abc123:ESCROW_DEPOSIT:ej_def456:CREDIT
  pw_ghi789:ESCROW_RELEASE:ej_abc123:DEBIT
  pw_ghi789:COMMISSION:cs_xyz789:DEBIT
```

### Atomic Write Pattern

```typescript
async function recordFinancialMovement(
  tx: Prisma.TransactionClient,
  entry: FinancialLedgerEntry
) {
  // 1. Insert ledger entry (idempotent via unique constraint)
  const ledger = await tx.financialLedger.upsert({
    where: { idempotencyKey: entry.idempotencyKey },
    update: {}, // No-op on duplicate
    create: entry,
  });

  // 2. Update wallet balance (optimistic lock)
  const updated = await tx.walletBalance.updateMany({
    where: {
      walletId: entry.walletId,
      version: entry.expectedVersion,
    },
    data: {
      availableBalance: { increment: entry.entryType === 'CREDIT' ? entry.amount : -entry.amount },
      version: { increment: 1 },
      lastTransactionId: ledger.id,
    },
  });

  if (updated.count === 0) {
    throw new ConcurrencyError('Balance version conflict');
  }

  return ledger;
}
```

### Reversal Pattern

```typescript
async function reverseTransaction(
  tx: Prisma.TransactionClient,
  originalEntryId: string,
  reason: string
) {
  const original = await tx.financialLedger.findUnique({ where: { id: originalEntryId } });

  return recordFinancialMovement(tx, {
    walletType: original.walletType,
    walletId: original.walletId,
    entryType: original.entryType === 'CREDIT' ? 'DEBIT' : 'CREDIT',
    amount: original.amount,
    referenceType: 'REVERSAL',
    referenceId: original.id,
    idempotencyKey: `${original.walletId}:REVERSAL:${original.id}:${original.entryType === 'CREDIT' ? 'DEBIT' : 'CREDIT'}`,
    description: `Reversal of ${original.id}: ${reason}`,
    createdBy: 'system',
  });
}
```

---

## COMPARISON: OLD vs NEW

| Aspect | WalletTransaction (Old) | FinancialLedger (New) |
|--------|------------------------|----------------------|
| Data type | Float | Decimal(12,2) |
| Idempotency | None | Unique constraint |
| Balance snapshot | Stale read | Atomic update |
| Reversal support | None | Built-in |
| Audit trail | Incomplete | Full (createdBy, description) |
| Double-entry | No | Yes (CREDIT + DEBIT per movement) |
| Balance recomputation | Not possible | Can recompute from ledger |
| Concurrency safety | None | Optimistic lock + version |

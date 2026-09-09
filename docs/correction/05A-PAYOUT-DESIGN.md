# 05A-PAYOUT-DESIGN.md — Withdrawal Lifecycle Design

**Date**: Sep 8, 2026
**Evidence**: Code analysis, production data (0 Payout rows)

---

## CURRENT STATE

### Provider Withdrawal Flow

| Aspect | Status |
|--------|--------|
| Endpoint | `POST /api/mobile/withdraw` |
| Status | **DEAD (503)** |
| Payout table | 0 rows |
| PayoutRequest table | 0 rows |
| Balance check | ❌ Not performed |
| Wallet deduction | ❌ Not performed |
| Idempotency | ❌ Not implemented |
| Transaction safety | ❌ No `$transaction` |

### Why Withdrawal is Disabled

1. No external payment provider integration (no bank transfer API)
2. No KYC verification for bank details
3. No fraud detection on withdrawal amounts
4. No admin approval workflow
5. No Payout model with bank details

---

## WITHDRAWAL LIFECYCLE DESIGN

### State Machine

```
┌─────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────┐
│  NONE   │────▶│   PENDING    │────▶│  APPROVED   │────▶│ PROCESSING│
└─────────┘     └──────────────┘     └─────────────┘     └──────────┘
                       │                    │                    │
                       ▼                    ▼                    ▼
                 ┌──────────┐        ┌──────────┐        ┌──────────┐
                 │ REJECTED │        │ CANCELLED│        │ COMPLETED│
                 └──────────┘        └──────────┘        └──────────┘
```

### States

| State | Description | Allowed Transitions |
|-------|-------------|---------------------|
| PENDING | Withdrawal requested, awaiting admin review | → APPROVED, → REJECTED, → CANCELLED |
| APPROVED | Admin approved, awaiting processing | → PROCESSING, → CANCELLED |
| PROCESSING | Bank transfer in progress | → COMPLETED, → FAILED |
| REJECTED | Admin rejected the request | Terminal |
| CANCELLED | User or admin cancelled | Terminal |
| COMPLETED | Bank transfer successful | Terminal |
| FAILED | Bank transfer failed | → PENDING (retry) |

### Withdrawal Request

```typescript
async function requestWithdrawal(
  providerId: string,
  amount: bigint,  // In cents
  bankDetails: BankDetails
) {
  return prisma.$transaction(async (tx) => {
    // 1. Check wallet balance
    const wallet = await tx.providerWallet.findUnique({
      where: { userId: providerId },
    });

    if (wallet.availableBalance < amount) {
      throw new InsufficientBalanceError();
    }

    // 2. Deduct from wallet (hold)
    await tx.providerWallet.update({
      where: { userId: providerId },
      data: {
        availableBalance: { decrement: amount },
        pendingBalance: { increment: amount },
      },
    });

    // 3. Create payout request
    const payout = await tx.payoutRequest.create({
      data: {
        providerId,
        amount,
        bankDetails: JSON.stringify(bankDetails),
        status: 'PENDING',
        idempotencyKey: `${providerId}:withdrawal:${Date.now()}`,
      },
    });

    // 4. Create audit record
    await tx.financialLedger.create({
      data: {
        walletType: 'PROVIDER',
        walletId: wallet.id,
        entryType: 'DEBIT',
        amount,
        balanceAfter: wallet.availableBalance - amount,
        referenceType: 'WITHDRAWAL',
        referenceId: payout.id,
        idempotencyKey: `${wallet.id}:WITHDRAWAL:${payout.id}:DEBIT`,
        description: `Withdrawal request: LKR ${Number(amount) / 100}`,
        createdBy: `user:${providerId}`,
      },
    });

    // 5. Notify admin
    await notifyAdmins('WITHDRAWAL_REQUEST', { payout });

    return payout;
  });
}
```

### Admin Approval

```typescript
async function approveWithdrawal(
  payoutId: string,
  adminId: string
) {
  return prisma.$transaction(async (tx) => {
    const payout = await tx.payoutRequest.findUnique({
      where: { id: payoutId },
    });

    if (payout.status !== 'PENDING') {
      throw new InvalidStateError();
    }

    // Update status
    await tx.payoutRequest.update({
      where: { id: payoutId },
      data: {
        status: 'APPROVED',
        approvedBy: adminId,
        approvedAt: new Date(),
      },
    });

    // Create audit record
    await tx.financialLedger.create({
      data: {
        walletType: 'PROVIDER',
        walletId: payout.providerId,
        entryType: 'DEBIT',
        amount: 0, // No balance change
        balanceAfter: 0,
        referenceType: 'WITHDRAWAL_APPROVED',
        referenceId: payoutId,
        idempotencyKey: `${payout.providerId}:WITHDRAWAL_APPROVED:${payoutId}:DEBIT`,
        description: `Withdrawal approved by admin ${adminId}`,
        createdBy: `admin:${adminId}`,
      },
    });

    return payout;
  });
}
```

### Bank Transfer Processing

```typescript
async function processBankTransfer(
  payoutId: string
) {
  return prisma.$transaction(async (tx) => {
    const payout = await tx.payoutRequest.findUnique({
      where: { id: payoutId },
    });

    if (payout.status !== 'APPROVED') {
      throw new InvalidStateError();
    }

    // Update status
    await tx.payoutRequest.update({
      where: { id: payoutId },
      data: { status: 'PROCESSING' },
    });

    // Call external bank API
    const result = await bankProvider.transfer({
      amount: payout.amount,
      bankDetails: JSON.parse(payout.bankDetails),
      reference: payout.id,
    });

    if (result.success) {
      await tx.payoutRequest.update({
        where: { id: payoutId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          bankReference: result.reference,
        },
      });

      // Move from pending to released
      await tx.providerWallet.update({
        where: { userId: payout.providerId },
        data: {
          pendingBalance: { decrement: payout.amount },
        },
      });
    } else {
      await tx.payoutRequest.update({
        where: { id: payoutId },
        data: {
          status: 'FAILED',
          failureReason: result.error,
        },
      });

      // Return to available balance
      await tx.providerWallet.update({
        where: { userId: payout.providerId },
        data: {
          availableBalance: { increment: payout.amount },
          pendingBalance: { decrement: payout.amount },
        },
      });
    }

    return payout;
  });
}
```

---

## SECURITY REQUIREMENTS

| Requirement | Implementation |
|-------------|----------------|
| KYC verified | Check `identityStatus === 'VERIFIED'` before allowing withdrawal |
| Minimum amount | LKR 1,000 minimum withdrawal |
| Maximum amount | LKR 100,000 per request |
| Daily limit | LKR 500,000 per day per provider |
| Admin approval | Required for amounts > LKR 10,000 |
| Fraud check | Verify no recent disputes or chargebacks |
| Bank details | Encrypted at rest, masked in admin view |
| Audit trail | Every state transition logged to FinancialLedger |

---

## PRODUCTION READINESS

| Prerequisite | Status | Required |
|-------------|--------|----------|
| External bank API | ❌ Not integrated | Phase 6 |
| KYC verification | ⚠️ Partial | Phase 5 |
| Admin approval UI | ❌ Not built | Phase 5 |
| Fraud detection | ⚠️ Partial | Phase 5 |
| FinancialLedger | ❌ Not built | Phase 5A |
| WalletBalance table | ❌ Not built | Phase 5A |

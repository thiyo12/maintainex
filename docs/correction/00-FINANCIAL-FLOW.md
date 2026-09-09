# MaintainEX Financial Flow Analysis

## Money Flow Diagram

```
CustomerWallet (Float balance)
    |
    |-- [Escrow Deposit] --> JobEscrow (BigInt)
    |                              |
    |                              |-- [Release/Escrow] --> ProviderWallet (Float)
    |                              |                           commission via CompanyProfile.commissionRate
    |                              |
    |                              |-- [Auto-Release Cron] --> ProviderWallet (Float)
    |                              |                           commission via escrow.serviceFee (DIFFERENT)
    |                              |
    |                              |-- [Cash Payment] --> ProviderWallet (Float)
    |                              |                       commission uses serviceFee as PERCENTAGE (BUG)
    |                              |
    |                              |-- [Refund] --> CustomerWallet (Float)
    |                              |
    |                              |-- [Dispute] --> ON_HOLD
    |
    |-- [Withdraw] --> Debited (no payout record)
    |
    |-- [Property Boost] --> Debited (no transaction wrapper)

ProviderWallet (Float availableBalance)
    |
    |-- [Withdraw] --> Payout record (NOT deducted, NOT validated)
```

## Critical Financial Bugs

### Bug 1: Cash-Payment Commission (P0)
```typescript
// WRONG: Uses escrow.serviceFee (BigInt cents) as percentage
const commissionRate = Number(escrow.serviceFee)  // e.g., 350 = 350%
const commission = escrowAmount * (commissionRate / 100)
```
`escrow.serviceFee` is the platform fee amount in cents (e.g., 350 for LKR 3500). The code treats it as a percentage (350%), causing wildly incorrect commission.

### Bug 2: Individual Providers Pay 0% Commission (P1)
```typescript
async function getProviderCommissionRate(providerId: string) {
  const company = await prisma.companyProfile.findUnique({ where: { userId: providerId } })
  return company?.commissionRate ?? 0  // Returns 0 for individuals!
}
```
Only queries `CompanyProfile`. Individual providers (no company profile) default to 0%.

### Bug 3: Inconsistent Commission Formulas (P2)
| Path | Formula | Result |
|---|---|---|
| Escrow deposit | `quotePrice * 0.1` (hardcoded) | 10% service fee from customer |
| Release-escrow | `escrowAmount * (company.commissionRate / 100)` | Variable from provider |
| Auto-release | `escrow.amount - escrow.serviceFee` | Flat deduction |
| Cash-payment | `escrowAmount * (serviceFee / 100)` | Nonsensical (bug) |

Same job can have different commission amounts depending on release path.

### Bug 4: Escrow-Release Cron No Transaction (P0)
```typescript
await prisma.jobEscrow.update(...)      // step 1
await prisma.marketplaceJob.update(...)  // step 2
await prisma.providerWallet.update(...)  // step 3
await prisma.walletTransaction.create(...) // step 4
```
Crash between steps = inconsistent state. No `prisma.$transaction` wrapper.

### Bug 5: Escrow-Release Double-Credit (P1)
No distributed lock. If cron runs twice simultaneously, `providerWallet.update({ availableBalance: { increment: payout } })` double-credits.

### Bug 6: Provider Withdrawal Not Validated (P1)
`POST /api/mobile/withdraw` creates a Payout record without:
- Checking `ProviderWallet.availableBalance`
- Deducting from the wallet
- Using a database transaction

Provider with zero balance can request withdrawal.

### Bug 7: Float Money in Wallets (P0)
All wallet and transaction fields use Float:
- `ProviderWallet.availableBalance` — Float
- `ProviderWallet.pendingBalance` — Float
- `CustomerWallet.balance` — Float
- `WalletTransaction.amount/balanceBefore/balanceAfter` — Float

While escrow layer uses BigInt correctly, the boundary conversion loses precision.

### Bug 8: Read-Before-Write Audit Trail (P1)
```typescript
const wallet = await prisma.customerWallet.findUnique(...)
// Later inside transaction:
balanceBefore: wallet.balance,        // STALE if concurrent access
balanceAfter: wallet.balance - amount, // STALE
```
`balanceBefore`/`balanceAfter` in WalletTransaction are computed from pre-transaction snapshot. Concurrent requests produce incorrect audit trail.

### Bug 9: Customer Withdrawal Bookkeeping-Only (P2)
Customer wallet WITHDRAW action only debits balance. No payout record, no bank transfer. Money disappears with only a WalletTransaction record.

### Bug 10: ProviderWallet.pendingBalance Unused (P3)
The `pendingBalance` field exists in schema but is never written to by any traced financial flow.

### Bug 11: CustomerWallet.isFrozen Never Checked (P3)
The `isFrozen` flag is set by admin but never checked in deposit, refund, or withdrawal flows. Frozen wallets can still transact.

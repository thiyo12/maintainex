# 05A-SOURCE-OF-TRUTH.md — Authoritative Source for Each Balance Concept

**Date**: Sep 8, 2026
**Scope**: Every balance/money concept and its canonical source

---

## BALANCE CONCEPTS

| # | Concept | Authoritative Source | Type | How Computed | Trust Level |
|---|---------|---------------------|------|--------------|-------------|
| 1 | Customer available funds | `CustomerWallet.balance` | Float | Stored (increment/decrement) | **MEDIUM** — Float precision risk |
| 2 | Provider withdrawable earnings | `ProviderWallet.availableBalance` | Float | Stored (increment on release) | **MEDIUM** — Float precision risk |
| 3 | Provider unreleased earnings | `ProviderWallet.pendingBalance` | Float | Stored (never written) | **LOW** — Unused field |
| 4 | Escrow held amount | `JobEscrow.amount` | BigInt | Created from quote, immutable | **HIGH** |
| 5 | Escrow platform fee | `JobEscrow.serviceFee` | BigInt | Created from quote, immutable | **HIGH** |
| 6 | Commission owed per job | `CommissionSettlement.commissionAmount` | BigInt | `jobAmount × rate / 100` | **HIGH** |
| 7 | Weekly provider earnings | `WeeklySettlement.totalEarnings` | Float | SUM of CommissionSettlement | **MEDIUM** |
| 8 | Weekly commission owed | `WeeklySettlement.commissionOwed` | Float | `totalEarnings × rate / 100` | **MEDIUM** |
| 9 | Commission payment due | `CommissionPayment.amountDue` | Float | Set by admin | **MEDIUM** |
| 10 | Invoice total | `Invoice.total` | Float | `subtotal + tax` | **LOW** — Legacy V1 |
| 11 | Job price | `Booking.totalPrice` | Float | Set at booking time | **LOW** — Legacy V1 |
| 12 | Provider service price | `JobQuote.price` | BigInt | Set by provider (cents) | **HIGH** |
| 13 | Transaction amount | `WalletTransaction.amount` | Float | Copied from source | **MEDIUM** |
| 14 | Transaction balance snapshot | `WalletTransaction.balanceBefore/After` | Float | Read-before-write | **LOW** — Stale on race |
| 15 | Platform commission rate | `PlatformSettings.commissionRate` | Float | Admin config, 10% | **HIGH** — Integer value |
| 16 | Company commission rate | `CompanyProfile.commissionRate` | Float | Admin config, 10% | **HIGH** — Integer value |

---

## COMPUTED vs STORED BALANCES

### Customer Wallet Balance

| Source | Value | Trust |
|--------|-------|-------|
| Stored: `CustomerWallet.balance` | Sum of 46 wallets = LKR 1,095,942 | **STORAGE** |
| Computed: SUM(WalletTransaction WHERE type='CREDIT') - SUM(DEBIT) | Should match | **VERIFICATION** |
| Discrepancy risk | Float arithmetic drift on high volume | MEDIUM |

**Verification method**: `SELECT SUM(balance) FROM CustomerWallet` vs recompute from WalletTransaction.

### Provider Wallet Balance

| Source | Value | Trust |
|--------|-------|-------|
| Stored: `ProviderWallet.availableBalance` | Sum of 27 wallets = LKR 2,908,414 | **STORAGE** |
| Computed: SUM(ESCROW_RELEASE credits) - SUM(WITHDRAWAL debits) | Should match | **VERIFICATION** |
| Discrepancy risk | Absolute set in admin flow breaks invariant | HIGH |

### Escrow State

| Source | Value | Trust |
|--------|-------|-------|
| Stored: `JobEscrow.status + amount` | 11 rows, sum LKR 3,057,500 | **STORAGE** |
| Computed: job status × escrow state should be consistent | Must match | **VERIFICATION** |
| Discrepancy risk | Seed data orphans (2 rows, LKR 2,120,000) | KNOWN |

### Commission Calculation

| Source | Value | Trust |
|--------|-------|-------|
| Stored: `CommissionSettlement.commissionAmount` | Sum LKR 30,628 | **STORAGE** |
| Computed: `jobAmount × rate / 100` using `computeCommission()` | Should match | **VERIFICATION** |
| Discrepancy risk | 4 different formulas used across flows | HIGH |

---

## CROSS-REFERENCE INTEGRITY

### Escrow → Wallet

| Check | Status |
|-------|--------|
| All PROTECTED escrows have matching customer debits | ⚠️ Seed orphans violate |
| All RELEASED escrows have matching provider credits | ⚠️ Some missing WalletTransaction |
| All REFUNDED escrows have matching customer credits | ✅ Verified |

### Settlement → Payment

| Check | Status |
|-------|--------|
| All SETTLED CommissionSettlements have CommissionPayment | ⚠️ Not enforced by FK |
| All WeeklySettlement.commissionOwed matches SUM(CommissionSettlement) | ⚠️ Float precision |

---

## AUTHORITATIVE SOURCE MATRIX

| Question | Query This | Not This |
|----------|------------|----------|
| How much can customer spend? | `CustomerWallet.balance` | SUM of invoices |
| How much can provider withdraw? | `ProviderWallet.availableBalance` | WeeklySettlement |
| How much is in escrow? | `SUM(JobEscrow.amount) WHERE status IN ('PROTECTED','ON_HOLD')` | MarketplaceJob.budgetAmount |
| How much commission is owed? | `SUM(CommissionSettlement.commissionAmount) WHERE status='PENDING'` | WeeklySettlement.commissionOwed |
| What is the commission rate? | `getProviderCommissionRate()` → `CompanyProfile` → `PlatformSettings` | Hardcoded values |
| Was a transaction recorded? | `WalletTransaction` | Wallet balance alone |

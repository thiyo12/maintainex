# 05A-MONEY-FLOWS.md — All 15 Financial Flows

**Date**: Sep 8, 2026
**Evidence**: Production code tracing, VPS PostgreSQL data

---

## FLOW CLASSIFICATION

| # | Flow | Entry Point | Status | Transaction Safety | Idempotent |
|---|------|-------------|--------|-------------------|------------|
| 1 | Wallet top-up (customer deposit) | `/api/mobile/v2/wallet` | **DEAD (501)** | N/A | N/A |
| 2 | Provider withdrawal | `/api/mobile/withdraw` | **DEAD (503)** | N/A | N/A |
| 3 | Escrow deposit (customer → escrow) | `escrow/route.ts:61` | LIVE | ✅ `$transaction` | ❌ |
| 4 | Escrow refund (escrow → customer) | `escrow/refund/route.ts:29` | LIVE | ✅ `$transaction` | ❌ |
| 5 | Manual release (customer → provider) | `release-escrow/route.ts:34` | LIVE | ✅ `$transaction` | ❌ |
| 6 | Completion release (customer → provider) | `complete/route.ts:68` | LIVE | ✅ `$transaction` | ❌ |
| 7 | Admin force-release | `admin/escrows/route.ts:60` | LIVE | ❌ No `$transaction` | ❌ |
| 8 | Admin force-refund | `admin/escrows/route.ts:102` | LIVE | ❌ No `$transaction` | ❌ |
| 9 | Cash payment release | `cash-payment/route.ts:38` | LIVE | ❌ No `$transaction` | ❌ |
| 10 | Auto-release (cron) | `cron/escrow-release/route.ts:62` | LIVE (NOT RUNNING) | ✅ `$transaction` (Phase 1) | ❌ |
| 11 | Stale escrow cancel (cron) | `cron/daily-maintenance/route.ts:44` | LIVE (NOT RUNNING) | ❌ No `$transaction` | ❌ |
| 12 | Weekly settlement calculation | `admin/commission/route.ts:134` | LIVE | ✅ `$transaction` | ✅ UPSERT |
| 13 | Commission payment confirm | `admin/commission/payments/route.ts:133` | LIVE | ❌ No `$transaction` | ❌ |
| 14 | Commission settlement (admin settle) | `admin/commission-settle/route.ts:57` | LIVE | ❌ No `$transaction` | ❌ |
| 15 | Provider wallet credit (admin) | `admin/financial/wallets/route.ts:111` | LIVE | ❌ No `$transaction` | ❌ |

---

## FLOW DETAILS

### Flow 1: Wallet Top-Up — DEAD

```
Entry: POST /api/mobile/v2/wallet
Status: Returns 501 "Not Implemented"
Production data: 0 top-up transactions
Impact: Customers cannot add funds to CustomerWallet
```

### Flow 2: Provider Withdrawal — DEAD

```
Entry: POST /api/mobile/withdraw
Status: Returns 503 "Service Unavailable"
Production data: 0 Payout rows, 0 PayoutRequest rows
Impact: Providers cannot cash out earnings
```

### Flow 3: Escrow Deposit — LIVE

```
Customer → CustomerWallet (debit) → JobEscrow (PENDING_PAYMENT → PROTECTED)
Entry: POST /api/mobile/v2/jobs/[id]/escrow
Steps:
  1. CustomerWallet.balance -= escrowAmount     (Atomic ✅)
  2. JobEscrow.status = 'PROTECTED'             (Atomic ✅)
  3. WalletTransaction CREATE (ESCROW_DEPOSIT)  (Atomic ✅)
Production: All 11 escrows passed through this flow
Bug: No idempotency — double-submit = double debit
```

### Flow 4: Escrow Refund — LIVE

```
JobEscrow → CustomerWallet (credit)
Entry: POST /api/mobile/v2/jobs/[id]/escrow/refund
Steps:
  1. JobEscrow.status = 'REFUNDED'              (Atomic ✅)
  2. CustomerWallet.balance += refundedAmount   (Atomic ✅)
  3. WalletTransaction CREATE (ESCROW_REFUND)   (Atomic ✅)
Production: 2 REFUNDED escrows (LKR 195,000)
Bug: Duplicate refund implementations exist
```

### Flow 5: Manual Release — LIVE

```
JobEscrow → ProviderWallet (credit)
Entry: POST /api/mobile/v2/jobs/[id]/release-escrow
Steps:
  1. JobEscrow.status = 'RELEASED'              (Atomic ✅)
  2. ProviderWallet.availableBalance += payout  (Atomic ✅)
  3. WalletTransaction CREATE (ESCROW_RELEASE)  (Atomic ✅)
Production: 2 RELEASED escrows (LKR 440,000)
Bug: No idempotency — double-release = double credit
```

### Flow 6: Completion Release — LIVE

```
JobEscrow → ProviderWallet (credit)
Entry: POST /api/mobile/v2/jobs/[id]/complete
Steps:
  1. JobEscrow.status = 'RELEASED'              (Atomic ✅)
  2. ProviderWallet.availableBalance += payout  (Atomic ✅)
  3. WalletTransaction CREATE (ESCROW_RELEASE)  (Atomic ✅)
  4. CommissionSettlement CREATE                (Atomic ✅)
Production: Used for COMPLETED jobs
Bug: Commission calculated differently than manual release
```

### Flow 7: Admin Force-Release — LIVE (UNSAFE)

```
JobEscrow → ProviderWallet (credit)
Entry: PATCH /api/mobile/v2/admin/escrows
Steps:
  1. JobEscrow.status = 'RELEASED'              (No transaction)
  2. ProviderWallet.availableBalance = payout   (ABSOLUTE SET — BUG)
  3. WalletTransaction CREATE                   (No audit log)
Production: Admin override for dispute resolution
Bug: Sets absolute balance, skips commission entirely
```

### Flow 8: Admin Force-Refund — LIVE (UNSAFE)

```
JobEscrow → CustomerWallet (credit)
Entry: PATCH /api/mobile/v2/admin/escrows
Steps:
  1. JobEscrow.status = 'REFUNDED'              (No transaction)
  2. CustomerWallet.balance = refundedAmount    (ABSOLUTE SET — BUG)
  3. WalletTransaction CREATE                   (No audit log)
Production: Admin override for dispute resolution
Bug: Sets absolute balance, overwrites existing balance
```

### Flow 9: Cash Payment — LIVE (UNSAFE)

```
JobEscrow → ProviderWallet (credit)
Entry: POST /api/mobile/v2/jobs/[id]/cash-payment
Steps:
  1. JobEscrow.status = 'RELEASED'              (No transaction)
  2. ProviderWallet.availableBalance += payout  (Atomic increment)
  3. WalletTransaction CREATE                   (No audit log)
  4. CommissionSettlement CREATE                (Formula fixed in Phase 1)
Production: CASH payment method escrows
Bug: No `$transaction`, no idempotency
```

### Flow 10: Auto-Release (Cron) — LIVE (NOT RUNNING)

```
JobEscrow → ProviderWallet (credit)
Entry: GET /api/cron/escrow-release
Schedule: Hourly (NOT configured on VPS)
Steps (Phase 1 fixed):
  1. prisma.$transaction([                              (Atomic ✅)
  2.   JobEscrow.update → RELEASED (WHERE status='ON_HOLD')
  3.   MarketplaceJob.update → COMPLETED
  4.   ProviderWallet.upsert (increment balance)
  5.   WalletTransaction.create
  6. ])
Production: 3 ON_HOLD escrows waiting (LKR 292,500)
Status: NOT RUNNING — VPS cron not configured
```

### Flow 11: Stale Escrow Cancel (Cron) — LIVE (NOT RUNNING)

```
JobEscrow → CANCELLED
Entry: GET /api/cron/daily-maintenance
Schedule: Midnight (NOT configured on VPS)
Steps:
  1. JobEscrow.status = 'CANCELLED'             (No transaction)
  2. JobQuote.status = 'PENDING'                (Reset accepted)
  3. MarketplaceJob.status = 'OPEN'             (Revert)
Production: Stale PROCESSING → FAILED cleanup
Bug: No `$transaction`, no idempotency
```

### Flow 12: Weekly Settlement — LIVE

```
CommissionSettlement → WeeklySettlement (upsert)
Entry: GET /api/admin/commission
Steps:
  1. WeeklySettlement UPSERT (weekly period key) (Atomic ✅)
  2. Sum CommissionSettlement.commissionAmount   (Read)
  3. WeeklySettlement.totalEarnings UPDATE        (Atomic ✅)
  4. WeeklySettlement.commissionOwed UPDATE       (Atomic ✅)
Production: 10 settlements, ALL at 10%, ALL whole numbers
Bug: Broken earnings calculation (uses different source than escrow)
```

### Flow 13: Commission Payment Confirm — LIVE

```
CommissionPayment → WeeklySettlement
Entry: POST /api/admin/commission/payments
Steps:
  1. CommissionPayment.status = 'CONFIRMED'     (No transaction)
  2. WeeklySettlement.status = 'PAID'           (No transaction)
Production: 8 payments, ALL unpaid
Bug: No `$transaction`
```

### Flow 14: Commission Settlement (Admin) — LIVE

```
CommissionSettlement → SETTLED
Entry: POST /api/admin/commission-settle
Steps:
  1. CommissionSettlement.status = 'SETTLED'    (No transaction)
  2. ProviderWallet.availableBalance -= amount  (debit)
Production: 7 SETTLED, 3 PENDING
Bug: No `$transaction`, no idempotency
```

### Flow 15: Provider Wallet Freeze — LIVE

```
Admin → ProviderWallet.isFrozen
Entry: PATCH /api/admin/financial/wallets
Steps:
  1. ProviderWallet.isFrozen = true/false       (No transaction)
  2. Fraud detection auto-freeze                (No transaction)
Production: Freeze/unfreeze for compliance
Bug: isFrozen never checked in financial flows
```

---

## FLOW STATEMENT

| Metric | Count |
|--------|-------|
| Total flows traced | 15 |
| DEAD flows | 2 (top-up, withdrawal) |
| LIVE flows | 13 |
| Flows with `$transaction` | 5 of 13 |
| Flows without `$transaction` | 8 of 13 |
| Flows with idempotency | 1 of 13 (weekly settlement UPSERT) |
| Flows with absolute balance set | 2 of 13 (admin force-release/refund) |
| Flows NOT RUNNING | 2 (auto-release cron, daily maintenance cron) |

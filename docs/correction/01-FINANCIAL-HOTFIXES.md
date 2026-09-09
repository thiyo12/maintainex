# MaintainEX Phase 1 — Financial Hotfixes

## 1. Cash Payment Commission Fix

**File:** `app/api/mobile/v2/jobs/[id]/cash-payment/route.ts`

**Before:** Used `escrow.serviceFee` (BigInt amount in cents) as a percentage. If serviceFee was 350 cents, treated as 350%.

**After:** Uses `getProviderCommissionRate()` → `computeCommission()`. Rate clamped to 0-100%.

**Regression test:** `tests/phase1/commission.test.ts` — 8 test cases.

## 2. Individual Provider Commission Fix

**Files:** `lib/mxid.ts`, `app/api/mobile/v2/jobs/[id]/release-escrow/route.ts`, `app/api/mobile/v2/jobs/[id]/complete/route.ts`

**Before:** `getProviderCommissionRate()` only checked `CompanyProfile`. Individual providers returned 0%.

**After:** Falls back to `getCommissionRate()` (platform default 10%) when no company profile exists.

**Regression test:** `tests/phase1/commission.test.ts` — 8 test cases.

## 3. Shared Commission Utility

**File:** `lib/mxid.ts`

Added:
- `getProviderCommissionRate(providerId)` — company rate or platform default
- `computeCommission(escrowAmount, rate)` — rate clamped 0-100%, deterministic calculation

Used by: `cash-payment`, `release-escrow`, `complete`, `escrow-release` cron.

## 4. Escrow Auto-Release Atomicity

**File:** `app/api/cron/escrow-release/route.ts`

**Before:** 4 independent writes. No transaction. No idempotency.

**After:** Wrapped in `prisma.$transaction`. Uses atomic `updateMany` with `status: 'ON_HOLD'` guard. Concurrent runs return `count: 0` and skip.

**Regression test:** Behavioral test in `withdrawal-safety.test.ts`.

## 5. Provider Withdrawal Safety

**File:** `app/api/mobile/withdraw/route.ts`

**Before:** Created Payout without checking wallet balance. No deduction.

**After:** Atomic `$transaction`: check balance → deduct → create payout → create audit record.

**Regression test:** `tests/phase1/withdrawal-safety.test.ts` — 4 test cases.

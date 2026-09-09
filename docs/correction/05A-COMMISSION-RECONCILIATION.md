# 05A-COMMISSION-RECONCILIATION.md — Commission Calculation Audit

**Date**: Sep 8, 2026
**Evidence**: VPS PostgreSQL production data, code analysis of `lib/mxid.ts`

---

## COMMISSION RATE SOURCE

### Rate Lookup Chain

```
getProviderCommissionRate(providerId)
  → CompanyProfile.commissionRate (if company provider)
  → PlatformSettings.commissionRate (fallback, 10%)
```

### Production Rates

| Source | Rate | Count |
|--------|------|-------|
| CompanyProfile.commissionRate | 10% | 9 companies |
| PlatformSettings.commissionRate | 10% | 1 (global) |
| **All rates** | **10%** | **All** |

---

## COMMISSION FORMULA AUDIT

### 4 Different Formulas Used

| Path | Formula | File:Line |
|------|---------|-----------|
| 1. Escrow deposit | `quotePrice × 0.1` (hardcoded 10%) | `select-quote/route.ts:47` |
| 2. Manual release | `escrowAmount × (company.commissionRate / 100)` | `release-escrow/route.ts:34` |
| 3. Completion release | `escrowAmount × (company.commissionRate / 100)` | `complete/route.ts:68` |
| 4. Auto-release cron | `escrow.amount - escrow.serviceFee` (flat deduction) | `escrow-release/route.ts:62` |
| 5. Cash payment | `escrowAmount × (serviceFee / 100)` (Phase 1 fixed → uses `computeCommission()`) | `cash-payment/route.ts:38` |

### Formula Comparison

| Escrow Amount | Path 1 (10% hardcoded) | Path 2/3 (company rate) | Path 4 (flat deduction) | Path 5 (fixed) |
|---------------|----------------------|------------------------|------------------------|----------------|
| LKR 100,000 | LKR 10,000 | LKR 10,000 | LKR 90,000 (10,000 fee) | LKR 10,000 |
| LKR 50,000 | LKR 5,000 | LKR 5,000 | LKR 45,000 (5,000 fee) | LKR 5,000 |
| LKR 10,000 | LKR 1,000 | LKR 1,000 | LKR 9,000 (1,000 fee) | LKR 1,000 |

**Note**: Paths 1, 2/3, and 5 produce the same result (10% of escrow amount). Path 4 produces a different result because it uses the service fee as a flat deduction rather than a percentage.

### Production Impact

| Flow | Escrows Affected | Commission Skipped? |
|------|-----------------|---------------------|
| Manual release | 2 (LKR 440,000) | ⚠️ NO CommissionSettlement created |
| Completion release | Active jobs | ✅ CommissionSettlement created |
| Auto-release cron | 0 (not running) | N/A |
| Cash payment | 1 (LKR 8,000) | ✅ CommissionSettlement created |

---

## PRODUCTION COMMISSION DATA

### CommissionSettlement (10 rows)

| Metric | Value |
|--------|-------|
| Total settlements | 10 |
| SETTLED | 7 |
| PENDING | 3 |
| commissionRate | ALL 10% |
| commissionAmount sum | LKR 30,628 |
| jobAmount sum | LKR 306,293 |

### Commission Payment (8 rows)

| Metric | Value |
|--------|-------|
| Total payments | 8 |
| amountDue sum | LKR 34,000 |
| Status | ALL unpaid |

### WeeklySettlement (10 rows)

| Metric | Value |
|--------|-------|
| Total settlements | 10 |
| totalEarnings sum | LKR 874,839 |
| commissionRate | ALL 10% |
| commissionOwed sum | LKR 87,483 |

---

## RECONCILIATION CHECKS

### Check 1: CommissionSettlement Sum vs Escrow Amounts

```
Expected: SUM(escrow.amount × 10%) for all RELEASED escrows
Actual: SUM(CommissionSettlement.commissionAmount) = LKR 30,628
```

| Released Escrow | Amount | Expected Commission (10%) | Has Settlement? |
|----------------|--------|---------------------------|-----------------|
| #8 | LKR 200,000 | LKR 20,000 | ❌ NO |
| #9 | LKR 240,000 | LKR 24,000 | ❌ NO |

**Discrepancy**: LKR 44,000 in expected commission not recorded as CommissionSettlement.

### Check 2: WeeklySettlement.commissionOwed vs SUM(CommissionSettlement)

```
Expected: SUM(CommissionSettlement.commissionAmount) = LKR 30,628
Actual: WeeklySettlement.commissionOwed sum = LKR 87,483
```

**Discrepancy**: LKR 56,855 difference. WeeklySettlement includes amounts from escrows that have no CommissionSettlement records.

### Check 3: CommissionPayment.amountDue vs WeeklySettlement.commissionOwed

```
Expected: SUM(WeeklySettlement.commissionOwed) = LKR 87,483
Actual: SUM(CommissionPayment.amountDue) = LKR 34,000
```

**Discrepancy**: LKR 53,483 difference. Not all weekly settlements have corresponding commission payments.

---

## BUGS FOUND

### Bug 1: Manual Release Skips Commission

**File**: `app/api/mobile/v2/jobs/[id]/release-escrow/route.ts`

**Issue**: When customer manually releases escrow, no CommissionSettlement is created. Provider receives full escrow amount without platform commission.

**Impact**: LKR 44,000 in commission not collected (2 released escrows × ~LKR 22,000 avg).

**Fix**: Add CommissionSettlement CREATE after provider wallet credit.

### Bug 2: Auto-Release Uses Different Formula

**File**: `app/api/cron/escrow-release/route.ts`

**Issue**: Uses `escrow.amount - escrow.serviceFee` as provider payout, rather than applying commission rate.

**Impact**: Provider receives `amount - serviceFee` instead of `amount × (1 - commissionRate)`. When commissionRate = 10% and serviceFee = 10% of amount, results are identical. But if rates diverge, commission is incorrect.

**Fix**: Use `computeCommission()` consistently across all release paths.

### Bug 3: WeeklySettlement Uses Broken Earnings Calculation

**File**: `app/api/admin/commission/route.ts`

**Issue**: `totalEarnings` is computed from a different source than escrow amounts. Results in mismatch with actual commission owed.

**Impact**: LKR 56,855 discrepancy between WeeklySettlement and CommissionSettlement sums.

**Fix**: Recompute `totalEarnings` from `SUM(CommissionSettlement.commissionAmount / commissionRate × 100)`.

### Bug 4: Commission Payment Amount Mismatch

**File**: `app/api/admin/commission/route.ts`

**Issue**: `CommissionPayment.amountDue` is set by admin input, not computed from WeeklySettlement.

**Impact**: LKR 53,483 difference between what's owed and what's billed.

**Fix**: Auto-compute `amountDue` from `WeeklySettlement.commissionOwed`.

---

## RECONCILIATION VERDICT

| Check | Status | Discrepancy |
|-------|--------|-------------|
| Escrow → CommissionSettlement | ⚠️ MISSING | LKR 44,000 commission not recorded |
| CommissionSettlement → WeeklySettlement | ⚠️ MISMATCH | LKR 56,855 difference |
| WeeklySettlement → CommissionPayment | ⚠️ MISMATCH | LKR 53,483 difference |
| Commission formula consistency | ⚠️ 4 DIFFERENT FORMULAS | Same job, different commission |
| Rate accuracy | ✅ ALL 10% | No rate disputes |

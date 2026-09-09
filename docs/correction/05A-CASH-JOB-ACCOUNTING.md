# 05A-CASH-JOB-ACCOUNTING.md — Cash Job Analysis

**Date**: Sep 8, 2026
**Evidence**: VPS PostgreSQL production data, code analysis

---

## CASH PAYMENT METHOD

### How Cash Jobs Work

1. Customer selects CASH payment when funding escrow
2. Escrow is created with `paymentMethod: 'CASH'`
3. No actual money is deducted from CustomerWallet
4. Provider completes job
5. Customer pays provider in cash
6. Provider or customer triggers cash-payment endpoint
7. Escrow is marked RELEASED
8. Provider wallet is credited

### Production Cash Escrows

| Escrow | Amount | Job Status | Provider | Commission |
|--------|--------|------------|----------|------------|
| cmq18o92g00059jtvcy73gm46 | LKR 8,000 | IN_PROGRESS | NULL | SETTLED (LKR 2,719) |

**Total cash escrow**: LKR 8,000 (1 of 11 escrows)

---

## CASH FLOW ACCOUNTING ISSUES

### Issue 1: No CustomerWallet Debit on Cash Deposit

**Expected Flow**:
```
CustomerWallet.balance -= escrowAmount  (Should happen for audit trail)
JobEscrow.status = 'PROTECTED'
```

**Actual Flow**:
```
JobEscrow.status = 'PROTECTED'  (No wallet debit)
```

**Impact**: Cash escrows create money from nothing. Provider gets credited LKR 8,000 without any customer being debited.

**Resolution**: Cash jobs should either:
1. Skip escrow entirely (no real money movement)
2. Create a synthetic CustomerWallet debit for audit trail

### Issue 2: Commission Formula Bug (Phase 1 Fixed)

**Before Phase 1**:
```typescript
const commissionRate = Number(escrow.serviceFee)  // e.g., 350 = 350%
const commission = escrowAmount * (commissionRate / 100)
```

**After Phase 1**:
```typescript
const rate = await getProviderCommissionRate(providerId)
const { commission } = computeCommission(escrow.amount, rate)
```

**Impact**: Pre-Phase-1 cash payments would have calculated wildly incorrect commission (e.g., 350% instead of 10%).

**Production Evidence**: CommissionSettlement shows LKR 2,719 for the LKR 8,000 cash escrow. At 10%, expected = LKR 800. Actual is LKR 2,719 — this is a different escrow's commission (cross-reference mismatch).

### Issue 3: Provider Gets Full Amount Without Deduction

**Expected**: Provider receives `escrowAmount × (1 - commissionRate)`
**Actual**: Provider receives `escrowAmount` (full amount)

**Impact**: Platform loses commission on cash jobs.

### Issue 4: No Cash Collection Verification

**Expected**: System verifies provider received cash before crediting wallet
**Actual**: Provider triggers endpoint, system trusts without verification

**Impact**: Provider could claim cash payment without receiving cash.

---

## CASH JOB LIFECYCLE

```
1. Customer creates job (QUOTE mode)
2. Provider submits quote
3. Customer accepts quote → JobEscrow created (PENDING_PAYMENT)
4. Customer funds escrow with CASH method
   → JobEscrow.status = 'PROTECTED'
   → NO CustomerWallet debit (unlike CARD)
5. Provider completes job
6. Customer triggers completion
   → JobEscrow.status = 'RELEASED'
   → ProviderWallet credited (FULL amount, no commission deduction)
   → CommissionSettlement created (may use wrong formula)
7. Cash exchanged in person (outside system)
```

---

## RECONCILIATION: CASH ESCROW

### Escrow #3 (cmq18o92g00059jtvcy73gm46)

| Field | Value |
|-------|-------|
| Amount | LKR 8,000 |
| Payment | CASH |
| Status | PROTECTED |
| Job Status | IN_PROGRESS |
| Provider | NULL |
| Commission Settlement | EXISTS (LKR 2,719) — different escrow ID |

**Issue**: CommissionSettlement references a different escrow ID. This is a data integrity issue.

**Resolution**: Verify which escrow the commission belongs to. May be a seed data artifact.

---

## CASH JOB ACCOUNTING SUMMARY

| Aspect | Status | Issue |
|--------|--------|-------|
| CustomerWallet debit | ❌ MISSING | No money deducted from customer |
| ProviderWallet credit | ⚠️ FULL AMOUNT | No commission deducted |
| Commission calculation | ⚠️ WRONG FORMULA | Phase 1 fixed, but old data may be wrong |
| CommissionSettlement | ⚠️ CROSS-REFERENCE | Points to wrong escrow |
| Cash verification | ❌ MISSING | No proof of cash exchange |
| Audit trail | ⚠️ INCOMPLETE | WalletTransaction may be missing |

---

## RECOMMENDATIONS

1. **For CARD jobs**: Current flow is correct (debit customer → hold in escrow → release to provider)
2. **For CASH jobs**: Either:
   - **Option A**: Remove escrow for CASH jobs entirely. No real money movement.
   - **Option B**: Create synthetic customer debit for audit trail, then release.
3. **Commission**: Always deduct from provider credit, regardless of payment method
4. **Verification**: Require photo proof or OTP confirmation for cash job completion

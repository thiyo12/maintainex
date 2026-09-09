# Phase 5B: Shadow Reconciliation

**Status:** PHASE 5B COMPLETE  
**File:** `lib/backfill.ts` → `reconcileBackfill()`

## Approach

After backfill, verify shadow columns match Float-derived values within tolerance.

## Reconciliation Rules

### 1. Direct Comparison

For each row with both Float and BigInt columns populated:
```
expectedBigInt = legacyToMinorUnits(floatValue, exponent)
actualBigInt = bigintColumn value
delta = |expectedBigInt - actualBigInt|
```

### 2. Tolerance

```typescript
const TOLERANCE = 1n; // ±1 cent
if (delta > TOLERANCE) {
  reportDiscrepancy(row.id, expectedBigInt, actualBigInt);
}
```

Floating-point rounding may cause ±1 cent differences. These are acceptable and logged but not blocking.

### 3. Blocking vs Non-Blocking

| Condition | Severity | Action |
|-----------|----------|--------|
| delta == 0 | PASS | No action |
| delta <= 1 cent | WARN | Log, allow |
| delta > 1 cent | FAIL | Block migration, manual review |

### 4. Opening Balance Generation

After reconciliation passes, `generateOpeningBalances()` creates `WalletBalance` rows:

```typescript
// For each ProviderWallet with backfilled data:
INSERT INTO WalletBalance (accountType, accountId, availableMinor, pendingMinor, frozenMinor, currency, version)
VALUES ('provider', wallet.id, wallet.availableBalanceMinor, wallet.pendingBalanceMinor, 0, 'LKR', 1);

// For each CustomerWallet:
INSERT INTO WalletBalance (accountType, accountId, availableMinor, pendingMinor, frozenMinor, currency, version)
VALUES ('customer', wallet.id, wallet.balanceMinor, 0, 0, 'LKR', 1);
```

### 5. Post-Migration Verification

After opening balances generated:
```typescript
reconcileBalances();
// Verifies: SUM(ledger entries) == WalletBalance for each account
// Any discrepancy blocks production cutover
```

## Output Format

```
RECONCILIATION REPORT
====================
ProviderWallet.availableBalanceMinor: 1234 rows, 0 discrepancies
ProviderWallet.pendingBalanceMinor: 1234 rows, 0 discrepancies
CustomerWallet.balanceMinor: 5678 rows, 0 discrepancies
WalletTransaction.amountMinor: 23456 rows, 3 discrepancies (±1 cent)
WeeklySettlement.totalEarningsMinor: 890 rows, 0 discrepancies
WeeklySettlement.commissionOwedMinor: 890 rows, 0 discrepancies
CommissionPayment.amountDueMinor: 456 rows, 0 discrepancies
TOTAL: 28708 rows processed, 3 non-blocking warnings
STATUS: PASS
```

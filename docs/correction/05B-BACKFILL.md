# Phase 5B: Backfill Tool

**Status:** PHASE 5B COMPLETE  
**File:** `lib/backfill.ts`

## Purpose

Migrate existing Float money values to BigInt shadow columns. Deterministic, idempotent, fraction-safe.

## Functions

### `backfillField(params)`

Backfills a single Float column to its BigInt shadow.

```typescript
backfillField({
  table: 'ProviderWallet',
  floatColumn: 'availableBalance',
  bigintColumn: 'availableBalanceMinor',
  currency: 'LKR',
  exponent: 2
})
```

Steps:
1. Read all rows where bigint column is NULL
2. For each row, convert Float → BigInt via `legacyToMinorUnits`
3. Check `hasFractionalParts` — log warnings for lossy conversions
4. Update bigint column
5. Mark row as backfilled

### `backfillAll()`

Runs `backfillField` for all 9 shadow columns in dependency order:
1. ProviderWallet (availableBalanceMinor, pendingBalanceMinor)
2. CustomerWallet (balanceMinor)
3. WalletTransaction (amountMinor, balanceBeforeMinor, balanceAfterMinor)
4. WeeklySettlement (totalEarningsMinor, commissionOwedMinor)
5. CommissionPayment (amountDueMinor)

### `reconcileBackfill()`

Post-backfill verification:
1. Compare Float-derived value vs BigInt value for each row
2. Report discrepancies
3. Allow tolerance for floating-point rounding (±1 cent)

### `generateOpeningBalances()`

Creates initial `WalletBalance` rows from backfilled shadow columns.

```typescript
generateOpeningBalances()
// Reads ProviderWallet.availableBalanceMinor → WalletBalance
// Reads CustomerWallet.balanceMinor → WalletBalance
```

### `printBackfillResults()`

Outputs summary:
- Total rows processed
- Rows with fractional warnings
- Reconciliation pass/fail
- Opening balances generated

## Fraction Safety

```typescript
// Before converting:
if (hasFractionalParts(floatValue, 2)) {
  console.warn(`Fractional value detected: ${floatValue} — manual review needed`);
}
// legacyToMinorUnits truncates (floors) — not rounds
```

## Dry-Run Support

All functions accept `dryRun: boolean` parameter:
- `dryRun: true` → logs what would happen, no DB writes
- `dryRun: false` → executes changes (default)

## Batch Processing

Processes in configurable batch sizes (default 1000 rows) to avoid memory issues on large tables.

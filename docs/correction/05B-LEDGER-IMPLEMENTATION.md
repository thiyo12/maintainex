# Phase 5B: Ledger Posting Service

**Status:** PHASE 5B COMPLETE  
**File:** `lib/ledger.ts`

## Design Principles

1. **Append-only** — Ledger entries are never updated or deleted
2. **Double-entry** — Every transaction posts balanced debit+credit pairs
3. **BigInt throughout** — No Decimal, no Float
4. **Idempotent** — Duplicate idempotencyKey returns cached result
5. **Atomic** — Ledger + balance update in single transaction

## Core Functions

### `postLedgerTransaction(params)`

Posts a balanced double-entry transaction.

```
Input: { accountId, accountType, entries[], referenceType, referenceId, idempotencyKey, description }
Invariant: sum(debits) == sum(credits) within precision
```

Steps:
1. Check idempotency — return cached result if key exists
2. Validate balanced entries (sum debits == sum credits)
3. Insert `FinancialLedger` rows (one per entry)
4. Update `WalletBalance` for each affected account
5. Return posted entries

### `postWalletCredit(params)`

Convenience wrapper for wallet credit.

```
Input: { accountId, accountType, amount (BigInt), currency, referenceType, referenceId, idempotencyKey }
```

Calls `postLedgerTransaction` with credit entry + balancing debit to internal account.

### `postWalletDebit(params)`

Convenience wrapper for wallet debit.

```
Input: { accountId, accountType, amount (BigInt), currency, referenceType, referenceId, idempotencyKey }
```

Calls `postLedgerTransaction` with debit entry + balancing credit to internal account.

### `postEscrowDeposit(params)`

Moves funds from wallet to escrow.

### `postEscrowRelease(params)`

Releases escrow to provider.

### `postEscrowRefund(params)`

Returns escrow to customer.

### `getLedgerBalance(accountId, accountType)`

Returns computed balance from ledger entries (source of truth).

### `getLedgerEntries(accountId, accountType, filter?)`

Returns paginated ledger entries.

## Balance Invariant

```typescript
// For any account at any point in time:
WalletBalance.availableMinor + WalletBalance.pendingMinor + WalletBalance.frozenMinor
  === SUM(ledger entries for account)
```

## Double-Entry Enforcement

```typescript
function validateBalancedEntries(entries: LedgerEntry[]): void {
  const totalDebits = entries
    .filter(e => e.entryType === 'debit')
    .reduce((sum, e) => sum + e.amount, 0n);
  const totalCredits = entries
    .filter(e => e.entryType === 'credit')
    .reduce((sum, e) => sum + e.amount, 0n);
  if (totalDebits !== totalCredits) {
    throw new Error(`Unbalanced: debits=${totalDebits}, credits=${totalCredits}`);
  }
}
```

## Append-Only Enforcement

No `UPDATE` or `DELETE` operations exist in `lib/ledger.ts`. The only write path is `INSERT`.

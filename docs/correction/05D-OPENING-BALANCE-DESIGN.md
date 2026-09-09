# 05D-OPENING-BALANCE-DESIGN.md — Opening Balance Backfill Design

**Created**: 2026-09-08

---

## Design Principles

1. **Idempotent**: Each opening balance uses a deterministic idempotency key: `opening-balance:<walletId>:<timestamp>`
2. **Atomic**: Each wallet gets a single ledger transaction with balanced CREDIT + DEBIT entries
3. **Observable**: All backfill entries use `createdBy: 'system-backfill'` and `referenceType: 'OPENING_BALANCE'`
4. **Reversible**: Each opening balance has a unique `referenceId` matching its wallet ID for easy reversal
5. **Safe**: Dry run first, isolated copy second, production third

---

## Ledger Entry Design

For each ProviderWallet with `availableBalance > 0`:
```
{
  accountId: wallet.userId,           // Provider userId as account identifier
  accountType: 'PROVIDER_WALLET',
  entryType: 'CREDIT',
  amount: BigInt(Math.round(availableBalance * 100)),  // LKR → minor units
}
```
```
{
  accountId: 'platform',
  accountType: 'PLATFORM',
  entryType: 'DEBIT',
  amount: BigInt(Math.round(availableBalance * 100)),
}
```

For each CustomerWallet with `balance > 0`:
```
{
  accountId: wallet.userId,           // Customer userId as account identifier
  accountType: 'CUSTOMER_WALLET',
  entryType: 'CREDIT',
  amount: BigInt(Math.round(balance * 100)),
}
```
```
{
  accountId: 'platform',
  accountType: 'PLATFORM',
  entryType: 'DEBIT',
  amount: BigInt(Math.round(balance * 100)),
}
```

---

## Idempotency Strategy

Each opening balance uses a deterministic key:
```
opening-balance:${walletId}:${new Date('2026-09-08T00:00:00Z').getTime()}
```

This ensures:
- Re-runnable: same key → same result (cached)
- Unique per wallet: no collisions
- Timestamped: all backfill entries share a fixed timestamp for auditability

---

## Seed Data Handling

The following records are SEED/TEST data and must NOT be included in the opening balance:
- ProviderWallet for userId: `admin-maintainex` (admin system account)
- JobEscrow: `cmr8tovb7000wqyteyxnrh2yj` (2.2M seed escrow, PROTECTED)
- JobEscrow: `cmtsfczb6000o350xqjjbkz2v` (100K test escrow, PROTECTED)

All FinancialLedger entries with `createdBy` containing 'test' are test data.

---

## WalletBalance Initialization

After opening balance ledger entries, create `WalletBalance` rows:
```
{
  walletId: wallet.id,           // Match ProviderWallet.id or CustomerWallet.id
  walletType: 'PROVIDER' | 'CUSTOMER',
  balance: BigInt(Math.round(availableBalance * 100)),
  availableBalance: BigInt(Math.round(availableBalance * 100)),  // Provider only
  pendingBalance: BigInt(Math.round(pendingBalance * 100)),       // Provider only
  version: 1,
}
```

---

## Execution Order

1. Dry run (no writes)
2. Create WalletBalance table (via prisma migrate deploy)
3. Write opening balance ledger entries (atomic per wallet)
4. Initialize WalletBalance rows
5. Reconcile: ledger balance = wallet balance
6. Verify: sum(all CREDIT) = sum(all DEBIT) for opening balances

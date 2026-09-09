# Phase 5B: Additive Schema Changes

**Status:** PHASE 5B COMPLETE  
**Date:** 2026-09-08  
**Approach:** Additive-only — no Float columns removed, no breaking changes

## New Tables

### FinancialLedger

| Column | Type | Notes |
|--------|------|-------|
| id | String | Primary key |
| accountId | String | Account identifier |
| accountType | String | e.g. `provider`, `customer`, `escrow` |
| entryType | String | `credit` or `debit` |
| amount | BigInt | Amount in minor units |
| currency | String | `LKR` only |
| referenceType | String | e.g. `wallet_transaction`, `settlement` |
| referenceId | String | FK to source entity |
| idempotencyKey | String | `@unique` — prevents duplicate postings |
| description | String | Human-readable description |
| createdBy | String | System or user identifier |
| metadata | Json | Arbitrary JSON |
| createdAt | DateTime | Default now |

**Purpose:** Append-only double-entry ledger. Every financial mutation posts balanced entries.

### WalletBalance

| Column | Type | Notes |
|--------|------|-------|
| id | String | Primary key |
| accountType | String | `provider` or `customer` |
| accountId | String | `@unique` — one balance per account |
| availableMinor | BigInt | Spendable balance |
| pendingMinor | BigInt | In-flight amounts |
| frozenMinor | BigInt | Disputed/frozen amounts |
| currency | String | `LKR` only |
| lastLedgerId | String | FK to last applied ledger entry |
| version | Int | Optimistic locking counter |
| updatedAt | DateTime | Auto-updated |
| createdAt | DateTime | Default now |

**Purpose:** Denormalized balance cache. Updated atomically with ledger posts.

### IdempotencyRecord

| Column | Type | Notes |
|--------|------|-------|
| id | String | Primary key |
| idempotencyKey | String | `@unique` — DB-enforced deduplication |
| operation | String | Operation type identifier |
| resultPayload | Json | Cached result |
| status | String | `pending`, `completed`, `failed` |
| createdAt | DateTime | Default now |
| expiresAt | DateTime | TTL for cleanup |

**Purpose:** Prevent duplicate side effects from retried API calls.

## Shadow Columns (BigInt)

Added to existing tables alongside existing Float columns:

| Table | Column | Type |
|-------|--------|------|
| ProviderWallet | availableBalanceMinor | BigInt |
| ProviderWallet | pendingBalanceMinor | BigInt |
| CustomerWallet | balanceMinor | BigInt |
| WalletTransaction | amountMinor | BigInt |
| WalletTransaction | balanceBeforeMinor | BigInt |
| WalletTransaction | balanceAfterMinor | BigInt |
| WeeklySettlement | totalEarningsMinor | BigInt |
| WeeklySettlement | commissionOwedMinor | BigInt |
| CommissionPayment | amountDueMinor | BigInt |

**Total:** 3 new tables + 9 shadow columns = 12 additive changes

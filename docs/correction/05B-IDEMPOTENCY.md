# Phase 5B: Idempotency Design

**Status:** PHASE 5B COMPLETE  
**Table:** `IdempotencyRecord`

## Key Format

```
{operation}:{accountId}:{referenceId}:{timestamp}
```

Examples:
```
wallet_credit:prov_123:txn_456:2026-09-08T10:00:00Z
escrow_deposit:cust_789:job_012:2026-09-08T10:00:00Z
```

## Duplicate Handling

1. Client generates idempotencyKey before request
2. Server checks `IdempotencyRecord` for existing key
3. If found with `status=completed` → return cached `resultPayload`
4. If found with `status=pending` → return 409 Conflict
5. If found with `status=failed` → allow retry (overwrite)
6. If not found → insert record with `status=pending`, process, update to `completed`

## DB-Enforced Uniqueness

```prisma
model IdempotencyRecord {
  id               String   @id @default(cuid())
  idempotencyKey   String   @unique
  operation        String
  resultPayload    Json
  status           String   // pending, completed, failed
  createdAt        DateTime @default(now())
  expiresAt        DateTime
}
```

The `@unique` constraint on `idempotencyKey` is the final safety net. Even if application code has a race condition, the DB rejects the duplicate.

## TTL Cleanup

Records expire after 24 hours (configurable). A cron job deletes expired records.

## Scope

Idempotency applies to:
- `postWalletCredit`
- `postWalletDebit`
- `postEscrowDeposit`
- `postEscrowRelease`
- `postEscrowRefund`
- All API endpoints that cause financial mutations

Does NOT apply to:
- Read operations (GET)
- Non-financial mutations (profile updates, etc.)

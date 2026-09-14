# ADR-008: Idempotency Keys for All State-Changing Operations

**Status**: Accepted
**Date**: 2026-09-14

## Context

Mobile apps operate on unreliable networks. A user tapping "Accept Quote" may trigger a request that succeeds server-side but fails to reach the client due to a network timeout. Without idempotency, retrying the request would either fail with a duplicate error or, worse, create duplicate state changes (double-accepting a quote, double-posting a ledger entry).

Financial operations are particularly sensitive: a double-posted escrow deposit or commission charge would require manual reconciliation.

Reference: `lib/ledger.ts:22` (idempotencyKey field), `lib/matching/waves.ts:36-44` (idempotent wave creation)

## Decision

All state-changing API routes require an `Idempotency-Key` header. The server enforces idempotency at two levels:

### Ledger-Level Idempotency

The `postLedgerTransaction` function requires a unique `idempotencyKey`. On conflict:
- If the key exists with the same payload fingerprint, the existing transaction is returned (safe retry)
- If the key exists with a different fingerprint, an `IDEMPOTENCY_CONFLICT` error is returned (prevents key reuse)

### API-Level Idempotency

State-changing routes (POST, PATCH, DELETE) accept an `Idempotency-Key` header:
- First request: processed normally, key stored with result
- Duplicate request (same key within TTL): returns cached result without reprocessing
- Conflicting request (same key, different body): returns 409 Conflict

### Key Generation

Clients generate UUIDs for idempotency keys. The server does not generate keys; it expects the client to provide them for every state-changing request.

### Storage

Idempotency keys are stored with a TTL (24 hours). After TTL, keys are garbage-collected and the same key could theoretically be reused, but this window is acceptable for the use case.

## Consequences

### Positive
- Safe retries: network failures do not cause duplicate state changes
- Financial integrity: ledger entries cannot be double-posted
- Client simplicity: retry logic is just "send the same request again"
- Conflict detection: different payloads with the same key surface bugs

### Negative
- Every POST/PATCH/DELETE requires key generation on the client
- Idempotency storage adds write overhead to every mutation
- TTL management: too short risks duplicates, too long wastes storage

### Neutral
- GET requests are naturally idempotent and do not require keys
- The pattern is standard in financial APIs (Stripe, Square use similar approaches)

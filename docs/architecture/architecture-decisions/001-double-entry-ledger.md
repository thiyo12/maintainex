# ADR-001: Double-Entry Ledger for Financial Records

**Status**: Accepted
**Date**: 2026-09-14

## Context

MaintainEX processes financial transactions through escrow deposits, service fee commissions, provider payouts, and refunds. A single-entry ledger where each transaction is recorded once would provide no built-in validation that debits equal credits, making it impossible to detect data corruption, partial writes, or accounting errors without external reconciliation.

The platform operates in multiple countries (LK, CA) with different currencies, requiring auditable financial trails for regulatory compliance and dispute resolution.

Reference: `lib/ledger.ts` (447 lines), `lib/domain/job-lifecycle.ts`

## Decision

Implement a double-entry accounting ledger where every financial movement produces at least two entries (one debit, one credit) that must balance to zero.

### Core Invariants

1. **Balanced entries**: Total debits must equal total credits for every transaction. The `postLedgerTransaction` function validates this before writing.
2. **Idempotency**: Each transaction requires a unique `idempotencyKey` to prevent duplicate posting.
3. **Immutability**: Posted entries cannot be modified; corrections use reversal entries.
4. **Fingerprinting**: A payload hash detects conflicting idempotency key reuse.

### Account Model

Each ledger entry references an `accountId` and `accountType`. Account types include:
- `USER_WALLET` — Customer or provider wallet
- `COMPANY_WALLET` — Company escrow account
- `PLATFORM_FEE` — Platform commission bucket
- `ESCROW` — Temporary escrow hold

### Transaction Reference

Every transaction links back to a source entity via `referenceType` (e.g., `escrow_release`, `commission`, `payout`) and `referenceId` (the entity ID). This enables full traceability from any financial entry to the originating job, quote, or settlement.

## Consequences

### Positive
- Built-in fraud detection: unbalanced entries indicate data corruption
- Complete audit trail: every monetary movement traces to a source entity
- Safe retry: idempotency keys prevent double-posting on network failures
- Reversal entries allow corrections without destroying history

### Negative
- Increased write amplification: every financial event produces 2+ rows
- Higher schema complexity: LedgerEntry, LedgerTransaction, LedgerIdempotency tables
- Query patterns more complex than simple balance columns

### Neutral
- Conforms to standard accounting practice; familiar to finance teams
- Aligns with the escrow lifecycle in `lib/domain/job-lifecycle.ts` (PENDING_PAYMENT -> PROTECTED -> RELEASED)

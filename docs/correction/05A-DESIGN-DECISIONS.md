# 05A-DESIGN-DECISIONS.md — All Phase 5A Design Decisions

**Date**: Sep 8, 2026
**Scope**: Every architectural decision in Phase 5A financial audit

---

## DECISION 1: Money Type — BigInt (Cents)

**Decision**: All monetary fields use BigInt in integer cents.

**Rationale**:
- 10 existing BigInt fields already correct
- 56 Float fields have zero fractional values in production (safe to migrate)
- Float drift is a ticking time bomb as volume grows
- Decimal adds unnecessary complexity (no multi-currency, no sub-unit)
- Native JavaScript bigint, no library dependency

**Alternatives Considered**:
- Float (status quo): Unacceptable precision risk
- Decimal(12,2): Overkill, no existing usage, adds decimal.js dependency

**Trade-offs**: API must serialize BigInt as string. Mobile app parses with Number(). Safe for LKR amounts.

---

## DECISION 2: Ledger Design — FinancialLedger + WalletBalance

**Decision**: New double-entry ledger (FinancialLedger) with denormalized balance cache (WalletBalance).

**Rationale**:
- Current WalletTransaction lacks idempotency, has stale balance snapshots
- Double-entry enables balance recomputation from ledger alone
- Denormalized cache avoids expensive ledger scans for balance queries
- Optimistic locking prevents concurrent balance corruption

**Alternatives Considered**:
- Fix WalletTransaction in place: Would require adding too many missing fields
- Ledger-only (no cache): Balance queries would be slow at scale

**Trade-offs**: Dual-write during migration adds complexity. Two sources of truth until Stage 5.

---

## DECISION 3: Currency — LKR Only, Integer Cents

**Decision**: Single currency (LKR), stored as integer cents (BigInt).

**Rationale**:
- Sri Lankan Rupee has no official sub-unit in circulation
- All 97 production financial fields are whole numbers
- Escrow layer already uses cents
- Future multi-currency can add currency column + Decimal if needed

**Alternatives Considered**:
- Store whole LKR: Loses precision for cross-system transfers
- Multi-currency from day one: Over-engineering for current needs

**Trade-offs**: Display divides by 100. Acceptable for LKR amounts.

---

## DECISION 4: Idempotency — Unique Constraint + Key Pattern

**Decision**: Idempotency via unique constraint on FinancialLedger.idempotencyKey.

**Rationale**:
- Database-level enforcement prevents all duplicate writes
- Key pattern `{actor}:{action}:{resource}:{day}` is human-readable
- Day-level time bucket prevents replay attacks
- Atomic upsert means no application-level locking needed

**Alternatives Considered**:
- Application-level cache (Redis): Adds infrastructure dependency
- Token bucket: More complex, same result

**Trade-offs**: 24-hour window means legitimate retries within same day are no-ops. Acceptable for financial operations.

---

## DECISION 5: Concurrency — Atomic updateMany + Optimistic Lock

**Decision**: Atomic `updateMany` with state guard for escrow transitions. Optimistic lock with version field for wallet balance updates.

**Rationale**:
- Phase 4F verified `updateMany` with WHERE guard prevents double-wins on PostgreSQL
- Optimistic lock avoids distributed locks (no Redis needed)
- Version field enables retry on conflict
- Both patterns are battle-tested in financial systems

**Alternatives Considered**:
- Pessimistic locking (SELECT FOR UPDATE): Blocks reads, reduces throughput
- Distributed lock (Redis): Adds infrastructure dependency

**Trade-offs**: Optimistic lock requires retry logic on conflict. Acceptable for low-contention wallet updates.

---

## DECISION 6: Audit Logging — FinancialLedger as Audit Trail

**Decision**: FinancialLedger itself serves as the audit trail. No separate AuditLog table for financial operations.

**Rationale**:
- Every balance movement recorded with actor, action, reference, timestamp
- `createdBy` field tracks system vs user vs admin vs cron
- `description` field provides human-readable context
- Single source of truth for both balance computation and audit

**Alternatives Considered**:
- Separate AuditLog table: Duplicates information, risks inconsistency
- ActivityLog (existing): Too generic, lacks financial detail

**Trade-offs**: FinancialLedger grows faster. Acceptable at projected volume.

---

## DECISION 7: Wallet Top-Up — Bank Transfer (FriMi)

**Decision**: Phase 5 implements wallet top-up via bank transfer (FriMi/bank API).

**Rationale**:
- Current top-up is DEAD (501)
- Customers cannot fund escrows without wallet balance
- Bank transfer has zero fees in Sri Lanka
- No card processing needed for deposits

**Alternatives Considered**:
- Dialog Genie: Higher fees (2.5%)
- PayHere: Card-focused, not ideal for bank transfers
- Stripe: International, higher fees

**Trade-offs**: Bank transfer is slower than card. Acceptable for wallet top-up use case.

---

## DECISION 8: Provider Payout — Bank API

**Decision**: Phase 5-6 implements provider payout via direct bank API.

**Rationale**:
- Current payout is DEAD (503)
- Providers cannot cash out earnings
- Direct bank transfer is cheapest option
- KYC verification ensures compliance

**Alternatives Considered**:
- Manual bank transfer (admin): Doesn't scale
- PayPal: Not popular in Sri Lanka

**Trade-offs**: Requires KYC integration. Blocks on verification.

---

## DECISION 9: Cash Job Handling — Remove Escrow

**Decision**: CASH payment jobs should not create escrow. No real money movement.

**Rationale**:
- Current CASH flow creates money from nothing (provider credited without customer debited)
- No way to verify cash was actually exchanged
- Escrow is designed for online payment holds
- Cash jobs are a separate flow outside the payment system

**Alternatives Considered**:
- Keep escrow for CASH: Misleading audit trail
- Synthetic customer debit: Creates fake money movement

**Trade-offs**: CASH jobs become a simple status tracking flow. No financial reconciliation needed.

---

## DECISION 10: Migration Strategy — 7 Stages, 2-Hour Maintenance

**Decision**: Phased migration with single 2-hour maintenance window for Float-to-BigInt conversion.

**Rationale**:
- Additive schema changes (Stages 1-3) need no downtime
- Dual-write ensures consistency during migration
- Single maintenance window minimizes user impact
- Each stage is independently verifiable and rollbackable

**Alternatives Considered**:
- Big-bang migration: Too risky for production data
- Zero-downtime migration: Not possible for type change

**Trade-offs**: 12 hours total work, 2 hours downtime. Acceptable for financial system integrity.

---

## DECISION SUMMARY

| # | Decision | Choice | Risk |
|---|----------|--------|------|
| 1 | Money type | BigInt (cents) | LOW |
| 2 | Ledger design | FinancialLedger + WalletBalance | MEDIUM |
| 3 | Currency | LKR only, integer cents | LOW |
| 4 | Idempotency | Unique constraint + key pattern | LOW |
| 5 | Concurrency | Atomic updateMany + optimistic lock | LOW |
| 6 | Audit logging | FinancialLedger as audit trail | LOW |
| 7 | Wallet top-up | Bank transfer (FriMi) | MEDIUM |
| 8 | Provider payout | Bank API | MEDIUM |
| 9 | Cash jobs | Remove escrow | LOW |
| 10 | Migration | 7 stages, 2-hour maintenance | MEDIUM |

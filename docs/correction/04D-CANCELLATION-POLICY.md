# 04D-CANCELLATION-POLICY.md — Cancellation Policy Definition

> Generated: Phase 4D.5 — Cancellation Policy
> Scope: Which states allow cancellation and final state verification

---

## CANCELLATION ALLOWED STATES

| Job Status | Cancellation Allowed | Policy |
|---|---|---|
| OPEN | YES | Simple cancel, no financial impact |
| QUOTE_ACCEPTED | YES | Cancel after quote accepted, escrow in PENDING_PAYMENT can be cancelled |
| IN_PROGRESS | YES | Cancel with potential escrow refund (Phase 5) |
| COMPLETED | NO | Terminal state, cannot cancel |
| CANCELLED | NO | Already cancelled, terminal state |

---

## FINAL STATE VERIFICATION

### MarketplaceJob = CANCELLED

After cancellation:
- `status = 'CANCELLED'`
- No further transitions allowed (terminal state)

### JobQuote

After cancellation from OPEN:
- Winning quote (if any) remains in ACCEPTED state (historical record)
- Losing quotes remain in REJECTED state

After cancellation from QUOTE_ACCEPTED:
- Accepted quote remains in ACCEPTED state (historical record)
- Escrow reference preserved

### JobWorkspace

After cancellation from OPEN:
- No workspace created (if cancelled before quote acceptance)

After cancellation from QUOTE_ACCEPTED:
- Workspace exists with `progressStatus = 'ACCEPTED'`
- NOT in IN_PROGRESS or COMPLETION_REQUESTED (financially inactive)

### JobEscrow

After cancellation from OPEN:
- No escrow created

After cancellation from QUOTE_ACCEPTED:
- Escrow in `PENDING_PAYMENT` state (not yet funded)
- No financial impact

After cancellation from IN_PROGRESS:
- Escrow in `PROTECTED` state requires Phase 5 refund logic
- Current system: escrow enters `ON_HOLD` or remains `PROTECTED`
- Financial reversal deferred to Phase 5

### Provider Selection

After cancellation:
- Provider does NOT appear as active engagement
- Quote remains as historical record but not active contract

### Notifications

After cancellation:
- No further active job notifications
- Cancellation notification sent (if implemented)

---

## CANCELLATION INVARIANTS

1. CANCELLED job cannot transition to any other state
2. CANCELLED job + active workspace = CONTRADICTION (must not occur)
3. CANCELLED job + PROTECTED escrow = BLOCKED for Phase 5 (financial reversal required)
4. CANCELLED job + PENDING_PAYMENT escrow = SAFE (no funds held)
5. CANCELLED job + RELEASED escrow = HISTORICAL (already completed)

---

## PHASE 5 REQUIREMENTS

If cancellation from IN_PROGRESS is required:
- Refund escrow to customer
- Update escrow status to REFUNDED
- Credit customer wallet
- This is Phase 5 Financial Core scope

Current Phase 4 behavior:
- Cancellation from IN_PROGRESS is ALLOWED in state machine
- Escrow remains in current state (financially inconsistent)
- Must be addressed in Phase 5

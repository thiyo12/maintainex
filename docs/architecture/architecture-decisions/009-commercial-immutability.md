# ADR-009: Completed Jobs Are Financially Immutable

**Status**: Accepted
**Date**: 2026-09-14

## Context

Once a job is completed and funds are released from escrow, modifying the job's financial fields (price, commission, payout amount) would create inconsistencies between the job record and the ledger. A provider could theoretically inflate their payout by editing the price after settlement, or a customer could reduce the charge after receiving service.

The platform needs clear boundaries for what can and cannot be modified at each lifecycle stage.

Reference: `lib/domain/commercial-immutability.ts` (68 lines)

## Decision

Implement explicit mutability checks that gate all financial modifications:

### Three Immutability Boundaries

1. **Quote immutability** (`assertQuoteMutable`):
   - ACCEPTED quotes cannot be modified (customer already committed)
   - SUPERSEDED quotes are frozen (replaced by a revision)
   - Quotes with a `parentQuoteId` cannot be modified (revision history)

2. **Change order immutability** (`assertChangeOrderMutable`):
   - Only DRAFT and SUBMITTED change orders can be modified
   - APPROVED, REJECTED, and CANCELLED change orders are frozen

3. **Job financial immutability** (`assertJobFinanciallyMutable`):
   - COMPLETED jobs cannot have financial fields modified
   - CANCELLED jobs are frozen
   - Jobs with RELEASED or REFUNDED escrow are frozen (payment settled)

### Enforcement Pattern

Every route that modifies financial data calls the appropriate assertion function first:

```typescript
const check = await assertJobFinanciallyMutable(client, jobId)
if (!check.mutable) {
  return NextResponse.json(
    { error: 'Job is financially immutable', reason: check.reason },
    { status: 409 }
  )
}
```

### Reason Codes

Each immutability violation returns a structured `reason` code:
- `QUOTE_ACCEPTED`, `QUOTE_SUPERSEDED`, `QUOTE_IS_REVISION`
- `CHANGE_ORDER_APPROVED`, `CHANGE_ORDER_REJECTED`, `CHANGE_ORDER_CANCELLED`
- `JOB_COMPLETED`, `JOB_CANCELLED`, `PAYMENT_SETTLED`

These codes enable client-side handling (e.g., showing "This quote has been accepted and cannot be edited" instead of a generic error).

## Consequences

### Positive
- Financial integrity: settled transactions cannot be tampered with
- Clear error messages: reason codes enable precise user feedback
- Audit compliance: immutable records satisfy regulatory requirements
- Prevention of double-spending: escrow release blocks further modifications

### Negative
- Correcting errors requires reversal entries rather than in-place edits
- UX friction: users must understand that accepted/finalized items are locked
- Edge cases: partially completed jobs with change orders need careful handling

### Neutral
- Assertions are defensive checks, not locks; they query current state at mutation time
- The pattern complements the double-entry ledger (ADR-001) and idempotency (ADR-008)

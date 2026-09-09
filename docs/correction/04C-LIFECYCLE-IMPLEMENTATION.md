# 04C-LIFECYCLE-IMPLEMENTATION.md — Domain Service Implementation

> Generated: Phase 4C.1 — Lifecycle Service
> Scope: Canonical domain service layer for MarketplaceJob state transitions

---

## DOMAIN SERVICE STRUCTURE

```
lib/domain/
  job-lifecycle.ts    — Core lifecycle transitions, quote acceptance, escrow operations
```

---

## CANONICAL FUNCTIONS

### transitionMarketplaceJob(ctx, targetStatus)

Validates and executes job-level status transitions.

- Validates actor owns the job (for customer transitions)
- Checks transition is allowed per frozen state map
- Uses conditional update (`WHERE status = expectedStatus`) for concurrency safety
- Returns updated job

### transitionJobWorkspace(ctx, targetStatus)

Validates and executes workspace-level progress transitions.

- Validates actor type matches transition permissions
- Checks transition is allowed per frozen workspace state map
- Cascades to MarketplaceJob.status on COMPLETED/DISPUTED
- Returns updated workspace

### acceptJobQuote(ctx, quoteId)

Atomic quote acceptance with full invariant enforcement.

- Validates customer owns job
- Validates job is OPEN
- Validates quote is PENDING and belongs to job
- Enforces ONE WINNING QUOTE invariant
- Creates/updates escrow with correct amounts
- Uses $transaction for atomicity
- Conditional update on job status for concurrency safety

### fundEscrow(ctx, jobId)

Customer deposits funds into escrow.

- Validates customer owns job
- Validates job is QUOTE_ACCEPTED or IN_PROGRESS
- Validates wallet balance
- Creates/updates escrow record
- Transitions job to IN_PROGRESS
- Uses $transaction for atomicity

### releaseEscrow(ctx, jobId)

Customer releases escrow to provider.

- Validates customer owns job
- Finds PROTECTED escrow
- Computes commission
- Credits provider wallet
- Transitions escrow to RELEASED
- Transitions job to COMPLETED
- Uses $transaction for atomicity

### refundEscrow(ctx, jobId)

Customer refunds escrow.

- Validates customer owns job
- Finds refundable escrow (PROTECTED or PENDING_PAYMENT)
- Credits customer wallet
- Transitions escrow to REFUNDED
- Transitions job to CANCELLED
- Uses $transaction for atomicity

---

## ACTOR TYPES

| Type | Authorization |
|---|---|
| CUSTOMER | Authenticated user owns the MarketplaceJob |
| PROVIDER | Authenticated user has accepted JobQuote on the job |
| COMPANY | Authenticated user is linked active company member |
| STAFF | Canonical Phase 3 AdminUser RBAC |
| SYSTEM | Cron/system operations (future) |

---

## STATE TRANSITION MAPS

### Job Status

```
OPEN → QUOTE_ACCEPTED | CANCELLED
QUOTE_ACCEPTED → IN_PROGRESS | CANCELLED
IN_PROGRESS → COMPLETED | CANCELLED
COMPLETED → (terminal)
CANCELLED → (terminal)
```

### Workspace Progress

```
ACCEPTED → IN_PROGRESS | DISPUTED
IN_PROGRESS → WAITING_CUSTOMER | COMPLETION_REQUESTED | DISPUTED
WAITING_CUSTOMER → IN_PROGRESS | COMPLETION_REQUESTED | DISPUTED
COMPLETION_REQUESTED → COMPLETED | DISPUTED
COMPLETED → (terminal)
DISPUTED → (terminal)
```

---

## CONCURRENCY PROTECTION

All lifecycle transitions use conditional updates:

```sql
UPDATE "MarketplaceJob"
SET status = $targetStatus
WHERE id = $jobId AND status = $expectedStatus
```

If the UPDATE affects 0 rows, the transition was stale → throw error.

This prevents two concurrent conflicting transitions from both succeeding.

---

## ROUTE HANDLERS UPDATED

| Route | Change |
|---|---|
| `/v2/jobs/[id]/select-quote` | Uses `acceptJobQuote()` |
| `/v2/jobs/[id]/workspace` | Uses `transitionJobWorkspace()` |
| `/v2/jobs/[id]/complete` | Uses `transitionJobWorkspace()` + `releaseEscrow()` |
| `/v2/jobs/[id]/escrow` | Uses `fundEscrow()` |
| `/v2/jobs/[id]/release-escrow` | Uses `releaseEscrow()` |

---

## INVARIANTS ENFORCED

1. One exclusive MarketplaceJob → maximum one accepted quote
2. Quote acceptance is atomic (quote + job + workspace + escrow)
3. Escrow fund/release/refund are atomic with wallet operations
4. Workspace transitions enforce role-based permissions
5. Terminal states (COMPLETED, CANCELLED) cannot be exited
6. Conditional updates prevent stale-state transitions

# 04B-CANONICAL-LIFECYCLE.md — Canonical Job Lifecycle Design

> Generated: Phase 4B — Canonical Lifecycle
> Scope: Target lifecycle state machine for MarketplaceJob with responsibility boundaries

---

## FOUR-LAYER STATUS ARCHITECTURE

Phase 4 freezes a four-layer status architecture. Each layer has its own state machine and responsibility boundary.

### Layer 1: Job Lifecycle (MarketplaceJob.status)

**Responsibility:** Overall job state — what is the commercial status of this work request?

```
OPEN → QUOTE_ACCEPTED → IN_PROGRESS → COMPLETED
  ↓         ↓                ↓
CANCELLED CANCELLED       CANCELLED
```

**States:**
- `OPEN` — Job posted, accepting quotes
- `QUOTE_ACCEPTED` — Customer selected a quote, awaiting escrow funding
- `IN_PROGRESS` — Escrow funded, work underway
- `COMPLETED` — Work done, escrow released
- `CANCELLED` — Job cancelled (by customer, provider, admin, or cron)

### Layer 2: Quote Lifecycle (JobQuote.status)

**Responsibility:** Individual provider proposal state — what is the status of this specific quote?

```
PENDING → ACCEPTED
   ↓
REJECTED / WITHDRAWN
```

**States:**
- `PENDING` — Quote submitted, awaiting decision
- `ACCEPTED` — Customer selected this quote
- `REJECTED` — Customer chose a different quote
- `WITHDRAWN` — Quote withdrawn (on escrow refund)

### Layer 3: Workspace Lifecycle (JobWorkspace.progressStatus)

**Responsibility:** Execution state — what is the progress of the actual work?

```
ACCEPTED → IN_PROGRESS → COMPLETION_REQUESTED → COMPLETED
                ↓
            WAITING_CUSTOMER
                ↓
            DISPUTED
```

**States:**
- `ACCEPTED` — Provider engaged, awaiting escrow
- `IN_PROGRESS` — Work started (after OTP verification)
- `WAITING_CUSTOMER` — Provider waiting for customer input
- `COMPLETION_REQUESTED` — Provider reports work done
- `COMPLETED` — Customer approved completion
- `DISPUTED` — Dispute raised

### Layer 4: Escrow Lifecycle (JobEscrow.status)

**Responsibility:** Financial state — what is the status of the held funds?

```
PENDING_PAYMENT → PROTECTED → RELEASED
       ↓              ↓
  CANCELLED       REFUNDED
                      ↓
                   ON_HOLD
```

**States:**
- `PENDING_PAYMENT` — Escrow created, awaiting customer deposit
- `PROTECTED` — Funds deposited and held
- `RELEASED` — Funds released to provider
- `REFUNDED` — Funds returned to customer
- `CANCELLED` — Escrow cancelled (timeout or refund)
- `ON_HOLD` — Funds held during dispute

---

## CROSS-LAYER INVARIANTS

### Invariant 1: Job Status Drives Workspace

When MarketplaceJob.status changes, JobWorkspace.progressStatus must update accordingly:

| Job Status | Workspace Status |
|---|---|
| OPEN | (no workspace yet) |
| QUOTE_ACCEPTED | ACCEPTED |
| IN_PROGRESS | IN_PROGRESS |
| COMPLETED | COMPLETED |
| CANCELLED | DISPUTED (if dispute) or (no change if simple cancel) |

### Invariant 2: Escrow Status Is Independent

JobEscrow.status has its own lifecycle that does not directly mirror MarketplaceJob.status:

| Job Status | Possible Escrow Statuses |
|---|---|
| OPEN | (no escrow yet) |
| QUOTE_ACCEPTED | PENDING_PAYMENT |
| IN_PROGRESS | PROTECTED |
| COMPLETED | RELEASED |
| CANCELLED | CANCELLED, REFUNDED, or ON_HOLD |

### Invariant 3: Quote Count Constraint

One MarketplaceJob has at most one ACCEPTED JobQuote at any time.

### Invariant 4: Financial Isolation

Escrow status transitions must not be inferred from job status alone. Each transition must be explicitly triggered by:
- Customer action (deposit, release, refund, dispute)
- Provider action (dispute)
- Admin action (force-release, force-refund)
- Cron action (auto-release, timeout)

---

## TRANSITION TABLE

| Trigger | Job → | Quote → | Workspace → | Escrow → |
|---|---|---|---|---|
| Customer creates job | OPEN | — | — | — |
| Provider submits quote | — | PENDING | — | — |
| Customer selects quote | QUOTE_ACCEPTED | ACCEPTED (+others REJECTED) | ACCEPTED | PENDING_PAYMENT |
| Customer funds escrow | IN_PROGRESS | — | IN_PROGRESS (after OTP) | PROTECTED |
| Provider marks complete | — | — | COMPLETION_REQUESTED | — |
| Customer approves | COMPLETED | — | COMPLETED | RELEASED |
| Customer releases escrow | COMPLETED | — | COMPLETED | RELEASED |
| Customer disputes | CANCELLED | — | DISPUTED | ON_HOLD |
| Provider disputes | CANCELLED | — | DISPUTED | ON_HOLD |
| Admin force-release | COMPLETED | — | — | RELEASED |
| Admin force-refund | CANCELLED | — | — | REFUNDED |
| Cron: escrow timeout | OPEN | PENDING | — | CANCELLED |
| Cron: auto-release | COMPLETED | — | COMPLETED | RELEASED |
| Customer cancels (pre-escrow) | CANCELLED | — | — | — |

---

## DOMAIN EVENTS (for future event sourcing)

Each transition should emit a domain event:

```typescript
DomainEvent {
  type: 'JOB_CREATED' | 'QUOTE_SUBMITTED' | 'QUOTE_ACCEPTED' | 'ESCROW_FUNDED' |
        'WORK_STARTED' | 'COMPLETION_REQUESTED' | 'COMPLETION_APPROVED' |
        'ESCROW_RELEASED' | 'DISPUTE_RAISED' | 'JOB_CANCELLED' | ...
  jobId: string
  actorId: string
  actorType: 'customer' | 'provider' | 'admin' | 'cron'
  timestamp: DateTime
  metadata: { ... }
}
```

**NOT implemented in Phase 4.** Documented for future reference.

---

## IDEMPOTENCY RULES

| Operation | Idempotency Strategy |
|---|---|
| Select quote | Check if already has ACCEPTED quote → return existing |
| Fund escrow | Check if escrow already PROTECTED → return existing |
| Release escrow | Check if escrow already RELEASED → return existing |
| Mark complete | Check if workspace already COMPLETION_REQUESTED → return existing |
| Dispute | Check if already DISPUTED → return existing |

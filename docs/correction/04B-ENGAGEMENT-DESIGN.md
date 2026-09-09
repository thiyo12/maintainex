# 04B-ENGAGEMENT-DESIGN.md — Engagement Composition vs New Model

> Generated: Phase 4B — Engagement Design Decision
> Scope: Whether to keep existing composition or add a JobEngagement model

---

## CURRENT COMPOSITION

The V2 "engagement" is currently spread across 4 models:

1. **MarketplaceJob** — the job itself, with `status` field
2. **JobQuote** — the accepted commercial proposal (status=ACCEPTED)
3. **JobWorkspace** — the execution tracking (progressStatus)
4. **JobEscrow** — the financial holding (status=PROTECTED)

When a customer selects a quote, the system:
- Sets JobQuote.status = ACCEPTED
- Sets MarketplaceJob.status = QUOTE_ACCEPTED → IN_PROGRESS
- Upserts JobWorkspace with progressStatus = ACCEPTED
- Creates JobEscrow with status = PENDING_PAYMENT

---

## INVARIANT ANALYSIS

### Can current composition enforce one winning provider?

**YES.** The select-quote route (`app/api/mobile/v2/jobs/[id]/select-quote/route.ts`):
- Accepts exactly one quote (UPDATE status → ACCEPTED)
- Rejects all others (UPDATEMANY status → REJECTED)
- This is transactional within a single request

**Invariant preserved: one exclusive winning provider per job.**

### Can current composition enforce accepted commercial terms?

**YES.** JobQuote stores:
- `price` (BigInt) — the accepted price
- `estimatedCompletionTime` (String) — the ETA
- `message` (String) — the proposal text
- `attachments` (String) — any proposal files

These are immutable once the quote is ACCEPTED (no route updates price after acceptance).

**Invariant preserved: accepted terms are captured in the quote.**

### Can current composition enforce immutable accepted quote linkage?

**YES.** The JobQuote record with status=ACCEPTED is never deleted or reassigned. The JobWorkspace and JobEscrow link to the job, not directly to the quote, but the quote's `jobId` + `providerId` + `status=ACCEPTED` uniquely identifies the engagement.

**Invariant preserved: accepted quote is immutable.**

### Can current composition enforce company vs individual provider identity?

**PARTIALLY.** JobQuote has a `providerType` field (INDIVIDUAL/COMPANY) and `providerId`. However:
- There is no Prisma relation to User or CompanyProfile
- The provider identity is resolved at read time via scalar FK lookups
- The accepted quote's providerId + providerType uniquely identifies the engaged provider

**Invariant preserved: provider identity is captured in the quote, but not enforced by FK constraints.**

### Can current composition enforce provider replacement/history?

**NO.** If a provider is replaced (e.g., company reassigns worker), there is no mechanism to:
- Record the original engagement
- Record the replacement
- Maintain history of who was engaged when

Currently, JobWorkspace is a single record — no history of provider changes.

**Gap: provider replacement not supported.**

### Can current composition enforce dispute/escrow relationship?

**YES.** The complete route handles DISPUTE:
- Sets JobEscrow.status = ON_HOLD
- Sets JobWorkspace.progressStatus = DISPUTED
- Sets MarketplaceJob.status = CANCELLED

**Invariant preserved: dispute and escrow are linked.**

---

## DECISION: KEEP EXISTING COMPOSITION

**Rationale:**

1. **5 of 6 invariants are preserved** by the current composition
2. **The one gap (provider replacement/history) is rare** — most jobs have one provider from start to finish
3. **Adding a JobEngagement model would require:**
   - New Prisma model
   - Migration
   - Updating all 26 escrow callers, 22 quote callers, 12 workspace callers
   - Risk of breaking existing financial flows
4. **The gap can be addressed additively later** if provider replacement becomes a real business need
5. **Phase 4B is design freeze, not implementation** — premature schema growth adds risk

**Decision: Keep existing composition as the canonical Engagement pattern.**

---

## ENGAGEMENT COMPOSITION PATTERN (DOCUMENTED)

```
Canonical Engagement = {
  job: MarketplaceJob,
  winningQuote: JobQuote (status=ACCEPTED),
  workspace: JobWorkspace (progressStatus),
  escrow: JobEscrow (status)
}
```

### Engagement Lifecycle

```
1. Customer creates MarketplaceJob (status=OPEN)
2. Providers submit JobQuotes (status=PENDING)
3. Customer selects one quote → engagement begins:
   - JobQuote.status = ACCEPTED
   - MarketplaceJob.status = QUOTE_ACCEPTED
   - JobWorkspace.progressStatus = ACCEPTED
   - JobEscrow.status = PENDING_PAYMENT
4. Customer funds escrow → engagement active:
   - MarketplaceJob.status = IN_PROGRESS
   - JobEscrow.status = PROTECTED
   - JobWorkspace.progressStatus = IN_PROGRESS (after OTP)
5. Provider completes work:
   - JobWorkspace.progressStatus = COMPLETION_REQUESTED
6. Customer approves → engagement complete:
   - MarketplaceJob.status = COMPLETED
   - JobEscrow.status = RELEASED
   - JobWorkspace.progressStatus = COMPLETED
7. Reviews exchanged:
   - JobReview (customer → provider)
   - ProviderReview (provider → customer)
```

---

## IF PROVIDER REPLACEMENT IS NEEDED LATER

Future additive design (NOT Phase 4):

```
JobEngagement
  id
  jobId → MarketplaceJob
  quoteId → JobQuote
  providerId → User
  providerType → INDIVIDUAL | COMPANY
  workerId → User (for company workers)
  acceptedAt → DateTime
  replacedAt → DateTime (nullable)
  replacedBy → JobEngagement (self-relation, nullable)
  status → ACTIVE | REPLACED | COMPLETED
```

This would allow:
- Company wins job → company engagement record
- Company assigns worker → workerId populated
- Worker replaced → new engagement record linked to previous

**NOT needed in Phase 4.** Add when the business requirement materializes.

---

## COMPANY JOB FLOW (WITH COMPOSITION)

```
MarketplaceJob created
    ↓
CompanyProfile submits JobQuote (providerType=COMPANY)
    ↓
Customer selects quote → engagement begins
    ↓
Company.assigns worker (via TeamMember)
    ↓
JobWorkspace tracks execution
    ↓
JobEscrow holds funds
    ↓
Completion → reviews → settlement
```

The "company assigns worker" step is currently implicit — there is no formal worker assignment in the V2 flow. The JobWorkspace tracks execution but doesn't record which specific worker is performing.

**Gap to document:** Company worker assignment is not formalized in V2. The CompanyProfile wins the job, but individual worker identity is not tracked in the engagement. This is acceptable for Phase 4 — the company is the engaged entity.

---

## CONCURRENCY INVARIANT

```
one MarketplaceJob → at most one active winning commercial engagement
```

Enforced by:
1. select-quote route accepts ONE quote atomically
2. All other quotes rejected in same transaction
3. JobWorkspace upserted (not created multiple times)
4. JobEscrow created once (idempotent check exists)

**Invariant preserved by existing composition.**

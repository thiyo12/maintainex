# 04B-JOB-MODES.md — Canonical Job Mode Architecture

> Generated: Phase 4B — Job Mode Design
> Scope: How BOOK_NOW, QUOTE, PROJECT, RECURRING, and URGENT map to canonical models

---

## DECISION: Two-Dimensional Model

**Mode** = the commercial/transactional type of job
**Urgency** = the priority/speed characteristic of the job

These are orthogonal. A PROJECT job can be URGENT. A BOOK_NOW job can be NORMAL.

### Target Conceptual Enum (NOT implemented yet)

```
JobMode:
  BOOK_NOW    — fixed-price catalog service, instant matching
  QUOTE       — provider quotes, customer selects
  PROJECT     — multi-phase, company bidding, milestones
  RECURRING   — scheduled repeat occurrences

JobUrgency:
  NORMAL      — standard response window
  URGENT      — accelerated matching, priority notification
  EMERGENCY   — immediate response required
```

**URGENT is NOT a mode.** It is a characteristic that affects matching priority, notification urgency, and response windows.

---

## MODE MAPPING TO CURRENT SCHEMA

### BOOK_NOW

| Aspect | Current Implementation | Target |
|---|---|---|
| Catalog | OfferTemplate (12 rows) | OfferTemplate remains catalog config |
| Transaction | OfferBooking (0 rows) | MarketplaceJob with mode=BOOK_NOW |
| Matching | OfferMatcher + OfferMatchQueue | JobMatchQueue (reuse V2 matching) |
| Price | OfferTemplate.priceLkr (fixed) | MarketplaceJob.budgetAmount + budgetType=FIXED |
| Production data | OfferBooking=0 | N/A — no data to migrate |

**Design:** BOOK_NOW creates a MarketplaceJob with:
- `budgetType: 'FIXED'`
- `templateJobId` → OfferTemplate's linked TemplateJob
- `serviceTemplateId` → if applicable
- Immediate matching via blastJobToTaskers

OfferTemplate remains the catalog/product layer. MarketplaceJob is the transaction.

### QUOTE (Current primary flow)

| Aspect | Current | Target |
|---|---|---|
| Job | MarketplaceJob (36 rows) | MarketplaceJob (canonical) |
| Proposal | JobQuote (7 rows) | JobQuote (canonical) |
| Matching | JobMatchQueue + blast | JobMatchQueue + blast (canonical) |
| Budget | budgetType: FIXED/REQUEST_QUOTES/NEGOTIABLE/HOURLY | All 4 modes retained |

**Design:** No changes needed. QUOTE is already the primary V2 flow.

### PROJECT

| Aspect | Current | Target |
|---|---|---|
| Company contract | Contract (0 rows) | Keep Contract for B2B agreements |
| Job | N/A | MarketplaceJob with mode=PROJECT |
| Milestones | Contract.milestones | Future additive (Phase 5+) |
| Company bidding | N/A | JobQuote from CompanyProfile providers |

**Design:** PROJECT jobs are MarketplaceJobs with:
- `budgetType: 'NEGOTIABLE'` or `'REQUEST_QUOTES'`
- Company providers submit quotes
- Longer response windows
- Optional milestone support (additive, Phase 5+)

Contract remains for B2B legal agreements. PROJECT jobs are marketplace transactions.

### RECURRING

| Aspect | Current | Target |
|---|---|---|
| Implementation | NONE | New: RecurringJobPlan model |
| Occurrences | N/A | Individual MarketplaceJobs |
| Production data | N/A | None |

**Design:**
```
RecurringJobPlan
  → customerId
  → templateJobId
  → frequency (weekly/monthly/etc)
  → nextOccurrenceAt
  → generates → MarketplaceJob (mode=RECURRING)
```

Each occurrence is a real MarketplaceJob with finite lifecycle, payment, review, and dispute.

**Phase 4C scope:** Design only. Implementation in Phase 5+.

### URGENT (Characteristic, not mode)

| Aspect | Current | Target |
|---|---|---|
| Field | MarketplaceJob.urgency (normal/urgent/emergency) | Retained as-is |
| Effect on matching | None currently | Future: priority in blast scoring |
| Effect on pricing | None currently | Future: urgency multiplier |
| Effect on response | responseDeadline field exists | Future: shorter window |

**Design:** Urgency modifies the behavior of any mode:
- BOOK_NOW + URGENT = faster matching
- QUOTE + URGENT = shorter response window
- PROJECT + URGENT = priority company notification
- RECURRING + URGENT = expedited next occurrence

---

## BUDGET TYPE → MODE MAPPING

| BudgetType | Production Count | Natural Mode | Notes |
|---|---|---|---|
| FIXED | 25 (69%) | BOOK_NOW or QUOTE | Known price, can be catalog or custom |
| REQUEST_QUOTES | 8 (22%) | QUOTE | Customer wants provider proposals |
| NEGOTIABLE | 2 (6%) | QUOTE or PROJECT | Price discussion expected |
| HOURLY | 1 (3%) | QUOTE or PROJECT | Time-based pricing |

**Note:** FIXED budgetType can be either BOOK_NOW (catalog price) or QUOTE (customer sets fixed budget and providers quote against it). The distinction is whether the price comes from a catalog (OfferTemplate/ServiceTemplate) or is set by the customer.

---

## MODE FIELD DESIGN

**Recommendation:** Add a `mode` field to MarketplaceJob in Phase 4C.

```
mode: String @default("QUOTE")
  "BOOK_NOW"   — fixed-price catalog, instant matching
  "QUOTE"      — provider quotes, customer selects (default)
  "PROJECT"    — multi-phase, company bidding
  "RECURRING"  — scheduled repeat occurrences
```

This is additive — existing 36 rows get `mode = "QUOTE"` as default.

**Do NOT add this in Phase 4B.** Phase 4B is design only. Phase 4C implements.

---

## INTERACTION MATRIX

| Mode | BudgetType | Quote Model | Escrow | Workspace | Reviews | Dispute |
|---|---|---|---|---|---|---|
| BOOK_NOW | FIXED | Optional (pre-set price) | YES | YES | JobReview + ProviderReview | YES |
| QUOTE | Any | Required (provider submits) | YES | YES | JobReview + ProviderReview | YES |
| PROJECT | NEGOTIABLE/REQUEST_QUOTES | Required (company submits) | YES | YES | JobReview + ProviderReview | YES |
| RECURRING | Any | Per-occurrence | Per-occurrence | Per-occurrence | Per-occurrence | Per-occurrence |

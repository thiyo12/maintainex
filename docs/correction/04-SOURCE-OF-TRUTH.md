# 04-SOURCE-OF-TRUTH.md — Canonical Source of Truth

> Generated: Phase 4C.9 — Final Source of Truth
> Scope: Every marketplace concept with authoritative model

---

## CANONICAL MODELS

| Concept | Canonical Model | Status |
|---|---|---|
| Job transaction | MarketplaceJob | CANONICAL |
| Provider proposal | JobQuote | CANONICAL |
| Execution tracking | JobWorkspace | CANONICAL |
| Payment escrow | JobEscrow | CANONICAL |
| Commission tracking | CommissionSettlement | CANONICAL |
| Job category | JobCategory | CANONICAL (V2) |
| Service definition | TemplateJob | CANONICAL (V2) |
| Pricing config | ServiceTemplate | CANONICAL (V2) |

---

## LEGACY MODELS (Preserved)

| Concept | Legacy Model | Status |
|---|---|---|
| Service booking | Booking | LEGACY — reads preserved |
| Job posting | JobPosting | LEGACY — reads preserved |
| Provider bid | Bid | LEGACY — reads preserved |
| Tasker assignment | Assignment | LEGACY — reads preserved |
| Business category | Category | LEGACY — web admin |
| Business service | Service | LEGACY — web admin |
| Service review | Review | LEGACY — reads preserved |
| Job dispute | Dispute | LEGACY — reads preserved |

---

## DEPRECATED MODELS

| Concept | Model | Status |
|---|---|---|
| Quick booking | OfferBooking | DEPRECATED — no new writes |
| Offer enrollment | OfferEnrollment | DEPRECATED — no new writes |
| Offer matching | OfferMatchQueue | DEPRECATED — no new writes |
| V1 payout request | PayoutRequest | DEPRECATED — zero callers |

---

## JOB MODE

| Mode | Implementation | Status |
|---|---|---|
| BOOK_NOW | MarketplaceJob (mode=BOOK_NOW) | CANONICAL |
| QUOTE | MarketplaceJob + JobQuote | CANONICAL |
| PROJECT | MarketplaceJob + company providers | CANONICAL |
| RECURRING | Future RecurringJobPlan | DEFERRED |

---

## URGENCY

| Level | Field | Status |
|---|---|---|
| NORMAL | MarketplaceJob.urgency = 'normal' | ACTIVE |
| URGENT | MarketplaceJob.urgency = 'urgent' | ACTIVE |
| EMERGENCY | MarketplaceJob.urgency = 'emergency' | ACTIVE |

Urgency is a MarketplaceJob characteristic, NOT a mode.

---

## ENGAGEMENT PATTERN

```
MarketplaceJob
+ accepted JobQuote
+ JobWorkspace
+ JobEscrow
```

No new JobEngagement model. Composition pattern retained.

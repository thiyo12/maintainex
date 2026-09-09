# 04B-API-TRANSITION.md — API Endpoint → Domain Service Mapping

> Generated: Phase 4B — API Transition Design
> Scope: How existing endpoints map to canonical domain services

---

## V2 CANONICAL ENDPOINTS (no changes needed)

These endpoints already operate on canonical models and require no transition:

| Endpoint | Model | Operation | Status |
|---|---|---|---|
| POST /api/mobile/v2/jobs | MarketplaceJob | CREATE | CANONICAL |
| GET /api/mobile/v2/jobs | MarketplaceJob | READ | CANONICAL |
| GET /api/mobile/v2/jobs/[id] | MarketplaceJob | READ | CANONICAL |
| POST /api/mobile/v2/quotes | JobQuote | CREATE | CANONICAL |
| GET /api/mobile/v2/quotes | JobQuote | READ | CANONICAL |
| POST /api/mobile/v2/jobs/[id]/select-quote | MarketplaceJob + JobQuote | UPDATE | CANONICAL |
| POST /api/mobile/v2/jobs/[id]/escrow | JobEscrow | CREATE/UPDATE | CANONICAL |
| GET /api/mobile/v2/jobs/[id]/escrow | JobEscrow | READ | CANONICAL |
| POST /api/mobile/v2/jobs/[id]/escrow/refund | JobEscrow | UPDATE | CANONICAL |
| POST /api/mobile/v2/jobs/[id]/release-escrow | JobEscrow | UPDATE | CANONICAL |
| PATCH /api/mobile/v2/jobs/[id]/workspace | JobWorkspace | UPDATE | CANONICAL |
| GET /api/mobile/v2/jobs/[id]/workspace | JobWorkspace | READ | CANONICAL |
| POST /api/mobile/v2/jobs/[id]/otp | JobOtp | CREATE | CANONICAL |
| POST /api/mobile/v2/jobs/[id]/otp/verify | JobOtp + JobWorkspace | UPDATE | CANONICAL |
| POST /api/mobile/v2/jobs/[id]/complete | MarketplaceJob + JobWorkspace + JobEscrow | UPDATE | CANONICAL |
| POST /api/mobile/v2/jobs/[id]/cash-payment | JobEscrow + Wallet | UPDATE | CANONICAL |
| POST /api/mobile/v2/jobs/[id]/share-address | MarketplaceJob | UPDATE | CANONICAL |
| POST /api/mobile/v2/jobs/[id]/reviews | JobReview + ProviderReview | CREATE | CANONICAL |
| GET /api/mobile/v2/jobs/[id]/reviews | JobReview + ProviderReview | READ | CANONICAL |
| GET /api/mobile/v2/wallet | ProviderWallet / CustomerWallet | READ | CANONICAL |
| POST /api/mobile/v2/wallet | CustomerWallet | UPDATE | CANONICAL |

---

## V2 ADMIN ENDPOINTS (no changes needed)

| Endpoint | Model | Operation | Status |
|---|---|---|---|
| GET /api/mobile/v2/admin/jobs | MarketplaceJob | READ | CANONICAL |
| GET /api/mobile/v2/admin/summary | MarketplaceJob + JobQuote + Wallet | READ | CANONICAL |
| GET /api/mobile/v2/admin/escrows | JobEscrow | READ | CANONICAL |
| POST /api/mobile/v2/admin/escrows | JobEscrow | UPDATE | CANONICAL |
| GET /api/mobile/v2/admin/commission-settle | CommissionSettlement | READ | CANONICAL |
| POST /api/mobile/v2/admin/commission-settle | CommissionSettlement | UPDATE | CANONICAL |

---

## V1 LEGACY ENDPOINTS (preserve for compatibility)

### Booking Endpoints — PRESERVE

| Endpoint | Model | Action | Transition Plan |
|---|---|---|---|
| GET /api/bookings | Booking | READ | PRESERVE — admin CRM dependency |
| POST /api/bookings | Booking | CREATE | PRESERVE temporarily — verify if any client uses it |
| GET /api/bookings/[id] | Booking | READ | PRESERVE |
| PATCH /api/bookings/[id] | Booking | UPDATE | PRESERVE |
| DELETE /api/bookings/[id] | Booking | DELETE | PRESERVE |
| POST /api/bookings/[id]/invoice | Booking + Invoice | CREATE | PRESERVE |

### Mobile V1 Booking Endpoints — PRESERVE TEMPORARILY

| Endpoint | Model | Action | Transition Plan |
|---|---|---|---|
| POST /api/mobile/bookings | Booking | CREATE | DEPRECATE — verify no active client |
| GET /api/mobile/bookings | Booking | READ | PRESERVE — history display |
| GET /api/mobile/bookings/[id] | Booking | READ | PRESERVE |
| POST /api/mobile/quick-bookings | Booking | CREATE | DEPRECATE — converge to MarketplaceJob BOOK_NOW |
| GET /api/mobile/quick-bookings/[id] | Booking | READ | PRESERVE |

### Mobile V1 Job Endpoints — DEPRECATE

| Endpoint | Model | Action | Transition Plan |
|---|---|---|---|
| POST /api/mobile/jobs | JobPosting | CREATE | DEPRECATE — no active V1 clients expected |
| GET /api/mobile/jobs | JobPosting | READ | PRESERVE — historical data display |
| GET /api/mobile/jobs/[id] | JobPosting | READ | PRESERVE |
| PUT /api/mobile/jobs/[id] | JobPosting | UPDATE | DEPRECATE |
| DELETE /api/mobile/jobs/[id] | JobPosting | DELETE | DEPRECATE |
| POST /api/mobile/jobs/[id]/bid | Bid | CREATE | DEPRECATE — 0 production rows |

### Web Admin Unified Jobs — PRESERVE

| Endpoint | Model | Action | Transition Plan |
|---|---|---|---|
| GET /api/admin/jobs | V1+V2 unified | READ | PRESERVE — uses `source: 'V1' | 'V2'` pattern |
| PATCH /api/admin/jobs | V1+V2 unified | UPDATE | PRESERVE — routes by source field |

---

## CATALOG ENDPOINTS — PRESERVE BOTH

### V1 Catalog (for web admin)

| Endpoint | Model | Action | Status |
|---|---|---|---|
| GET /api/services | Service | READ | PRESERVE |
| POST /api/services | Service | CREATE | PRESERVE |
| GET /api/categories | Category | READ | PRESERVE |

### V2 Catalog (for mobile app)

| Endpoint | Model | Action | Status |
|---|---|---|---|
| GET /api/mobile/job-categories | JobCategory | READ | CANONICAL |
| GET /api/mobile/job-categories/[id] | JobCategory | READ | CANONICAL |
| GET /api/mobile/template-jobs | TemplateJob | READ | CANONICAL |
| GET /api/mobile/template-jobs/[id] | TemplateJob | READ | CANONICAL |
| GET /api/mobile/template-jobs/popular | TemplateJob | READ | CANONICAL |
| GET /api/mobile/template-jobs/search | TemplateJob | READ | CANONICAL |
| GET /api/mobile/v2/service-templates | ServiceTemplate | READ | CANONICAL |
| GET /api/mobile/service-categories | JobCategory | READ | CANONICAL |

---

## OFFER/FLASH ENDPOINTS — PRESERVE

| Endpoint | Model | Action | Status |
|---|---|---|---|
| GET /api/flash-offers | FlashOffer | READ | PRESERVE — promotional |
| POST /api/flash-offers | FlashOffer | CREATE | PRESERVE — admin only |
| PATCH /api/flash-offers/[id] | FlashOffer | UPDATE | PRESERVE |
| DELETE /api/flash-offers/[id] | FlashOffer | DELETE | PRESERVE |
| POST /api/flash-offers/claim | FlashOffer | UPDATE | SECURITY GAP — needs auth |
| GET /api/seasonal-offers | SeasonalOffer | READ | PRESERVE |
| POST /api/seasonal-offers | SeasonalOffer | CREATE | PRESERVE |

---

## DISPUTE ENDPOINTS — PRESERVE V1, V2 VIA COMPLETE

| Endpoint | Model | Action | Status |
|---|---|---|---|
| POST /api/mobile/disputes | Dispute (V1) | CREATE | PRESERVE — references JobPosting |
| GET /api/mobile/disputes | Dispute (V1) | READ | PRESERVE |
| GET /api/mobile/disputes/[id] | Dispute (V1) | READ | PRESERVE |
| GET /api/admin/disputes | Dispute (V1) | READ | PRESERVE |
| PATCH /api/admin/disputes | Dispute (V1) | UPDATE | PRESERVE |
| POST /api/mobile/v2/jobs/[id]/complete (DISPUTE) | MarketplaceJob + Escrow + Workspace | UPDATE | CANONICAL — V2 dispute path |

---

## API TRANSITION RULE

**Phase 4C policy:**

1. All NEW marketplace transactional work → V2 endpoints only
2. V1 endpoints preserved for historical data read
3. V1 write endpoints deprecated but not disabled until client verification
4. No endpoint deletion in Phase 4
5. No endpoint URL changes in Phase 4

# 04-DOMAIN-CALL-GRAPH.md — Complete Route → Service → Model → Operation Map

> Generated: Phase 4A.2 — Full Domain Discovery
> Scope: All transactional marketplace models, all API routes, all service callers, all cron jobs

---

## PRODUCTION ROW COUNTS (Phase 4A.5 verified)

| Model | Rows | Classification |
|---|---|---|
| Booking | 31 | V1 legacy, active |
| MarketplaceJob | 36 | V2 primary, active |
| JobPosting | 5 | V1 legacy, active |
| TemplateJob | 239 | Catalog, active |
| ServiceTemplate | 239 | Catalog, active |
| JobCategory | 24 | Catalog, active |
| OfferTemplate | 12 | Offer program, active |
| OfferBooking | 0 | Offer program, empty |
| OfferEnrollment | 0 | Offer program, empty |
| OfferMatchQueue | 0 | Offer program, empty |
| FlashOffer | 2 | Promotional, active |
| SeasonalOffer | 0 | Promotional, empty |
| SeasonalOfferJob | 0 | Promotional, empty |
| JobQuote | 7 | V2 quotes, active |
| JobWorkspace | 5 | V2 workspace, active |
| JobOtp | 1 | V2 OTP, active |
| JobMatchQueue | 0 | V2 matching, empty |
| Bid | 0 | V1 bids, empty |
| Assignment | 0 | V1 assignments, empty |
| JobEscrow | 11 | V2 financial, active |
| CommissionSettlement | 10 | V2 financial, active |
| ProviderWallet | 27 | Financial, active |
| CustomerWallet | 46 | Financial, active |
| WalletTransaction | 24 | Financial, active |
| WeeklySettlement | 10 | Financial, active |
| CommissionPayment | 8 | Financial, active |
| Invoice | 4 | V1 billing, active |
| InvoiceItem | 4 | V1 billing, active |
| Quotation | 0 | Unused |
| QuotationItem | 0 | Unused |
| Dispute | 5 | V1 disputes, active |
| Review | 10 | V1 reviews, active |
| TaskerReview | 0 | V2 reviews, empty |
| JobReview | 0 | V2 reviews, empty |
| ProviderReview | 0 | V2 reviews, empty |
| TaskerProfile | 22 | Provider entity, active |
| TaskerSkill | 0 | Provider entity, empty |
| CompanyProfile | 9 | Company entity, active |
| CompanySpecialty | 0 | Unused |
| TeamMember | 0 | Company entity, empty |
| Conversation | 0 | Messaging, empty |
| Message | 0 | Messaging, empty |
| Payout | 0 | Financial, empty |
| PayoutRequest | 0 | Unused |

---

## BOOKING — Route/Caller Graph

### Direct prisma.booking Operations

| File | Line | Operation | Purpose | Actor | Side Effects | Status |
|---|---|---|---|---|---|---|
| `app/api/bookings/route.ts` | 37 | READ (findMany) | List all bookings (admin) | Admin | None | ACTIVE |
| `app/api/bookings/route.ts` | 175 | CREATE | Create web booking | Auth user | None | ACTIVE |
| `app/api/bookings/[id]/route.ts` | 16 | READ (findUnique) | Get single booking | Admin | None | ACTIVE |
| `app/api/bookings/[id]/route.ts` | 88 | UPDATE | Update booking status | Admin | Auto-creates Invoice+InvoiceItem on COMPLETED; ActivityLog | ACTIVE |
| `app/api/bookings/[id]/route.ts` | 197 | DELETE | Delete booking | Admin | ActivityLog | ACTIVE |
| `app/api/bookings/[id]/invoice/route.ts` | 28 | READ (findUnique) | Look up booking for invoice | Admin | None | ACTIVE |
| `app/api/bookings/[id]/invoice/route.ts` | 72 | UPDATE | Set status to INVOICED | Admin | Invoice created | ACTIVE |
| `app/api/mobile/bookings/route.ts` | 34 | CREATE | Mobile create booking | Customer | None | ACTIVE |
| `app/api/mobile/bookings/route.ts` | 99 | READ (findMany) | Mobile list my bookings | Customer | None | ACTIVE |
| `app/api/mobile/bookings/[id]/route.ts` | 12 | READ (findUnique) | Mobile get booking | Customer/Provider | None | ACTIVE |
| `app/api/mobile/quick-bookings/route.ts` | 32 | CREATE | Quick booking (offer) | Customer | None | ACTIVE |
| `app/api/mobile/quick-bookings/[id]/route.ts` | 12 | READ (findFirst) | Get quick booking | Customer | None | ACTIVE |
| `app/api/reports/route.ts` | 175 | READ (groupBy) | Daily stats by status | Admin | None | ACTIVE |
| `app/api/districts/route.ts` | 53 | READ (groupBy) | Active bookings by district | Admin | None | ACTIVE |
| `app/api/customers/[id]/route.ts` | 96 | READ (findMany) | Customer recent bookings | Admin | None | ACTIVE |
| `lib/activity-log.ts` | 141 | READ (groupBy) | Period stats aggregation | Admin (indirect) | None | ACTIVE |

**Total: 18 call sites across 10 files**

### Indirect Booking References

| File | Line | Reference | Purpose | Status |
|---|---|---|---|---|
| `app/api/customers/route.ts` | 43-44,73-74 | CustomerProfile.totalBookings filter | CRM customer search by booking count | ACTIVE |
| `app/api/admin/users/route.ts` | 103,106 | CustomerProfile.totalBookings, lastBooking | Admin user list enrichment | ACTIVE |
| `app/api/reports/export/route.ts` | 86-98 | getStatsForPeriod (uses booking.groupBy) | PDF report generation | ACTIVE |
| `lib/crm/validation.ts` | 7,13-14 | sortBy: 'totalBookings', minBookings/maxBookings | CRM validation schema | ACTIVE |
| `lib/crm/access-control.ts` | 55-72 | bookings:read, bookings:write permissions | RBAC definitions | ACTIVE |
| `lib/validations.ts` | 3-15,40 | bookingSchema Zod definition | Form validation (uncertain — route uses inline validation) | UNCERTAIN |

---

## MARKETPLACEJOB — Route/Caller Graph

### CREATE Operations

| File | Line | Purpose | Actor | Side Effects | Status |
|---|---|---|---|---|---|
| `app/api/mobile/v2/jobs/route.ts` | 78 | Customer posts new job | Customer | blastJobToTaskers, Conversation create, AI price estimate | ACTIVE |
| `app/api/seed/test-data/route.ts` | 153 | Seed test data | System | None | ACTIVE |
| `prisma/seed.ts` | 736 | Seed 20 jobs | System | None | ACTIVE |

### READ Operations (46 sites)

| File | Line | Purpose | Actor | Status |
|---|---|---|---|---|
| `app/api/mobile/v2/jobs/route.ts` | 240 | List jobs by role | Customer/Provider | ACTIVE |
| `app/api/mobile/v2/jobs/[id]/route.ts` | 19 | Job detail with quotes, escrow, workspace, reviews | Customer/Provider | ACTIVE |
| `app/api/mobile/v2/jobs/[id]/select-quote/route.ts` | 20 | Verify job before quote selection | Customer | ACTIVE |
| `app/api/mobile/v2/jobs/[id]/workspace/route.ts` | 13,46 | Fetch workspace for job | Customer/Provider | ACTIVE |
| `app/api/mobile/v2/jobs/[id]/otp/route.ts` | 15,58 | Check job status for OTP | Provider/Customer | ACTIVE |
| `app/api/mobile/v2/jobs/[id]/otp/verify/route.ts` | 22 | Verify job before OTP verification | Customer | ACTIVE |
| `app/api/mobile/v2/jobs/[id]/complete/route.ts` | 24 | Check job before complete/dispute | Customer/Provider | ACTIVE |
| `app/api/mobile/v2/jobs/[id]/release-escrow/route.ts` | 17 | Verify customer owns job | Customer | ACTIVE |
| `app/api/mobile/v2/jobs/[id]/reviews/route.ts` | 20 | Verify job is COMPLETED | Customer/Provider | ACTIVE |
| `app/api/mobile/v2/jobs/[id]/share-address/route.ts` | 18 | Verify customer owns job | Customer | ACTIVE |
| `app/api/mobile/v2/jobs/[id]/escrow/route.ts` | 16,106 | Verify ownership, check access | Customer/Provider | ACTIVE |
| `app/api/mobile/v2/jobs/[id]/escrow/refund/route.ts` | 15 | Verify customer owns job | Customer | ACTIVE |
| `app/api/mobile/v2/quotes/route.ts` | 29,76 | Verify job is OPEN, list quotes | Provider/Customer | ACTIVE |
| `app/api/mobile/v2/schedule/route.ts` | 18 | Cluster open jobs by proximity | Auth user | ACTIVE |
| `app/api/mobile/v2/match/[jobId]/route.ts` | 14 | Get job for provider matching | Customer | ACTIVE |
| `app/api/mobile/v2/admin/jobs/route.ts` | 20,26 | Admin list jobs | Admin | ACTIVE |
| `app/api/mobile/v2/admin/summary/route.ts` | 25-29 | Admin dashboard counts | Admin | ACTIVE |
| `app/api/admin/jobs/route.ts` | 58,62 | Web admin list V2 jobs | Admin | ACTIVE |
| `app/api/admin/jobs/route.ts` | 182 | Admin PATCH job lookup | Admin | ACTIVE |
| `app/api/admin/analytics/route.ts` | 28-31 | Admin analytics counts | Admin | ACTIVE |
| `app/api/admin/commission/route.ts` | 276 | Weekly earnings calculation | Admin | ACTIVE |
| `app/api/mobile/auth/me/route.ts` | 46 | Compute customer tier | Customer | ACTIVE |
| `app/api/mobile/taskers/[id]/location/route.ts` | 13 | Verify job access | Customer/Provider | ACTIVE |
| `app/api/mobile/conversations/[id]/route.ts` | 60 | Load job context for chat | Customer/Provider | ACTIVE |
| `lib/job-matcher.ts` | 27 | Look up job before matching | System | ACTIVE |
| `lib/matching-engine.ts` | 25 | Look up job before matching | System | ACTIVE |
| `lib/job-matching.ts` | 65 | Find IN_PROGRESS jobs | System | ACTIVE |
| `lib/job-blast.ts` | 13 | Look up job before blast | System | ACTIVE |
| `lib/schedule-engine.ts` | 127 | Get open jobs for schedule | System | ACTIVE |
| `lib/trust-engine.ts` | 23,106 | Customer trust score calculation | System | ACTIVE |
| `lib/quality-engine.ts` | 19-21,32,41 | Provider quality score | System | ACTIVE |
| `lib/learning-engine.ts` | 55 | Recent 7-day jobs | System | ACTIVE |
| `lib/demand-engine.ts` | 73,77,81 | Demand/supply ratio | System | ACTIVE |
| `lib/fraud-detection.ts` | 162 | Dispute abuse check | System | ACTIVE |
| `lib/bi-engine.ts` | 48-50,52,93-97,120,151,155 | Business intelligence | System | ACTIVE |
| `scripts/train-pricing-models.ts` | 6 | Train pricing models | CLI | ACTIVE |

### Cron READ Operations

| File | Line | Purpose | Status |
|---|---|---|---|
| `app/api/cron/matching-waves/route.ts` | 23,41,59 | Wave escalation | ACTIVE |
| `app/api/cron/job-response-escalation/route.ts` | 16 | Find overdue OPEN jobs | ACTIVE |
| `app/api/cron/pricing-train/route.ts` | 13 | ML pricing training | ACTIVE |
| `app/api/cron/escrow-release/route.ts` | 109 | Get job title for notification | ACTIVE |
| `app/api/cron/re-engagement/route.ts` | 19 | Find old OPEN jobs | ACTIVE |

### UPDATE Operations (18 sites)

| File | Line | Purpose | Actor | Side Effects | Status |
|---|---|---|---|---|---|
| `app/api/mobile/v2/jobs/[id]/select-quote/route.ts` | 40 | Quote accepted → QUOTE_ACCEPTED | Customer | JobWorkspace upsert, JobEscrow create | ACTIVE |
| `app/api/mobile/v2/jobs/[id]/escrow/route.ts` | 83 | Fund escrow → IN_PROGRESS | Customer | Wallet debit, JobEscrow → PROTECTED | ACTIVE |
| `app/api/mobile/v2/jobs/[id]/workspace/route.ts` | 89 | Workspace COMPLETED → job COMPLETED | Customer/Provider | None | ACTIVE |
| `app/api/mobile/v2/jobs/[id]/workspace/route.ts` | 95 | Workspace DISPUTED → job CANCELLED | Customer/Provider | None | ACTIVE |
| `app/api/mobile/v2/jobs/[id]/release-escrow/route.ts` | 63 | Manual release → COMPLETED | Customer | ProviderWallet credit, WalletTransaction | ACTIVE |
| `app/api/mobile/v2/jobs/[id]/complete/route.ts` | 92 | Approve completion → COMPLETED | Customer | Escrow release, provider wallet credit, commission | ACTIVE |
| `app/api/mobile/v2/jobs/[id]/complete/route.ts` | 127 | Dispute → CANCELLED | Customer/Provider | JobEscrow → ON_HOLD | ACTIVE |
| `app/api/mobile/v2/jobs/[id]/share-address/route.ts` | 26 | Share address | Customer | None | ACTIVE |
| `app/api/mobile/v2/jobs/[id]/escrow/refund/route.ts` | 50 | Refund → CANCELLED | Customer | CustomerWallet credit, WalletTransaction | ACTIVE |
| `app/api/mobile/v2/quotes/route.ts` | 52 | First quote → responded | Provider | None | ACTIVE |
| `app/api/mobile/v2/admin/escrows/route.ts` | 82 | Admin force-release | Admin | ProviderWallet credit, WalletTransaction | ACTIVE |
| `app/api/mobile/v2/admin/escrows/route.ts` | 123 | Admin force-refund | Admin | CustomerWallet credit, WalletTransaction | ACTIVE |
| `app/api/admin/jobs/route.ts` | 186 | Admin change status | Admin | None | ACTIVE |
| `lib/job-matcher.ts` | 205 | Record wave sent | System | None | ACTIVE |
| `lib/job-blast.ts` | 64 | Record blast results | System | None | ACTIVE |

### Cron UPDATE Operations

| File | Line | Purpose | Status |
|---|---|---|---|
| `app/api/cron/matching-waves/route.ts` | 77 | Reset wave to 0 | ACTIVE |
| `app/api/cron/job-response-escalation/route.ts` | 30,47 | Mark responded/escalated | ACTIVE |
| `app/api/cron/daily-maintenance/route.ts` | 45 | Revert QUOTE_ACCEPTED → OPEN | ACTIVE |
| `app/api/cron/escrow-release/route.ts` | 68 | Auto-release → COMPLETED | ACTIVE |

**Total: 67 call sites**

---

## JOBPOSTING — Route/Caller Graph

### CREATE (3 sites)

| File | Line | Purpose | Actor | Status |
|---|---|---|---|---|
| `app/api/mobile/jobs/route.ts` | 112 | Customer creates V1 job | Customer | ACTIVE (legacy) |
| `prisma/seed.ts` | 783 | Seed 10 V1 postings | System | ACTIVE |
| `app/api/seed/test-data/route.ts` | 509 | Seed test data | System | ACTIVE |

### READ (11 sites)

| File | Line | Purpose | Actor | Status |
|---|---|---|---|---|
| `app/api/mobile/jobs/route.ts` | 30 | List V1 jobs | Customer/Tasker | ACTIVE (legacy) |
| `app/api/mobile/jobs/[id]/route.ts` | 17 | V1 job detail | Customer | ACTIVE (legacy) |
| `app/api/mobile/jobs/[id]/route.ts` | 92,150 | Lookup before update/delete | Customer/Tasker | ACTIVE (legacy) |
| `app/api/mobile/jobs/[id]/bid/route.ts` | 19 | Verify OPEN before bid | Tasker | ACTIVE (legacy) |
| `app/api/mobile/bookings/route.ts` | 55 | Get job title for booking | Customer | ACTIVE (legacy) |
| `app/api/mobile/disputes/route.ts` | 21 | Verify job before dispute | Customer/Tasker | ACTIVE (legacy) |
| `app/api/mobile/earnings/route.ts` | 24 | Count completed V1 jobs | Customer/Tasker | ACTIVE (legacy) |
| `app/api/admin/jobs/route.ts` | 43,57 | Admin list V1 jobs | Admin | ACTIVE |
| `app/api/admin/jobs/route.ts` | 194 | Admin PATCH lookup | Admin | ACTIVE |
| `app/api/dashboard/route.ts` | 52-54 | Web dashboard counts | Admin | ACTIVE |

### UPDATE (2 sites)

| File | Line | Purpose | Actor | Status |
|---|---|---|---|---|
| `app/api/mobile/jobs/[id]/route.ts` | 118 | Status update | Customer/Tasker | ACTIVE (legacy) |
| `app/api/admin/jobs/route.ts` | 198 | Admin status update | Admin | ACTIVE |

### DELETE (1 site)

| File | Line | Purpose | Actor | Status |
|---|---|---|---|---|
| `app/api/mobile/jobs/[id]/route.ts` | 158 | Delete V1 job | Customer/Admin | ACTIVE (legacy) |

**Total: 17 call sites**

---

## JOBQUOTE — Route/Caller Graph

### CREATE (1 site)

| File | Line | Purpose | Actor | Status |
|---|---|---|---|---|
| `app/api/mobile/v2/quotes/route.ts` | 39 | Submit quote on OPEN job | Provider | ACTIVE |

### READ (17 sites)

| File | Line | Purpose | Actor | Status |
|---|---|---|---|---|
| `app/api/mobile/v2/jobs/[id]/route.ts` | 25,40 | Check user has quoted, list quotes | Customer/Provider | ACTIVE |
| `app/api/mobile/v2/jobs/[id]/select-quote/route.ts` | 25 | Verify quote exists | Customer | ACTIVE |
| `app/api/mobile/v2/jobs/[id]/workspace/route.ts` | 17,51 | Check participant access | Customer/Provider | ACTIVE |
| `app/api/mobile/v2/jobs/[id]/otp/route.ts` | 27,71 | Verify accepted quote | Provider/Customer | ACTIVE |
| `app/api/mobile/v2/jobs/[id]/complete/route.ts` | 28,77,109 | Verify provider ownership | Customer/Provider | ACTIVE |
| `app/api/mobile/v2/jobs/[id]/escrow/route.ts` | 23,110 | Verify accepted quote | Customer/Provider | ACTIVE |
| `app/api/mobile/v2/jobs/[id]/reviews/route.ts` | 27,77 | Get provider for review | Customer/Provider | ACTIVE |
| `app/api/mobile/v2/quotes/route.ts` | 34,80,83 | Duplicate check, participation, list | Provider/Customer | ACTIVE |
| `app/api/mobile/v2/admin/summary/route.ts` | 34 | Admin total quote count | Admin | ACTIVE |
| `app/api/mobile/taskers/[id]/location/route.ts` | 17,27 | Check quote, get accepted quote | Customer/Provider | ACTIVE |
| `lib/job-matching.ts` | 70 | Find accepted quotes for busy providers | System | ACTIVE |
| `app/api/admin/commission/route.ts` | 288 | Weekly earnings calculation | Admin | ACTIVE |

### Cron READ

| File | Line | Purpose | Status |
|---|---|---|---|
| `app/api/cron/job-response-escalation/route.ts` | 28 | Count quotes on overdue job | ACTIVE |
| `app/api/cron/daily-maintenance/route.ts` | 39 | Find accepted quote for reset | ACTIVE |
| `app/api/cron/re-engagement/route.ts` | 27 | Group quotes by jobId | ACTIVE |

### UPDATE (4 sites)

| File | Line | Purpose | Actor | Status |
|---|---|---|---|---|
| `app/api/mobile/v2/jobs/[id]/select-quote/route.ts` | 38 | Accept quote | Customer | ACTIVE |
| `app/api/mobile/v2/jobs/[id]/select-quote/route.ts` | 39 | Reject all others | Customer | ACTIVE |
| `app/api/mobile/v2/jobs/[id]/escrow/refund/route.ts` | 54 | Withdraw on refund | Customer | ACTIVE |
| `app/api/cron/daily-maintenance/route.ts` | 50 | Reset accepted → PENDING | Cron | ACTIVE |

**Total: 22 call sites**

---

## TEMPLATEJOB — Route/Caller Graph

### READ (22 sites — catalog, public + authenticated)

| File | Line | Purpose | Actor | Status |
|---|---|---|---|---|
| `app/api/mobile/template-jobs/route.ts` | 14 | List by category+country | Public | ACTIVE |
| `app/api/mobile/template-jobs/[id]/route.ts` | 7 | Get single template | Public | ACTIVE |
| `app/api/mobile/template-jobs/popular/route.ts` | 10 | Top 10 popular | Public | ACTIVE |
| `app/api/mobile/template-jobs/search/route.ts` | 13 | Search by name | Public | ACTIVE |
| `app/api/mobile/search/route.ts` | 30 | Global search | Auth user | ACTIVE |
| `app/api/mobile/find-tasker/route.ts` | 24 | Resolve category for matching | Auth user | ACTIVE |
| `app/api/mobile/quick-bookings/route.ts` | 20 | Validate before booking | Auth user | ACTIVE |
| `app/api/mobile/taskers/skills/route.ts` | 115 | Validate job IDs | Tasker | ACTIVE |
| `app/api/mobile/v2/jobs/[id]/route.ts` | 69 | Enrich job detail | Auth user | ACTIVE |
| `app/api/mobile/v2/jobs/route.ts` | 205 | Resolve category IDs | Auth user | ACTIVE |
| `app/api/mobile/v2/service-templates/route.ts` | 30 | Include templateJob | Public | ACTIVE |
| `app/api/mobile/job-categories/[id]/route.ts` | 10 | Include jobs in category | Public | ACTIVE |
| `app/api/mobile/job-categories/route.ts` | 19 | Include jobs in categories | Public | ACTIVE |
| `app/api/mobile/service-categories/route.ts` | 12 | Include jobs | Public | ACTIVE |
| `app/api/admin/jobs/route.ts` | 80 | Resolve category names | Admin | ACTIVE |
| `app/api/seasonal-offers/route.ts` | 19 | Include templateJob | Public/Admin | ACTIVE |
| `app/api/mobile/seasonal-offers/route.ts` | 15 | Include templateJob | Public | ACTIVE |

### WRITE — Seed/Upsert (9 sites — all lib/seed, no runtime writers)

| File | Line | Purpose | Status |
|---|---|---|---|
| `lib/v2-job-categories.ts` | 403 | Auto-seed on first call | ACTIVE |
| `prisma/seed-job-section.ts` | 404 | Dev seed | ACTIVE |
| `prisma/seed-smart-templates.ts` | 434,438 | Dev seed references | ACTIVE |
| `prisma/seed-new-menu-categories.ts` | 71,73,121,123 | Dev seed | ACTIVE |
| `prisma/seed-taskers.ts` | 44 | Dev seed references | ACTIVE |

**Total: 31 call sites (22 read, 9 seed)**

---

## SERVICETEMPLATE — Route/Caller Graph

| File | Line | Operation | Purpose | Actor | Status |
|---|---|---|---|---|---|
| `lib/v2-job-categories.ts` | 438 | UPSERT | Auto-seed on first call | System | ACTIVE |
| `lib/smart-pricing.ts` | 85 | READ | Smart price estimate | System | ACTIVE |
| `app/api/mobile/v2/jobs/[id]/route.ts` | 70 | READ | Enrich job detail | Auth user | ACTIVE |
| `app/api/mobile/v2/service-templates/route.ts` | 26 | READ | List templates for booking wizard | Public | ACTIVE |
| `app/api/mobile/v2/jobs/route.ts` | 84 | WRITE (via MarketplaceJob) | Store serviceTemplateId FK | Auth user | ACTIVE |

**Total: 9 call sites**

---

## OFFERTEMPLATE — Route/Caller Graph

| File | Line | Operation | Purpose | Actor | Status |
|---|---|---|---|---|---|
| `app/api/seed/test-data/route.ts` | 241,261,534 | READ+CREATE | Seed test data | Admin | ACTIVE |
| `lib/offer-matcher.ts` | 13,97,159 | READ (via include) | Template data for matching/notifications | System | ACTIVE |

**Total: 8 call sites**

---

## OFFERBOOKING — Route/Caller Graph

| File | Line | Operation | Purpose | Actor | Status |
|---|---|---|---|---|---|
| `lib/offer-matcher.ts` | 11,57,102,109,128,151,156 | READ+UPDATE | Full offer matching lifecycle | System | ACTIVE |

**Total: 9 call sites**

---

## FLASHOFFER — Route/Caller Graph

| File | Line | Operation | Purpose | Actor | Status |
|---|---|---|---|---|---|
| `app/api/flash-offers/route.ts` | 7 | READ | List active flash offers | Public | ACTIVE |
| `app/api/flash-offers/route.ts` | 42,48 | READ+CREATE | Create flash offer | Admin | ACTIVE |
| `app/api/flash-offers/route.ts` | 105 | UPDATE | Update flash offer | Admin | ACTIVE |
| `app/api/flash-offers/route.ts` | 131 | DELETE | Delete flash offer | Admin | ACTIVE |
| `app/api/flash-offers/claim/route.ts` | 13 | UPDATE (increment) | Claim offer | Public (NO AUTH) | ACTIVE |
| `components/ui/FlashOfferBanner.tsx` | 99 | READ (HTTP) | Web banner display | Public | ACTIVE |
| `components/ui/FlashOfferSplash.tsx` | 49 | READ (HTTP) | Web splash display | Public | ACTIVE |

**Total: 9 call sites**

---

## JOBESCROW — Route/Caller Graph

**26 call sites** across escrow, release, refund, complete, cash-payment, share-address, admin escrow, admin summary, cron escrow-release, cron daily-maintenance, select-quote, seed.

Key financial flows:
- CREATE: select-quote (PENDING_PAYMENT), escrow route (PROTECTED)
- UPDATE: complete (RELEASED), release-escrow (RELEASED), refund (REFUNDED), cash-payment (RELEASED), admin force-release/refund, cron auto-release, cron daily-maintenance (CANCELLED)

---

## PROVIDERWALLET — Route/Caller Graph

**15 call sites** across release-escrow, complete, cash-payment, admin escrow, wallet route, dashboard, admin financial wallets, fraud-detection, cron escrow-release, seed.

Key flows:
- UPSERT (credit): release-escrow, complete, cash-payment, admin force-release, cron auto-release
- READ: wallet view, admin summary, dashboard aggregate
- UPDATE: freeze/unfreeze (admin), fraud auto-freeze

---

## CUSTOMERWALLET — Route/Caller Graph

**14 call sites** across escrow deposit, refund, wallet route, admin escrow, admin financial wallets, property boost, seed.

Key flows:
- UPDATE (debit): escrow deposit, withdrawal, property boost
- UPDATE (credit): refund, admin force-refund
- READ: wallet view, balance checks

---

## WALLETTRANSACTION — Route/Caller Graph

**17 call sites** — created on every wallet movement (escrow deposit/release/refund, commission settlement, withdrawal). Read for transaction history, fraud detection, admin financial view.

---

## WEEKLYSETTLEMENT — Route/Caller Graph

**18 call sites** across dashboard, admin commission, admin financial commission, mxid helper, seed.

Key flows:
- UPSERT: create-or-update weekly settlement
- UPDATE: mark PAID/OVERDUE/SUSPENDED/UNSUSPEND
- READ: summary stats, list with filters

---

## COMMISSIONPAYMENT — Route/Caller Graph

**8 call sites** across admin commission, admin commission payments, mobile earnings (provider + company).

Key flows:
- CREATE: payment reference generation
- UPDATE: CONFIRM payment → settlement PAID
- READ: list pending, search by reference

---

## INVOICE — Route/Caller Graph

| File | Line | Operation | Purpose | Actor | Status |
|---|---|---|---|---|---|
| `app/api/invoices/route.ts` | 45,81 | READ+CREATE | List/create invoices | Admin | ACTIVE |
| `app/api/invoices/[id]/route.ts` | 15,53,65,110 | READ+UPDATE | Detail/update/soft-delete | Admin | ACTIVE |
| `app/api/invoices/[id]/pdf/route.ts` | 16 | READ | PDF generation | Admin | ACTIVE |
| `app/api/bookings/[id]/invoice/route.ts` | 44 | CREATE | Create from booking | Admin | ACTIVE |
| `app/api/bookings/[id]/route.ts` | 103 | CREATE | Auto-create on COMPLETED | Admin | ACTIVE |

**Total: 5 call sites**

---

## DISPUTE — Route/Caller Graph

| File | Line | Operation | Purpose | Actor | Status |
|---|---|---|---|---|---|
| `app/api/mobile/disputes/route.ts` | 26,65 | CREATE+READ | Create/list disputes | User | ACTIVE |
| `app/api/mobile/disputes/[id]/route.ts` | 12 | READ | Dispute detail | User | ACTIVE |
| `app/api/admin/disputes/route.ts` | 23,47,87,92 | READ+UPDATE | Admin manage disputes | Admin | ACTIVE |
| `lib/fraud-detection.ts` | 168 | READ | Dispute abuse check | System | ACTIVE |

**Total: 8 call sites**

---

## REVIEW SYSTEM — Route/Caller Graph

### Review (V1 service reviews)
| File | Operation | Purpose | Actor | Status |
|---|---|---|---|---|
| `app/api/reviews/route.ts` | READ+CREATE | List/submit service reviews | Public (NO AUTH) | ACTIVE |
| `app/api/reviews/[id]/route.ts` | UPDATE+DELETE | Moderate/delete reviews | Admin | ACTIVE |

### TaskerReview
| File | Operation | Purpose | Actor | Status |
|---|---|---|---|---|
| `app/api/mobile/taskers/[id]/reviews/route.ts` | READ | List tasker reviews | Auth user | ACTIVE |
| `lib/reputation-engine.ts` | READ | Reputation calculation | System | ACTIVE |

### JobReview (V2)
| File | Operation | Purpose | Actor | Status |
|---|---|---|---|---|
| `app/api/mobile/v2/jobs/[id]/reviews/route.ts` | READ+CREATE | Customer reviews provider | Customer | ACTIVE |
| `app/api/mobile/v2/jobs/[id]/route.ts` | READ | Job detail includes reviews | Auth user | ACTIVE |
| `lib/trust-engine.ts` | READ | Customer trust calculation | System | ACTIVE |
| `lib/quality-engine.ts` | READ | Provider quality calculation | System | ACTIVE |
| `lib/bi-engine.ts` | READ | BI average provider rating | System | ACTIVE |

### ProviderReview (V2)
| File | Operation | Purpose | Actor | Status |
|---|---|---|---|---|
| `app/api/mobile/v2/jobs/[id]/reviews/route.ts` | READ+CREATE | Provider reviews customer | Provider | ACTIVE |
| `lib/trust-engine.ts` | READ | Customer trust calculation | System | ACTIVE |

---

## CONVERSATION/MESSAGE — Route/Caller Graph

| File | Operation | Purpose | Actor | Status |
|---|---|---|---|---|
| `app/api/mobile/conversations/route.ts` | READ+CREATE | List/create conversations | Auth user | ACTIVE |
| `app/api/mobile/conversations/[id]/route.ts` | READ+UPDATE | Get detail, mark read | Auth user | ACTIVE |
| `app/api/mobile/conversations/[id]/messages/route.ts` | READ+CREATE+UPDATE | Send/list messages, rate limit | Auth user | ACTIVE |
| `app/api/mobile/v2/jobs/route.ts` | READ+CREATE | Auto-create for targeted job | Customer | ACTIVE |
| `app/api/properties/[id]/inquiry/route.ts` | READ+CREATE+UPDATE | Property inquiry | Web user | ACTIVE |
| `lib/fraud-detection.ts` | READ | Chat fraud scanning | System | ACTIVE |

---

## CRON JOBS — Marketplace Model Touches

| Cron | Models | Operations | Purpose |
|---|---|---|---|
| `matching-waves` | MarketplaceJob, JobMatchQueue | READ+UPDATE | Wave-based tasker notification escalation |
| `job-response-escalation` | MarketplaceJob, JobQuote, AdminAlert | READ+UPDATE | Escalate overdue jobs to admin |
| `daily-maintenance` | User, JobEscrow, JobQuote, MarketplaceJob, Payout | READ+UPDATE | Cancel stale escrows, fail stale payouts |
| `escrow-release` | JobEscrow, MarketplaceJob, ProviderWallet, WalletTransaction | READ+UPDATE+CREATE | Auto-release escrow after timeout |
| `pricing-train` | MarketplaceJob, PricingModel, PricingCache | READ+UPDATE+DELETE | ML pricing model training |
| `re-engagement` | MarketplaceJob, JobQuote, Notification | READ+CREATE | Re-engage customers with stale jobs |
| `reputation` | TaskerProfile, Assignment | READ+UPDATE | Recalculate provider reputation |
| `learn` | MarketplaceJob, PricingModel, LearningModelVersion | READ+CREATE | Full ML learning cycle |
| `offer-timeouts` | OfferMatchQueue | READ+UPDATE | Expire timed-out offer candidates |

---

## SUMMARY STATISTICS

| Model | Total Callers | CREATE | READ | UPDATE | DELETE | UPSERT |
|---|---|---|---|---|---|---|
| MarketplaceJob | 67 | 3 | 46 | 18 | 0 | 0 |
| Booking | 18 | 3 | 11 | 4 | 1 | 0 |
| JobPosting | 17 | 3 | 11 | 2 | 1 | 0 |
| JobQuote | 22 | 1 | 17 | 4 | 0 | 0 |
| JobEscrow | 26 | 2 | 10 | 14 | 0 | 0 |
| ProviderWallet | 15 | 0 | 8 | 7 | 0 | 5 |
| CustomerWallet | 14 | 0 | 7 | 7 | 0 | 0 |
| WalletTransaction | 17 | 9 | 5 | 3 | 0 | 0 |
| WeeklySettlement | 18 | 0 | 12 | 6 | 0 | 2 |
| CommissionPayment | 8 | 1 | 5 | 2 | 0 | 0 |
| CommissionSettlement | 6 | 2 | 2 | 2 | 0 | 0 |
| Invoice | 5 | 2 | 3 | 2 | 1 | 0 |
| Dispute | 8 | 1 | 4 | 3 | 0 | 0 |
| Review | 4 | 1 | 1 | 1 | 1 | 0 |
| JobReview | 6 | 1 | 5 | 0 | 0 | 0 |
| ProviderReview | 4 | 1 | 3 | 0 | 0 | 0 |
| TaskerReview | 2 | 0 | 2 | 0 | 0 | 0 |
| TemplateJob | 31 | 0 | 22 | 0 | 0 | 9 |
| ServiceTemplate | 9 | 0 | 4 | 0 | 0 | 1 |
| JobCategory | 32 | 0 | 24 | 0 | 0 | 8 |
| OfferTemplate | 8 | 1 | 4 | 2 | 1 | 0 |
| OfferBooking | 9 | 0 | 3 | 6 | 0 | 0 |
| FlashOffer | 9 | 1 | 4 | 2 | 1 | 0 |
| JobWorkspace | 12 | 0 | 6 | 5 | 0 | 1 |
| JobOtp | 4 | 0 | 2 | 2 | 0 | 1 |
| JobMatchQueue | 10 | 2 | 3 | 5 | 2 | 0 |
| OfferMatchQueue | 7 | 1 | 1 | 4 | 1 | 0 |
| Conversation | 9 | 3 | 4 | 2 | 0 | 0 |
| Message | 7 | 2 | 3 | 2 | 0 | 0 |
| TaskerProfile | 27 | 2 | 16 | 9 | 0 | 0 |
| CompanyProfile | 24 | 1 | 15 | 8 | 0 | 1 |
| Bid | 3 | 1 | 2 | 0 | 0 | 0 |
| Assignment | 6 | 0 | 5 | 1 | 0 | 0 |
| Payout | 3 | 0 | 2 | 1 | 0 | 0 |
| TaskerSkill | 2 | 0 | 2 | 0 | 0 | 0 |
| TeamMember | 4 | 1 | 2 | 0 | 1 | 0 |
| TeamInvite | 3 | 1 | 1 | 2 | 0 | 0 |
| Contract | 4 | 0 | 3 | 1 | 0 | 0 |
| CompanySubscription | 2 | 1 | 0 | 1 | 0 | 0 |

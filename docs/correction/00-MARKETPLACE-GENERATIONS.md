# MaintainEX Marketplace Generations Audit

## Five Parallel Job Systems

### System 1: Legacy Booking (Gen 0)
- **Status:** Active on web admin, legacy on mobile
- **Models:** Booking, Service, Category, Branch
- **API:** `/api/bookings/*`, `/api/mobile/bookings/*`
- **Payment:** None (offline)
- **Matching:** Manual (admin)
- **Reviews:** None connected
- **Production:** Web admin panel

### System 2: Offer/Flash (Gen 0.5)
- **Status:** Built but not wired into mobile flow
- **Models:** OfferTemplate, OfferBooking, OfferEnrollment, OfferMatchQueue, FlashOffer, SeasonalOffer
- **Engine:** `lib/offer-matcher.ts`
- **Payment:** None (no escrow integration)
- **Mobile:** Components exist, but TODO comment reveals endpoints never built
- **Production:** FlashOffers used for landing page promotions only

### System 3: JobPosting V1 (Gen 1)
- **Status:** Deprecated (kept for admin data visibility)
- **Models:** JobPosting, Bid, Assignment, Dispute, TaskerReview
- **API:** `/api/mobile/jobs/*`
- **Engine:** `lib/job-matcher.ts` (wave-based)
- **Payment:** None
- **Reviews:** TaskerReview (one-directional)
- **Production:** Admin panel merges V1+V2 for historical data

### System 4: MarketplaceJob V2 (Gen 2) — PRIMARY
- **Status:** Active production system
- **Models:** MarketplaceJob, JobQuote, JobEscrow, JobWorkspace, JobOtp, JobMatchQueue, CommissionSettlement
- **API:** `/api/mobile/v2/jobs/*` (24 routes)
- **Engines:** `lib/job-blast.ts`, `lib/matching-engine.ts`, `lib/job-matching.ts`
- **Payment:** Full escrow + wallet + commission
- **Matching:** Uber-style blast + wave escalation
- **Reviews:** Bidirectional (JobReview + ProviderReview)
- **KYC:** Quotes require `identityStatus === VERIFIED`
- **OTP:** Job start verification
- **Production:** 38+ jobs, primary mobile app system

### System 5: TemplateJobs (Catalog Layer)
- **Status:** Active data layer feeding V2
- **Models:** JobCategory, TemplateJob, ServiceTemplate, TaskerSkill, CustomJobRequest
- **API:** `/api/mobile/template-jobs/*`, `/api/mobile/v2/service-templates`
- **Feeds INTO:** System 3 (TaskerSkill) and System 4 (MarketplaceJob references)
- **Production:** Drives V2 job creation wizard

## Comparison Matrix

| Dimension | System 1 | System 2 | System 3 | System 4 | System 5 |
|---|---|---|---|---|---|
| Core Model | Booking | OfferBooking | JobPosting | MarketplaceJob | TemplateJob |
| Payment | None | None | None | Full Escrow+Wallet | N/A |
| Matching | Manual | Enrollment | Wave | Blast+Scoring | N/A |
| Reviews | None | None | TaskerReview | Bidirectional | N/A |
| OTP Verify | No | No | No | Yes | N/A |
| KYC Gate | No | No | No | Yes | No |
| Active | Web only | Promos only | Deprecated | PRIMARY | Data layer |

## Key Architectural Observations

1. **V2 is the clear winner** — only system with full payment, reviews, OTP, KYC, AI pricing
2. **V1 is dead code** — kept only for admin data visibility
3. **Offers are architecturally complete but unwired** — matching engine, cron, components exist but no API endpoints
4. **Legacy Booking persists for web admin** — no wallet or matching integration
5. **Templates are the catalog backbone** — feed both V1 and V2
6. **Three matching engines coexist** — offer-matcher, job-matcher (waves), job-blast (V2)
7. **`JobMatchQueue` is shared** between V1 and V2 — potential for confusion

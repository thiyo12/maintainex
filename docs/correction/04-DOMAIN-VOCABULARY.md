# 04-DOMAIN-VOCABULARY.md — Canonical Domain Vocabulary

> Generated: Phase 4A.7 — Freeze Domain Vocabulary
> Scope: Actual business meaning of every marketplace concept, mapped to existing models

---

## SERVICE CATALOG VOCABULARY

### Category (Model: `Category`)
**Actual meaning:** V1 service taxonomy. Parent container for Service records. Used by the web admin panel and V1 booking flow.
**Production:** 17 rows
**Relationship:** Category → Service (one-to-many)
**Source of truth:** V1 legacy catalog. NOT used by V2 mobile app.

### JobCategory (Model: `JobCategory`)
**Actual meaning:** V2 job taxonomy. Parent container for TemplateJob and ServiceTemplate records. Used by the V2 mobile app for job browsing, matching, and provider skills.
**Production:** 24 rows
**Relationship:** JobCategory → TemplateJob (one-to-many), JobCategory → ServiceTemplate (one-to-many)
**Source of truth:** V2 canonical catalog. Auto-seeded from `lib/v2-job-categories.ts`.

### Service (Model: `Service`)
**Actual meaning:** V1 individual service offering within a Category. Has price, duration, features. Used for V1 booking flow and web admin service management.
**Production:** 77 rows
**Relationship:** Service → Category (many-to-one), Service → Booking (one-to-many), Service → Review (one-to-many)
**Source of truth:** V1 legacy. Admin-managed via `/api/services`.

### TemplateJob (Model: `TemplateJob`)
**Actual meaning:** V2 individual job type within a JobCategory. Defines a reusable job template with name, description, what's included, typical duration, price range, and country availability. Used as the catalog entry point for customer job creation and provider skill matching.
**Production:** 239 rows
**Relationship:** TemplateJob → JobCategory (many-to-one), TemplateJob → TaskerSkill (one-to-many), TemplateJob → Booking (one-to-many), TemplateJob → SeasonalOfferJob (one-to-many), TemplateJob → ServiceTemplate (one-to-many)
**Source of truth:** V2 canonical catalog. Auto-seeded. READ-ONLY at runtime.

### ServiceTemplate (Model: `ServiceTemplate`)
**Actual meaning:** V2 smart booking wizard configuration for a TemplateJob. Contains structured question/answer JSON (questionsJson) used by the smart pricing engine to compute dynamic price estimates. Also stores default duration, price range, currency, and country.
**Production:** 239 rows (1:1 with TemplateJob)
**Relationship:** ServiceTemplate → JobCategory (many-to-one, cascade delete), ServiceTemplate → TemplateJob (many-to-one optional, set null)
**Source of truth:** V2 smart pricing config. Auto-seeded from `lib/v2-job-categories.ts`. READ-ONLY at runtime.

### TemplateJob vs ServiceTemplate Duplication Analysis

**Finding: They are NOT duplicated. They have genuinely different responsibilities.**

| Aspect | TemplateJob | ServiceTemplate |
|---|---|---|
| Purpose | Job type catalog entry | Smart booking wizard config |
| Content | Name, description, what's included, duration, price range | Question/answer JSON, price effects, default pricing |
| Used by | Customer browsing, provider skills, matching | Smart pricing engine, booking wizard |
| Cardinality | 1 per job type | 0 or 1 per TemplateJob (optional FK) |
| Runtime writes | NONE (seed only) | NONE (seed only) |
| Production rows | 239 | 239 |

**However**, the 1:1 relationship and identical row count suggests they were seeded together. The `templateJobId` FK on ServiceTemplate creates an explicit link. They serve different purposes but are tightly coupled.

**Recommendation:** Keep both models. ServiceTemplate is the "smart config" layer on top of TemplateJob. They are not duplicates — they are complementary layers.

---

## JOB VOCABULARY

### Job (Model: `MarketplaceJob`)
**Actual meaning:** A customer's actual work request posted to the marketplace. This is the canonical transactional entity. A Job captures what the customer needs done, where, when, and how much they're willing to pay. It triggers the full marketplace lifecycle: matching → quoting → escrow → execution → completion → payment → review.
**Production:** 36 rows
**Lifecycle:** OPEN → QUOTE_ACCEPTED → IN_PROGRESS → COMPLETED/CANCELLED
**Source of truth:** V2 canonical job entity.

### Quote (Model: `JobQuote`)
**Actual meaning:** A provider's or company's commercial proposal for a Job. Contains price, estimated completion time, message, and attachments. One Quote per provider per job. Customer selects one Quote, which triggers escrow creation.
**Production:** 7 rows
**Lifecycle:** PENDING → ACCEPTED/REJECTED/WITHDRAWN
**Source of truth:** V2 canonical quote entity.

### Engagement (Concept — no dedicated model)
**Actual meaning:** The accepted customer-provider commercial relationship. Currently represented by:
- The ACCEPTED JobQuote (links provider to job)
- The JobWorkspace (tracks progress)
- The JobEscrow (holds funds)
- The Job.status = IN_PROGRESS

**There is no single "Engagement" model.** The engagement is the combination of Quote acceptance + Workspace creation + Escrow funding.

### Assignment (Model: `Assignment`)
**Actual meaning:** V1 legacy. A specific individual worker assigned to execute a V1 JobPosting. Currently 0 rows — the V1 bid+assignment flow appears unused in practice.
**Production:** 0 rows
**Lifecycle:** ASSIGNED → EN_ROUTE → IN_PROGRESS → COMPLETED/CANCELLED
**Source of truth:** V1 legacy. Replaced by JobQuote acceptance + JobWorkspace in V2.

### Booking (Model: `Booking`)
**Actual meaning:** V1 legacy. A customer's service booking for a specific Service on a specific date/time. Links to a Service, optionally to a TaskerProfile, and optionally to a TemplateJob. Used for the V1 mobile app booking flow and web admin booking management. Auto-creates an Invoice when status reaches COMPLETED.
**Production:** 31 rows
**Lifecycle:** PENDING → CONFIRMED → IN_PROGRESS → COMPLETED/CANCELLED → INVOICED
**Source of truth:** V1 legacy. Still active in V1 mobile app and web admin.

### JobPosting (Model: `JobPosting`)
**Actual meaning:** V1 legacy. A customer's job post to the marketplace. Supports Bid-based provider selection (not Quote-based). Currently 5 rows with 0 Bids and 0 Assignments — effectively unused.
**Production:** 5 rows
**Lifecycle:** OPEN → ASSIGNED → IN_PROGRESS → COMPLETED/CANCELLED
**Source of truth:** V1 legacy. Disputes reference JobPosting.

---

## OFFER/FLASH VOCABULARY

### OfferTemplate (Model: `OfferTemplate`)
**Actual meaning:** A catalog/marketing definition for an "Offer Program" service. Defines a fixed-price service with category, title, description, price, scope notes, availability, photo, and featured status. Customers can browse and book these predefined offers. Taskers can enroll to fulfill offer bookings.
**Production:** 12 rows
**Lifecycle:** Created by admin → Taskers enroll → Customers book → System matches tasker
**Source of truth:** V1 offer program. Active in code but OfferBooking=0, OfferEnrollment=0.

### FlashOffer (Model: `FlashOffer`)
**Actual meaning:** A time-limited promotional discount displayed on the web landing page. NOT related to urgency or job matching. Purely a marketing/promotional tool with discount codes, coupon tracking, and claim limits.
**Production:** 2 rows
**Lifecycle:** Created by admin → Displayed on landing page → Users claim → Expires
**Source of truth:** V1 promotional system. Displayed via FlashOfferBanner and FlashOfferSplash components.

**FlashOffer is NOT urgency.** It is a promotional discount banner. Urgency is handled by `MarketplaceJob.urgency` field (normal/urgent/emergency).

### OfferBooking (Model: `OfferBooking`)
**Actual meaning:** A customer's booking of an OfferTemplate. Triggers the instant-offer matching system (OfferMatcher) which finds enrolled taskers by distance and composite score.
**Production:** 0 rows
**Source of truth:** V2 offer flow. Active code but no production data.

### OfferEnrollment (Model: `OfferEnrollment`)
**Actual meaning:** A tasker's enrollment in an OfferTemplate, indicating they are available to fulfill offer bookings for that service.
**Production:** 0 rows
**Source of truth:** V2 offer flow. Active code but no production data.

---

## FINANCIAL VOCABULARY

### Escrow (Model: `JobEscrow`)
**Actual meaning:** Customer funds held in trust until job completion. Created when customer selects a quote (PENDING_PAYMENT) and funded from customer wallet (PROTECTED). Released to provider on completion (RELEASED), refunded on cancellation (REFUNDED), or held during dispute (ON_HOLD). Supports both CARD and CASH payment methods.
**Production:** 11 rows
**Source of truth:** V2 canonical financial entity.

### Commission (Model: `CommissionSettlement`)
**Actual meaning:** Platform commission deducted from escrow release. Calculated as a percentage of job amount (default 10%). Created on cash payment confirmation. Settled by admin.
**Production:** 10 rows
**Source of truth:** V2 canonical commission entity.

### Wallet (Model: `ProviderWallet` / `CustomerWallet`)
**Actual meaning:**
- **ProviderWallet:** Provider's earnings balance. Credited on escrow release (minus commission). Used for payouts.
- **CustomerWallet:** Customer's balance for escrow deposits and refunds.
**Production:** ProviderWallet=27, CustomerWallet=46
**Source of truth:** V2 canonical wallet entities. **Float money P0 issue — these use Float fields.**

### WalletTransaction (Model: `WalletTransaction`)
**Actual meaning:** Immutable audit trail for every wallet balance change. Records type (CREDIT/DEBIT), amount, balance before/after, reference, and status.
**Production:** 24 rows
**Source of truth:** V2 canonical transaction log.

### WeeklySettlement (Model: `WeeklySettlement`)
**Actual meaning:** Weekly commission tracking per provider. Aggregates total earnings and commission owed for a calendar week. Status: PENDING → PAID/OVERDUE/SUSPENDED.
**Production:** 10 rows
**Source of truth:** V2 canonical settlement entity.

### CommissionPayment (Model: `CommissionPayment`)
**Actual meaning:** A payment reference record for commission settlement. Admin creates a payment reference, provider pays, admin confirms. Links to WeeklySettlement.
**Production:** 8 rows
**Source of truth:** V2 canonical payment entity.

### Invoice (Model: `Invoice`)
**Actual meaning:** V1 billing document. Auto-created from Booking on COMPLETED status. Contains line items, tax, total, payment status. Used by web admin billing management.
**Production:** 4 rows
**Source of truth:** V1 legacy. Only triggered by Booking status change.

### Dispute (Model: `Dispute`)
**Actual meaning:** V1 legacy dispute raised by customer or provider on a JobPosting. Contains reason, description, resolution, and status. Admin manages resolution.
**Production:** 5 rows
**Source of truth:** V1 legacy. References JobPosting (not MarketplaceJob).

---

## REVIEW VOCABULARY

### Review (Model: `Review`)
**Actual meaning:** V1 service review. Customer reviews a Service (not a provider). Contains rating, comment, status (PENDING/APPROVED/REJECTED). Unauthenticated submission with fixed guest user.
**Production:** 10 rows
**Source of truth:** V1 legacy. Web admin review management.

### TaskerReview (Model: `TaskerReview`)
**Actual meaning:** V2 tasker review. Customer reviews a TaskerProfile. Used by reputation engine for composite score calculation.
**Production:** 0 rows
**Source of truth:** V2 canonical tasker review entity.

### JobReview (Model: `JobReview`)
**Actual meaning:** V2 customer review of provider after job completion. Contains quality, communication, timeliness scores plus comment. Used by trust engine and quality engine.
**Production:** 0 rows
**Source of truth:** V2 canonical customer→provider review entity.

### ProviderReview (Model: `ProviderReview`)
**Actual meaning:** V2 provider review of customer after job completion. Contains cooperation, communication, overall experience scores plus comment. Used by trust engine.
**Production:** 0 rows
**Source of truth:** V2 canonical provider→customer review entity.

---

## PROVIDER VOCABULARY

### TaskerProfile (Model: `TaskerProfile`)
**Actual meaning:** An individual service provider's marketplace profile. Contains verification status, bio, hourly rate, skills, service areas, rating, completed jobs count, verification badges, location, composite score, penalty points, completion rate, and response speed metrics.
**Production:** 22 rows
**Source of truth:** V2 canonical individual provider entity.

### CompanyProfile (Model: `CompanyProfile`)
**Actual meaning:** A company provider's marketplace profile. Contains company name, registration, tax ID, description, services, service areas, rating, completed projects, verification status, staff count, commission rate, subscription status, and location.
**Production:** 9 rows
**Source of truth:** V2 canonical company provider entity.

### TeamMember (Model: `TeamMember`)
**Actual meaning:** An individual worker belonging to a CompanyProfile. Links to a User account. Tracks online status, rating, completed jobs, and skills.
**Production:** 0 rows
**Source of truth:** V2 company team management.

---

## MATCHING VOCABULARY

### JobMatchQueue (Model: `JobMatchQueue`)
**Actual meaning:** Wave-based matching queue for MarketplaceJob. Stores ranked candidates (taskers) with scores, notification status, and wave number. Used by blast notifications and wave escalation cron.
**Production:** 0 rows (ephemeral — cleared and rebuilt on each match cycle)
**Source of truth:** V2 canonical matching entity.

### OfferMatchQueue (Model: `OfferMatchQueue`)
**Actual meaning:** Instant-offer matching queue for OfferBooking. Stores ranked candidates (enrolled taskers) with scores, notification status, and expiry. Used by offer-matcher and offer-timeouts cron.
**Production:** 0 rows (ephemeral)
**Source of truth:** V2 offer matching entity.

---

## MESSAGING VOCABULARY

### Conversation (Model: `Conversation`)
**Actual meaning:** A messaging thread between two or more users. Optionally scoped to a jobId. Supports progressive address sharing (address fields only revealed after escrow deposit).
**Production:** 0 rows
**Source of truth:** V2 canonical messaging entity.

### Message (Model: `Message`)
**Actual meaning:** An individual message within a Conversation. Contains sender, text (fraud-scanned), and read status.
**Production:** 0 rows
**Source of truth:** V2 canonical message entity.

---

## JOB MODE MAPPING

### BOOK_NOW
**Current implementation:** OfferTemplate + OfferBooking + OfferMatcher
**Current route:** `/api/mobile/quick-bookings` → creates Booking with templateJobId
**Current status fields:** OfferBooking.status (pending/finding/accepted/in_progress/completed/no_tasker_available/cancelled)
**Production data:** OfferTemplate=12, OfferBooking=0
**Canonical migration candidate:** Consider merging with MarketplaceJob using `budgetType: 'FIXED'` + immediate matching

### QUOTE
**Current implementation:** MarketplaceJob + JobQuote + JobMatchQueue
**Current route:** `/api/mobile/v2/jobs` (POST) → `/api/mobile/v2/quotes` (POST) → select-quote
**Current status fields:** MarketplaceJob.status (OPEN/QUOTE_ACCEPTED/IN_PROGRESS/COMPLETED/CANCELLED), JobQuote.status (PENDING/ACCEPTED/REJECTED/WITHDRAWN)
**Production data:** MarketplaceJob=36, JobQuote=7
**Canonical migration candidate:** THIS IS THE PRIMARY FLOW — already canonical

### PROJECT
**Current implementation:** Contract model (company-specific, separate from marketplace jobs)
**Current route:** `/api/mobile/company/contracts`
**Current status fields:** Contract.status, Contract.progress
**Production data:** Unknown (not queried in row counts)
**Canonical migration candidate:** Keep separate — Contract is company-specific, not marketplace

### RECURRING
**Current implementation:** NONE
**Current route:** NONE
**Current status fields:** NONE
**Production data:** NONE
**Canonical migration candidate:** New feature — add to MarketplaceJob or create recurring_job table

### URGENT
**Current implementation:** MarketplaceJob.urgency field (normal/urgent/emergency)
**Current route:** `/api/mobile/v2/jobs` (urgency field in POST body)
**Current status fields:** MarketplaceJob.urgency, MarketplaceJob.responseDeadline
**Production data:** Unknown distribution
**Canonical migration candidate:** ALREADY IN MarketplaceJob. Do NOT confuse with FlashOffer (promotional, not urgency).

# 04-CANONICAL-JOB-EVALUATION.md — MarketplaceJob vs Booking vs JobPosting

> Generated: Phase 4A.6 — Canonical Job Entity Evaluation
> Scope: Head-to-head comparison of all three job models as potential canonical transactional job entity

---

## PRODUCTION SNAPSHOT

| Metric | MarketplaceJob | Booking | JobPosting |
|---|---|---|---|
| Rows | 36 | 31 | 5 |
| Active writers | 20 | 6 | 6 |
| Active readers | 32 | 12 | 9 |
| Total callers | 67 | 18 | 17 |
| Financial flows | YES (escrow, wallet, commission) | YES (Invoice auto-create) | NO |
| Mobile app support | YES (V2 mobile app) | YES (V1 mobile app) | YES (V1 mobile app) |
| Active status | PRIMARY | LEGACY | LEGACY |

---

## FEATURE COMPARISON

### 1. Customer Ownership

| Capability | MarketplaceJob | Booking | JobPosting |
|---|---|---|---|
| Customer ID field | `customerId` (required) | `userId` (optional) | `customerId` (required) |
| Customer relation | Scalar FK only (no Prisma relation) | Prisma @relation to User | Prisma @relation to User |
| Ownership enforcement | IDOR check in route handler | IDOR check in route handler | IDOR check in route handler |
| Verdict | ✅ SUPPORTED | ⚠️ SUPPORTED (userId optional) | ✅ SUPPORTED |

### 2. Provider/Company Support

| Capability | MarketplaceJob | Booking | JobPosting |
|---|---|---|---|
| Provider assignment | Via JobQuote → accepted provider | `taskerId` field (optional TaskerProfile) | Via Bid → Assignment |
| Company support | YES (JobQuote providerType: INDIVIDUAL/COMPANY) | NO (tasker only) | NO (tasker only) |
| Target tasker | `targetTaskerId` field | N/A | N/A |
| Multiple providers | YES (multiple quotes, one accepted) | NO (single tasker) | YES (multiple bids) |
| Verdict | ✅ FULL SUPPORT | ⚠️ SINGLE PROVIDER | ⚠️ MULTI-BID, NO COMPANY |

### 3. Category/Service Relationship

| Capability | MarketplaceJob | Booking | JobPosting |
|---|---|---|---|
| Category | `categoryId` → JobCategory | `serviceId` → Service → Category | `category` (string, no FK) |
| Service template | `serviceTemplateId` → ServiceTemplate | `serviceId` → Service | N/A |
| Template job | `templateJobId` → TemplateJob | `templateJobId` → TemplateJob | N/A |
| Category relation | Scalar FK to JobCategory | Prisma @relation to Service | String only |
| Verdict | ✅ RICH | ✅ RICH (Service-based) | ⚠️ STRING ONLY |

### 4. Title/Description

| Capability | MarketplaceJob | Booking | JobPosting |
|---|---|---|---|
| Title | `title` (required) | `name` (optional) | `title` (required) |
| Description | `description` (required) | `notes` (optional) | `description` (required) |
| Verdict | ✅ NAMED | ⚠️ name is optional | ✅ NAMED |

### 5. Location

| Capability | MarketplaceJob | Booking | JobPosting |
|---|---|---|---|
| Address fields | `addressStreet`, `addressBuilding`, `addressApartment`, `addressLandmark` | `address` (single string) | `location` (single string) |
| Lat/Lng | `latitude`, `longitude` | None | `latitude`, `longitude` |
| Area | `areaId` → Area | None | None |
| Postal code | `postalCode` | None | None |
| District/Province | None (uses area) | `district`, `province` | None |
| Country | `countryCode` (default "LK") | `region` (default "LK") | None |
| Address sharing | Progressive: `addressSharedAt` timestamp | Full address on create | Full address on create |
| Verdict | ✅ RICH + PROGRESSIVE | ⚠️ BASIC | ⚠️ BASIC |

### 6. Scheduling

| Capability | MarketplaceJob | Booking | JobPosting |
|---|---|---|---|
| Preferred date | `preferredDate` | `date` (required) | `scheduledDate` |
| Time slot | `preferredTimeSlot` | `timeSlot` (required) | None |
| Time field | None | `time` (optional) | None |
| Verdict | ✅ PREFERRED (flexible) | ✅ REQUIRED (rigid) | ⚠️ OPTIONAL |

### 7. Urgency

| Capability | MarketplaceJob | Booking | JobPosting |
|---|---|---|---|
| Urgency field | `urgency` (normal/urgent/emergency) | None | None |
| Response deadline | `responseDeadline` | None | None |
| Verdict | ✅ BUILT-IN | ❌ NOT SUPPORTED | ❌ NOT SUPPORTED |

### 8. Recurring Support

| Capability | MarketplaceJob | Booking | JobPosting |
|---|---|---|---|
| Recurrence field | None | None | None |
| Recurrence support | NO | NO | NO |
| Verdict | ❌ NOT SUPPORTED | ❌ NOT SUPPORTED | ❌ NOT SUPPORTED |

### 9. Job Mode (BOOK_NOW / QUOTE / PROJECT)

| Capability | MarketplaceJob | Booking | JobPosting |
|---|---|---|---|
| Budget type | `budgetType` (FIXED/HOURLY/NEGOTIABLE/REQUEST_QUOTES) | `totalPrice` (required), `budgetMin/budgetMax` (optional) | `budget` (required) |
| Price mode | Flexible (FIXED, HOURLY, NEGOTIABLE, REQUEST_QUOTES) | Fixed price only | Fixed price only |
| Quote support | YES (JobQuote model) | NO | NO (uses Bid instead) |
| Verdict | ✅ MULTI-MODE | ⚠️ FIXED ONLY | ⚠️ FIXED + BID |

### 10. Attachments

| Capability | MarketplaceJob | Booking | JobPosting |
|---|---|---|---|
| Photos | `photos` (JSON string) | None | None |
| Verdict | ✅ SUPPORTED | ❌ NOT SUPPORTED | ❌ NOT SUPPORTED |

### 11. Workspace

| Capability | MarketplaceJob | Booking | JobPosting |
|---|---|---|---|
| Workspace model | JobWorkspace (dedicated model) | None | None |
| Progress tracking | ACCEPTED → IN_PROGRESS → WAITING_CUSTOMER → COMPLETION_REQUESTED → COMPLETED → DISPUTED | PENDING → CONFIRMED → IN_PROGRESS → COMPLETED → CANCELLED | OPEN → ASSIGNED → IN_PROGRESS → COMPLETED → CANCELLED |
| OTP verification | JobOtp (dedicated model) | None | None |
| Verdict | ✅ RICH | ⚠️ BASIC | ⚠️ BASIC |

### 12. Lifecycle States

| MarketplaceJob | Booking | JobPosting |
|---|---|---|
| OPEN | PENDING | OPEN |
| QUOTE_ACCEPTED | CONFIRMED | ASSIGNED |
| IN_PROGRESS | IN_PROGRESS | IN_PROGRESS |
| COMPLETED | COMPLETED | COMPLETED |
| CANCELLED | CANCELLED | CANCELLED |
| — | INVOICED | — |

MarketplaceJob has 5 states. Booking has 6 (includes INVOICED). JobPosting has 5.

### 13. Escrow Linkage

| Capability | MarketplaceJob | Booking | JobPosting |
|---|---|---|---|
| Escrow model | JobEscrow (11 rows) | None | None |
| Escrow states | PENDING_PAYMENT → PROTECTED → RELEASED/REFUNDED/ON_HOLD | N/A | N/A |
| Payment methods | CARD, CASH | N/A | N/A |
| Auto-release | Cron (48h default) | N/A | N/A |
| Verdict | ✅ FULL ESCROW | ❌ NO ESCROW | ❌ NO ESCROW |

### 14. Settlement Linkage

| Capability | MarketplaceJob | Booking | JobPosting |
|---|---|---|---|
| Commission | CommissionSettlement (10 rows) | N/A | N/A |
| Weekly settlement | WeeklySettlement (10 rows) | N/A | N/A |
| Commission payments | CommissionPayment (8 rows) | N/A | N/A |
| Verdict | ✅ FULL SETTLEMENT | ❌ NO SETTLEMENT | ❌ NO SETTLEMENT |

### 15. Review Linkage

| Capability | MarketplaceJob | Booking | JobPosting |
|---|---|---|---|
| Customer review | JobReview (customer → provider) | Review (service reviews, V1) | None |
| Provider review | ProviderReview (provider → customer) | None | None |
| Tasker review | None (uses TaskerReview via TaskerProfile) | None | None |
| Verdict | ✅ DUAL-SIDED | ⚠️ SINGLE-SIDED (service) | ❌ NO REVIEWS |

### 16. Dispute Linkage

| Capability | MarketplaceJob | Booking | JobPosting |
|---|---|---|---|
| Dispute model | Via complete route (DISPUTE action) | None | Dispute (5 rows, V1) |
| Escrow on hold | YES | N/A | N/A |
| Verdict | ✅ INTEGRATED | ❌ NO DISPUTE | ⚠️ SEPARATE MODEL |

### 17. Notifications

| Capability | MarketplaceJob | Booking | JobPosting |
|---|---|---|---|
| Push notifications | blastJobToTaskers, notifyTaskerAssigned, notifyQuoteSubmitted/Accepted, notifyEscrowDeposited, notifyJobCompleted, notifyPaymentReleased, notifyEscrowTimeout | None from booking route | None |
| In-app notifications | YES (via notifications.ts) | Admin notification on booking create | None |
| Cron notifications | matching-waves, re-engagement, escrow-release, daily-maintenance | None | None |
| Verdict | ✅ RICH | ❌ MINIMAL | ❌ MINIMAL |

### 18. Admin Visibility

| Capability | MarketplaceJob | Booking | JobPosting |
|---|---|---|---|
| Admin job list | `/api/admin/jobs` (unified V1+V2) | `/api/bookings` | `/api/admin/jobs` |
| Admin summary | `/api/mobile/v2/admin/summary` | None | None |
| Admin analytics | `/api/admin/analytics` | Via reports | Via dashboard |
| Admin escrow | `/api/mobile/v2/admin/escrows` | N/A | N/A |
| Admin commission | `/api/admin/commission` | N/A | N/A |
| Verdict | ✅ COMPREHENSIVE | ⚠️ BASIC | ⚠️ BASIC |

### 19. Smart Booking / AI

| Capability | MarketplaceJob | Booking | JobPosting |
|---|---|---|---|
| AI price estimate | `aiEstimateJson` (ML pricing engine) | None | None |
| Smart booking | `smartBookingJson` (answers, estimate, timeSlot, paymentMethod) | None | None |
| Material handling | `materialHandling` (tasker_brings/customer_provides/quote_both) | None | None |
| Workers count | `workersCount` (default 1) | None | None |
| Verdict | ✅ AI-POWERED | ❌ NONE | ❌ NONE |

### 20. Matching/Blitz

| Capability | MarketplaceJob | Booking | JobPosting |
|---|---|---|---|
| Match queue | JobMatchQueue (wave-based) | None | None |
| Blast notifications | job-blast.ts (Uber-style) | None | None |
| Wave escalation | cron/matching-waves | None | None |
| Response escalation | cron/job-response-escalation | None | None |
| Verdict | ✅ UBER-STYLE | ❌ NONE | ❌ NONE |

---

## STRENGTHS/WEAKNESSES SUMMARY

### MarketplaceJob V2

**Strengths:**
- Richest feature set: escrow, settlement, reviews, disputes, workspace, OTP, matching, blast, AI pricing
- Full financial pipeline: wallet → escrow → commission → settlement → payout
- Dual-sided reviews (customer↔provider)
- Uber-style wave-based matching with escalation
- Progressive address sharing
- Smart booking with AI price estimates
- Multi-mode pricing (FIXED/HOURLY/NEGOTIABLE/REQUEST_QUOTES)
- Company + individual provider support
- Active mobile app (V2) and admin panel integration
- 67 total callers — deeply integrated

**Weaknesses:**
- Scalar-only foreign keys (no Prisma relations to User/JobCategory) — by design to avoid modifying existing models
- 36 production rows — relatively new
- Complex state machine (5 job states + 6 workspace states + 4 escrow states + 4 quote states)
- No recurring support
- No project/milestone support (unlike Contract model)

**Missing Capabilities:**
- Recurring jobs
- Multi-phase projects
- Dependency tracking
- File attachment storage (photos field is JSON string)

**Migration Risk: HIGH** — 67 callers, financial flows, deeply integrated

### Booking

**Strengths:**
- Simple, proven model (31 rows)
- Direct Prisma relations to User, Service, Branch, TaskerProfile, TemplateJob
- Auto Invoice creation on COMPLETED
- Branch/region scoping for multi-tenant admin
- Progressive address via district/province

**Weaknesses:**
- Single provider only (taskerId)
- No company support
- No escrow/settlement
- No matching/blitz
- No urgency
- No quote system (fixed price only)
- No workspace/OTP
- No AI pricing
- Limited notifications

**Missing Capabilities:**
- Company providers
- Escrow
- Settlement
- Matching
- Urgency
- Quotes
- Workspace
- OTP
- AI pricing

**Migration Risk: MEDIUM** — 18 callers, 31 rows, financial (Invoice), CRM dependency

### JobPosting

**Strengths:**
- Simple model (5 rows)
- Bid + Assignment support
- Direct Prisma relations to User, TaskerProfile

**Weaknesses:**
- String-only category (no FK)
- No company support
- No escrow/settlement
- No matching/blitz
- No urgency
- No workspace/OTP
- No AI pricing
- No photos/attachments
- Bid = 0 rows (unused in practice)
- Assignment = 0 rows (unused in practice)

**Missing Capabilities:**
- Everything MarketplaceJob has

**Migration Risk: LOW** — 17 callers, 5 rows, no financial flows, but disputes reference JobPosting

---

## FINAL RECOMMENDATION

### **MarketplaceJob V2 suitable as canonical — with additive evolution**

**Rationale:**

1. **MarketplaceJob is the only model with full financial pipeline** — escrow, wallet, commission, settlement. This is the core business value.

2. **MarketplaceJob has 67 callers vs 18 for Booking vs 17 for JobPosting** — it is already the de facto canonical model. Replacing it would be far more disruptive than evolving it.

3. **MarketplaceJob has the richest feature set** — matching, blast, AI pricing, workspace, OTP, dual-sided reviews, progressive address, urgency, multi-mode pricing, company support.

4. **Booking and JobPosting lack critical capabilities** that MarketplaceJob already has. They cannot serve as canonical without adding escrow, settlement, matching, workspace, reviews, etc. — which would essentially recreate MarketplaceJob.

5. **36 production rows is manageable for additive evolution** — new fields can be added without breaking existing data.

6. **The V1 models (Booking, JobPosting) should be preserved as-is** for historical data and CRM analytics. Their 31+5 = 36 rows must not be lost.

**What needs to happen in Phase 4B/4C:**
- Add recurring job support to MarketplaceJob (new field or related model)
- Add project/milestone support (potentially via Contract model integration)
- Evaluate whether Booking's Invoice auto-create should be ported to MarketplaceJob
- Evaluate whether JobPosting's Dispute model should be unified with MarketplaceJob's dispute flow
- Preserve Booking and JobPosting tables for historical data
- Do NOT delete V1 models

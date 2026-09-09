# 04-DOMAIN-READERS.md — Complete Reader Inventory

> Generated: Phase 4A.4 — Full Domain Discovery
> Scope: Every important reader for all transactional marketplace models

---

## BOOKING — Readers

### Customer Readers

| # | File | Line | Purpose | Public/Customer | Historical Required | Migration Safe |
|---|---|---|---|---|---|---|
| 1 | `app/api/mobile/bookings/route.ts` | 99 | List my bookings | Customer | YES (booking history) | API depends on Booking model ID |
| 2 | `app/api/mobile/bookings/[id]/route.ts` | 12 | Booking detail | Customer/Provider | YES | API depends on Booking ID |
| 3 | `app/api/mobile/quick-bookings/[id]/route.ts` | 12 | Quick booking detail | Customer | YES | API depends on Booking ID |

### Admin Readers

| # | File | Line | Purpose | Admin | Historical Required | Migration Safe |
|---|---|---|---|---|---|---|
| 4 | `app/api/bookings/route.ts` | 37 | List all bookings | Admin | YES | API depends on Booking ID |
| 5 | `app/api/bookings/[id]/route.ts` | 16 | Booking detail | Admin | YES | API depends on Booking ID |
| 6 | `app/api/reports/route.ts` | 175 | Daily stats by status | Admin | YES (historical analytics) | Report depends on Booking |
| 7 | `app/api/districts/route.ts` | 53 | Active bookings by district | Admin | YES | Report depends on Booking |
| 8 | `app/api/customers/[id]/route.ts` | 96 | Customer recent bookings | Admin | YES | CRM depends on Booking |
| 9 | `lib/activity-log.ts` | 141 | Period stats aggregation | Admin (indirect) | YES | Stats depend on Booking |
| 10 | `app/api/reports/export/route.ts` | 86-98 | PDF report generation | Admin | YES | Export depends on Booking |
| 11 | `app/api/admin/users/route.ts` | 103,106 | Customer profile enrichment | Admin | YES | CRM depends on totalBookings |
| 12 | `app/api/customers/route.ts` | 43-74 | CRM customer search | Admin | YES | Search depends on totalBookings |

### Can migrate later?
YES — but 31 production rows with financial side effects (Invoice auto-create). Historical booking data must be preserved in CRM analytics. Migration risk: MEDIUM.

---

## MARKETPLACEJOB — Readers

### Customer Readers

| # | File | Line | Purpose | Auth | Historical Required |
|---|---|---|---|---|---|
| 1 | `app/api/mobile/v2/jobs/route.ts` | 240 | List my jobs | Customer | YES |
| 2 | `app/api/mobile/v2/jobs/[id]/route.ts` | 19 | Job detail | Customer/Provider | YES |
| 3 | `app/api/mobile/v2/jobs/[id]/escrow/route.ts` | 113 | Escrow status | Customer/Provider | YES |
| 4 | `app/api/mobile/v2/jobs/[id]/reviews/route.ts` | 122 | Job reviews | Auth | YES |
| 5 | `app/api/mobile/auth/me/route.ts` | 46 | Customer tier calculation | Customer | YES |

### Provider Readers

| # | File | Line | Purpose | Auth | Historical Required |
|---|---|---|---|---|---|
| 6 | `app/api/mobile/v2/jobs/route.ts` | 240 | Provider job feed (OPEN in categories) | Provider | YES |
| 7 | `app/api/mobile/v2/schedule/route.ts` | 18 | Schedule cluster view | Auth | NO |
| 8 | `app/api/mobile/taskers/[id]/location/route.ts` | 13 | Location sharing eligibility | Provider | NO |

### Admin Readers

| # | File | Line | Purpose | Admin | Historical Required |
|---|---|---|---|---|---|
| 9 | `app/api/mobile/v2/admin/jobs/route.ts` | 20,26 | Admin job list | Admin | YES |
| 10 | `app/api/mobile/v2/admin/summary/route.ts` | 25-29 | Admin dashboard counts | Admin | YES |
| 11 | `app/api/admin/jobs/route.ts` | 58,62 | Web admin unified job list | Admin | YES |
| 12 | `app/api/admin/analytics/route.ts` | 28-31 | Admin analytics counts | Admin | YES |
| 13 | `app/api/admin/commission/route.ts` | 276 | Weekly earnings calculation | Admin | YES |
| 14 | `app/api/mobile/v2/admin/escrows/route.ts` | 19-33 | Admin escrow summary | Admin | YES |

### System/Engine Readers

| # | File | Line | Purpose | System | Historical Required |
|---|---|---|---|---|---|
| 15 | `lib/job-matcher.ts` | 27 | Job lookup for matching | System | NO |
| 16 | `lib/matching-engine.ts` | 25 | Job lookup for matching | System | NO |
| 17 | `lib/job-matching.ts` | 65 | IN_PROGRESS jobs for busy providers | System | NO |
| 18 | `lib/job-blast.ts` | 13 | Job lookup for blast | System | NO |
| 19 | `lib/schedule-engine.ts` | 127 | Open jobs for schedule | System | NO |
| 20 | `lib/trust-engine.ts` | 23,106 | Customer trust calculation | System | NO |
| 21 | `lib/quality-engine.ts` | 19-41 | Provider quality score | System | NO |
| 22 | `lib/learning-engine.ts` | 55 | Recent 7-day jobs | System | NO |
| 23 | `lib/demand-engine.ts` | 73-81 | Demand/supply ratio | System | NO |
| 24 | `lib/fraud-detection.ts` | 162 | Dispute abuse check | System | NO |
| 25 | `lib/bi-engine.ts` | 48-155 | Business intelligence | System | NO |

### Cron Readers

| # | File | Line | Purpose | Cron | Historical Required |
|---|---|---|---|---|---|
| 26 | `app/api/cron/matching-waves/route.ts` | 23,41,59 | Wave escalation | Cron | NO |
| 27 | `app/api/cron/job-response-escalation/route.ts` | 16 | Overdue jobs | Cron | NO |
| 28 | `app/api/cron/pricing-train/route.ts` | 13 | ML training data | Cron | YES (historical pricing) |
| 29 | `app/api/cron/escrow-release/route.ts` | 109 | Job title for notification | Cron | NO |
| 30 | `app/api/cron/re-engagement/route.ts` | 19 | Old OPEN jobs | Cron | NO |

### Mobile Client Readers

| # | File | Line | Purpose | Auth |
|---|---|---|---|---|
| 31 | `apps/mobile/lib/api.ts` | 197-203 | Mobile API client (bookings) | JWT |
| 32 | `apps/mobile/lib/api-v2.ts` | 198-227 | Mobile V2 API client | JWT |

**Total: 32 reader sites. API contract depends on MarketplaceJob ID everywhere. Migration risk: HIGH (67 total callers).**

---

## JOBPOSTING — Readers

### Customer/Provider Readers

| # | File | Line | Purpose | Auth | Historical Required |
|---|---|---|---|---|---|
| 1 | `app/api/mobile/jobs/route.ts` | 30 | List V1 jobs | Customer/Tasker | YES (5 rows) |
| 2 | `app/api/mobile/jobs/[id]/route.ts` | 17 | V1 job detail | Customer | YES |
| 3 | `app/api/mobile/jobs/[id]/bid/route.ts` | 19 | Verify OPEN before bid | Tasker | YES |
| 4 | `app/api/mobile/bookings/route.ts` | 55 | Get job title for booking | Customer | YES |
| 5 | `app/api/mobile/disputes/route.ts` | 21 | Verify job before dispute | User | YES |
| 6 | `app/api/mobile/earnings/route.ts` | 24 | Count completed V1 jobs | User | YES |

### Admin Readers

| # | File | Line | Purpose | Admin | Historical Required |
|---|---|---|---|---|---|
| 7 | `app/api/admin/jobs/route.ts` | 43,57 | Admin unified job list | Admin | YES |
| 8 | `app/api/admin/jobs/route.ts` | 194 | Admin PATCH lookup | Admin | YES |
| 9 | `app/api/dashboard/route.ts` | 52-54 | Web dashboard counts | Admin | YES |

**Total: 17 callers. 5 production rows. Migration risk: LOW (small data, legacy, but disputes reference JobPosting).**

---

## JOBQUOTE — Readers

All JobQuote readers are in the V2 marketplace flow. 22 total callers. 7 production rows. Migration risk: HIGH (core V2 flow).

---

## TEMPLATEJOB — Readers

22 public + authenticated reader sites. 239 production rows. Pure catalog (read-only at runtime). Source-of-truth for job type taxonomy. Migration risk: LOW (no financial dependencies).

---

## SERVICETEMPLATE — Readers

9 reader sites. 239 production rows. Read-only at runtime (auto-seeded). Used for smart pricing wizard. Migration risk: LOW.

---

## JOBCATEGORY — Readers

32 reader sites. 24 production rows. Core taxonomy. Read-only at runtime. Migration risk: LOW.

---

## OFFERTEMPLATE — Readers

8 reader sites. 12 production rows. Read-only (offer-matcher reads via include). Migration risk: LOW.

---

## OFFERBOOKING — Readers

9 reader sites. 0 production rows. Empty but active in code. Migration risk: N/A (no data).

---

## FLASHOFFER — Readers

9 reader sites. 2 production rows. Public display only. Migration risk: LOW.

---

## JOBESCROW — Readers

26 reader sites. 11 production rows. Every financial flow depends on escrow status. Migration risk: HIGH.

---

## PROVIDERWALLET — Readers

15 reader sites. 27 production rows. Wallet balance display, admin financial view. Migration risk: HIGH (float money P0).

---

## CUSTOMERWALLET — Readers

14 reader sites. 46 production rows. Wallet balance display, admin financial view. Migration risk: HIGH (float money P0).

---

## WALLETTRANSACTION — Readers

17 reader sites. 24 production rows. Transaction history, fraud detection, admin financial view. Migration risk: HIGH.

---

## WEEKLYSETTLEMENT — Readers

18 reader sites. 10 production rows. Commission dashboard, admin management. Migration risk: MEDIUM.

---

## COMMISSIONPAYMENT — Readers

8 reader sites. 8 production rows. Earnings display, admin payment management. Migration risk: MEDIUM.

---

## INVOICE — Readers

5 reader sites. 4 production rows. V1 billing, PDF export. Migration risk: LOW (small data, V1).

---

## DISPUTE — Readers

8 reader sites. 5 production rows. V1 disputes, admin management. Migration risk: LOW (small data, V1).

---

## REVIEW SYSTEM — Readers

### Review (V1): 4 reader sites, 10 rows. Migration risk: LOW.
### TaskerReview: 2 reader sites, 0 rows. Migration risk: N/A.
### JobReview: 6 reader sites, 0 rows. Migration risk: N/A.
### ProviderReview: 4 reader sites, 0 rows. Migration risk: N/A.

---

## CONVERSATION/MESSAGE — Readers

9+7 = 16 reader sites. 0 production rows. Messaging infrastructure. Migration risk: LOW (no data).

---

## BID — Readers

3 reader sites. 0 production rows. V1 bid system. Migration risk: N/A.

---

## ASSIGNMENT — Readers

6 reader sites. 0 production rows. V1 assignment tracking, reputation engine. Migration risk: N/A.

---

## READER COUNT SUMMARY

| Model | Reader Count | Production Rows | Historical Required | API Depends on ID | Migration Risk |
|---|---|---|---|---|---|
| MarketplaceJob | 32 | 36 | YES | YES | HIGH |
| Booking | 12 | 31 | YES | YES | MEDIUM |
| JobPosting | 9 | 5 | YES | YES | LOW |
| JobQuote | 22 | 7 | YES | YES | HIGH |
| TemplateJob | 22 | 239 | NO | YES | LOW |
| ServiceTemplate | 9 | 239 | NO | YES | LOW |
| JobCategory | 32 | 24 | NO | YES | LOW |
| JobEscrow | 26 | 11 | YES | YES | HIGH |
| ProviderWallet | 15 | 27 | YES | YES | HIGH |
| CustomerWallet | 14 | 46 | YES | YES | HIGH |
| WalletTransaction | 17 | 24 | YES | YES | HIGH |
| WeeklySettlement | 18 | 10 | YES | YES | MEDIUM |
| CommissionPayment | 8 | 8 | YES | YES | MEDIUM |
| CommissionSettlement | 6 | 10 | YES | YES | MEDIUM |
| Invoice | 5 | 4 | YES | YES | LOW |
| Dispute | 8 | 5 | YES | YES | LOW |
| Review | 4 | 10 | YES | YES | LOW |
| TaskerReview | 2 | 0 | NO | YES | N/A |
| JobReview | 6 | 0 | NO | YES | N/A |
| ProviderReview | 4 | 0 | NO | YES | N/A |
| FlashOffer | 9 | 2 | NO | YES | LOW |
| OfferTemplate | 8 | 12 | NO | YES | LOW |
| Conversation | 9 | 0 | NO | YES | LOW |
| Message | 7 | 0 | NO | YES | LOW |
| Bid | 3 | 0 | YES | YES | N/A |
| Assignment | 6 | 0 | YES | YES | N/A |

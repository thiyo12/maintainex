# 04-DOMAIN-WRITERS.md — Complete Writer Inventory

> Generated: Phase 4A.3 — Full Domain Discovery
> Scope: Every active writer for all transactional marketplace models

---

## BOOKING — Writers (3 CREATE, 4 UPDATE, 1 DELETE)

### Active Writers

| # | File | Line | Operation | Lifecycle Mutation | V1/V2 | Financial | Notification |
|---|---|---|---|---|---|---|---|
| 1 | `app/api/bookings/route.ts` | 175 | CREATE | PENDING booking | V1 | NO | NO |
| 2 | `app/api/mobile/bookings/route.ts` | 34 | CREATE | PENDING booking | V1 | NO | NO |
| 3 | `app/api/mobile/quick-bookings/route.ts` | 32 | CREATE | PENDING quick booking | V1 | NO | NO |
| 4 | `app/api/bookings/[id]/route.ts` | 88 | UPDATE | Status transitions (PENDING→CONFIRMED→IN_PROGRESS→COMPLETED→CANCELLED) | V1 | YES (auto-creates Invoice on COMPLETED) | NO |
| 5 | `app/api/bookings/[id]/invoice/route.ts` | 72 | UPDATE | Status → INVOICED | V1 | YES (Invoice already created) | NO |
| 6 | `app/api/mobile/jobs/[id]/route.ts` | 125 | UPDATE | Sync Assignment status | V1 | NO | NO |

**Direct writers: 4 files, 6 write operations**

### Dead/Uncertain Writers

None. All Booking writers are active.

---

## MARKETPLACEJOB — Writers (3 CREATE, 18 UPDATE)

### Active Writers

| # | File | Line | Operation | Lifecycle Mutation | Financial | Notification |
|---|---|---|---|---|---|---|
| 1 | `app/api/mobile/v2/jobs/route.ts` | 78 | CREATE | OPEN job | NO | YES (blastJobToTaskers) |
| 2 | `app/api/mobile/v2/jobs/[id]/select-quote/route.ts` | 40 | UPDATE | OPEN → QUOTE_ACCEPTED | YES (JobEscrow create) | NO |
| 3 | `app/api/mobile/v2/jobs/[id]/escrow/route.ts` | 83 | UPDATE | QUOTE_ACCEPTED → IN_PROGRESS | YES (wallet debit, escrow PROTECTED) | YES (notify provider) |
| 4 | `app/api/mobile/v2/jobs/[id]/workspace/route.ts` | 89 | UPDATE | → COMPLETED | NO | NO |
| 5 | `app/api/mobile/v2/jobs/[id]/workspace/route.ts` | 95 | UPDATE | → CANCELLED | NO | NO |
| 6 | `app/api/mobile/v2/jobs/[id]/release-escrow/route.ts` | 63 | UPDATE | → COMPLETED | YES (provider wallet credit) | YES (notify both) |
| 7 | `app/api/mobile/v2/jobs/[id]/complete/route.ts` | 92 | UPDATE | → COMPLETED | YES (escrow release, commission) | YES (notify both) |
| 8 | `app/api/mobile/v2/jobs/[id]/complete/route.ts` | 127 | UPDATE | → CANCELLED (dispute) | YES (escrow ON_HOLD) | NO |
| 9 | `app/api/mobile/v2/jobs/[id]/share-address/route.ts` | 26 | UPDATE | Address fields only | NO | NO |
| 10 | `app/api/mobile/v2/jobs/[id]/escrow/refund/route.ts` | 50 | UPDATE | → CANCELLED | YES (customer wallet credit) | YES (notify customer) |
| 11 | `app/api/mobile/v2/quotes/route.ts` | 52 | UPDATE | responseState → responded | NO | NO |
| 12 | `app/api/mobile/v2/admin/escrows/route.ts` | 82 | UPDATE | → COMPLETED (admin force-release) | YES (provider wallet credit) | YES (notify both) |
| 13 | `app/api/mobile/v2/admin/escrows/route.ts` | 123 | UPDATE | → CANCELLED (admin force-refund) | YES (customer wallet credit) | YES (notify both) |
| 14 | `app/api/admin/jobs/route.ts` | 186 | UPDATE | Admin status change | NO | NO |
| 15 | `lib/job-matcher.ts` | 205 | UPDATE | Record wave sent | NO | NO |
| 16 | `lib/job-blast.ts` | 64 | UPDATE | Record blast results | NO | NO |
| 17 | `app/api/cron/matching-waves/route.ts` | 77 | UPDATE | Reset wave to 0 | NO | NO |
| 18 | `app/api/cron/job-response-escalation/route.ts` | 30,47 | UPDATE | responded/escalated | NO | YES (AdminAlert) |
| 19 | `app/api/cron/daily-maintenance/route.ts` | 45 | UPDATE | Revert QUOTE_ACCEPTED → OPEN | YES (escrow cancel) | YES (notify provider) |
| 20 | `app/api/cron/escrow-release/route.ts` | 68 | UPDATE | → COMPLETED (auto-release) | YES (provider wallet credit) | YES (notify both) |

**Direct writers: 15 files, 20 write operations**

---

## JOBPOSTING — Writers (3 CREATE, 2 UPDATE, 1 DELETE)

| # | File | Line | Operation | Lifecycle Mutation | V1/V2 | Financial | Notification |
|---|---|---|---|---|---|---|---|
| 1 | `app/api/mobile/jobs/route.ts` | 112 | CREATE | OPEN V1 job | V1 | NO | NO |
| 2 | `app/api/mobile/jobs/[id]/route.ts` | 118 | UPDATE | Status transitions | V1 | NO | NO |
| 3 | `app/api/mobile/jobs/[id]/route.ts` | 158 | DELETE | Hard delete | V1 | NO | NO |
| 4 | `app/api/admin/jobs/route.ts` | 198 | UPDATE | Admin status change | V1 | NO | NO |

**Direct writers: 3 files, 6 write operations**

---

## JOBQUOTE — Writers (1 CREATE, 4 UPDATE)

| # | File | Line | Operation | Lifecycle Mutation | Financial | Notification |
|---|---|---|---|---|---|---|
| 1 | `app/api/mobile/v2/quotes/route.ts` | 39 | CREATE | PENDING quote | NO | YES (notify customer) |
| 2 | `app/api/mobile/v2/jobs/[id]/select-quote/route.ts` | 38 | UPDATE | → ACCEPTED | NO | YES (notify provider) |
| 3 | `app/api/mobile/v2/jobs/[id]/select-quote/route.ts` | 39 | UPDATEMANY | → REJECTED (all non-selected) | NO | NO |
| 4 | `app/api/mobile/v2/jobs/[id]/escrow/refund/route.ts` | 54 | UPDATE | → WITHDRAWN | NO | NO |
| 5 | `app/api/cron/daily-maintenance/route.ts` | 50 | UPDATE | → PENDING (reset) | NO | NO |

**Direct writers: 4 files, 5 write operations**

---

## TEMPLATEJOB — Writers (0 runtime, 9 seed)

All TemplateJob writers are seed/upsert operations. No runtime business logic creates TemplateJob records.

| # | File | Line | Operation | Purpose |
|---|---|---|---|---|
| 1 | `lib/v2-job-categories.ts` | 403 | UPSERT | Auto-seed on first /api/mobile/job-categories call |
| 2-9 | `prisma/seed-*.ts` (5 files) | various | UPSERT/CREATE | Dev seed scripts |

**Runtime writers: 0. Seed writers: 9.**

---

## SERVICETEMPLATE — Writers (0 runtime, 2 seed)

| # | File | Line | Operation | Purpose |
|---|---|---|---|---|
| 1 | `lib/v2-job-categories.ts` | 438 | UPSERT | Auto-seed on first call |
| 2 | `prisma/seed-smart-templates.ts` | 444 | UPSERT | Dev seed |

**Runtime writers: 0. Seed writers: 2.**

---

## OFFERTEMPLATE — Writers (1 CREATE, 2 UPDATE, 1 DELETE)

| # | File | Line | Operation | Purpose | Status |
|---|---|---|---|---|---|
| 1 | `app/api/seed/test-data/route.ts` | 261 | CREATE | Seed test data | ACTIVE |
| 2 | `app/api/flash-offers/route.ts` | 105 | UPDATE | Update flash offer (shared route) | ACTIVE |
| 3 | `app/api/flash-offers/route.ts` | 131 | DELETE | Delete flash offer | ACTIVE |
| 4 | `app/api/seasonal-offers/route.ts` | 61 | CREATE | Create seasonal offer | ACTIVE |

**Note: OfferTemplate and FlashOffer share the flash-offers route file. OfferTemplate has no dedicated API — only seed data and include-by-reference in offer-matcher.**

---

## FLASHOFFER — Writers (1 CREATE, 1 UPDATE, 1 DELETE)

| # | File | Line | Operation | Purpose | Status |
|---|---|---|---|---|---|
| 1 | `app/api/flash-offers/route.ts` | 48 | CREATE | Admin creates flash offer | ACTIVE |
| 2 | `app/api/flash-offers/route.ts` | 105 | UPDATE | Admin updates flash offer | ACTIVE |
| 3 | `app/api/flash-offers/route.ts` | 131 | DELETE | Admin deletes flash offer | ACTIVE |
| 4 | `app/api/flash-offers/claim/route.ts` | 13 | UPDATE (increment) | Public claims offer (NO AUTH) | ACTIVE |

---

## JOBESCROW — Writers (2 CREATE, 14 UPDATE)

All writers are in financial transaction contexts. No standalone writes.

| # | File | Line | Operation | Lifecycle | Financial | Notification |
|---|---|---|---|---|---|---|
| 1 | `app/api/mobile/v2/jobs/[id]/select-quote/route.ts` | 47,60 | CREATE/UPDATE | → PENDING_PAYMENT | YES (escrow created) | NO |
| 2 | `app/api/mobile/v2/jobs/[id]/escrow/route.ts` | 61,69 | CREATE/UPDATE | → PROTECTED | YES (wallet debit) | YES (notify provider) |
| 3 | `app/api/mobile/v2/jobs/[id]/release-escrow/route.ts` | 34 | UPDATE | → RELEASED | YES (provider wallet credit) | YES (notify both) |
| 4 | `app/api/mobile/v2/jobs/[id]/complete/route.ts` | 68 | UPDATE | → RELEASED | YES (provider wallet credit) | YES (notify both) |
| 5 | `app/api/mobile/v2/jobs/[id]/complete/route.ts` | 121 | UPDATE | → ON_HOLD | YES (dispute) | NO |
| 6 | `app/api/mobile/v2/jobs/[id]/escrow/refund/route.ts` | 29 | UPDATE | → REFUNDED | YES (customer wallet credit) | YES (notify customer) |
| 7 | `app/api/mobile/v2/jobs/[id]/cash-payment/route.ts` | 38 | UPDATE | → RELEASED (cash) | YES (provider wallet credit) | YES (notify both) |
| 8 | `app/api/mobile/v2/admin/escrows/route.ts` | 60 | UPDATE | → RELEASED (admin) | YES (provider wallet credit) | YES (notify both) |
| 9 | `app/api/mobile/v2/admin/escrows/route.ts` | 102 | UPDATE | → REFUNDED (admin) | YES (customer wallet credit) | YES (notify both) |
| 10 | `app/api/cron/escrow-release/route.ts` | 62 | UPDATE | → RELEASED (auto) | YES (provider wallet credit) | YES (notify both) |
| 11 | `app/api/cron/daily-maintenance/route.ts` | 44 | UPDATE | → CANCELLED (stale) | YES (job revert) | YES (notify provider) |

---

## PROVIDERWALLET — Writers (0 CREATE, 5 UPSERT, 2 UPDATE)

| # | File | Line | Operation | Purpose | Financial |
|---|---|---|---|---|---|
| 1 | `app/api/mobile/v2/jobs/[id]/release-escrow/route.ts` | 38 | UPSERT | Credit on manual release | YES |
| 2 | `app/api/mobile/v2/jobs/[id]/complete/route.ts` | 72 | UPSERT | Credit on completion | YES |
| 3 | `app/api/mobile/v2/jobs/[id]/cash-payment/route.ts` | 42 | UPSERT | Credit on cash payment | YES |
| 4 | `app/api/mobile/v2/admin/escrows/route.ts` | 64 | UPSERT | Credit on admin force-release | YES |
| 5 | `app/api/cron/escrow-release/route.ts` | 82 | UPSERT | Credit on auto-release | YES |
| 6 | `app/api/admin/financial/wallets/route.ts` | 111 | UPDATE | Freeze/unfreeze | NO |
| 7 | `lib/fraud-detection.ts` | 196 | UPDATE | Auto-freeze on chargeback | NO |

---

## CUSTOMERWALLET — Writers (0 CREATE, 7 UPDATE)

| # | File | Line | Operation | Purpose | Financial |
|---|---|---|---|---|---|
| 1 | `app/api/mobile/v2/jobs/[id]/escrow/route.ts` | 43 | UPDATE | Debit for escrow deposit | YES |
| 2 | `app/api/mobile/v2/jobs/[id]/escrow/refund/route.ts` | 33 | UPDATE | Credit on refund | YES |
| 3 | `app/api/mobile/v2/wallet/route.ts` | 75 | UPDATE | Debit on withdrawal | YES |
| 4 | `app/api/mobile/v2/admin/escrows/route.ts` | 106 | UPDATE | Credit on admin force-refund | YES |
| 5 | `app/api/admin/financial/wallets/route.ts` | 123 | UPDATE | Freeze/unfreeze | NO |
| 6 | `app/api/properties/[id]/boost/route.ts` | 56 | UPDATE | Debit for property boost | YES |

---

## COMMISSIONSETTLEMENT — Writers (2 CREATE, 2 UPDATE)

| # | File | Line | Operation | Purpose | Financial |
|---|---|---|---|---|---|
| 1 | `app/api/mobile/v2/jobs/[id]/cash-payment/route.ts` | 66 | CREATE | Record commission for cash payment | YES |
| 2 | `app/api/mobile/v2/admin/commission-settle/route.ts` | 57 | UPDATE | Mark SETTLED | YES (wallet debit) |

---

## WEEKLYSETTLEMENT — Writers (2 UPSERT, 6 UPDATE)

| # | File | Line | Operation | Purpose |
|---|---|---|---|---|
| 1 | `app/api/admin/commission/route.ts` | 134 | UPSERT | Create/update weekly settlement |
| 2 | `lib/mxid.ts` | 102 | UPSERT | getOrCreateWeeklySettlement |
| 3 | `app/api/admin/commission/route.ts` | 261 | UPDATE | Status transitions (PAID/OVERDUE/SUSPEND) |
| 4 | `app/api/admin/commission/payments/route.ts` | 141 | UPDATE | Mark PAID on payment confirm |
| 5 | `app/api/admin/financial/commission/route.ts` | 172 | UPDATE | Status transitions |

---

## COMMISSIONPAYMENT — Writers (1 CREATE, 1 UPDATE)

| # | File | Line | Operation | Purpose |
|---|---|---|---|---|
| 1 | `app/api/admin/commission/route.ts` | 31 | CREATE | Create payment reference |
| 2 | `app/api/admin/commission/payments/route.ts` | 133 | UPDATE | CONFIRM payment → settlement PAID |

---

## INVOICE — Writers (2 CREATE, 2 UPDATE, 1 DELETE)

| # | File | Line | Operation | Purpose | Trigger |
|---|---|---|---|---|---|
| 1 | `app/api/invoices/route.ts` | 81 | CREATE | Manual invoice creation | Admin action |
| 2 | `app/api/bookings/[id]/invoice/route.ts` | 44 | CREATE | Create from booking | Admin action |
| 3 | `app/api/bookings/[id]/route.ts` | 103 | CREATE | Auto-create on COMPLETED | Status transition |
| 4 | `app/api/invoices/[id]/route.ts` | 65 | UPDATE | Update invoice | Admin action |
| 5 | `app/api/invoices/[id]/route.ts` | 119 | UPDATE | Soft-delete (isDeleted) | Admin action |

---

## DISPUTE — Writers (1 CREATE, 3 UPDATE)

| # | File | Line | Operation | Purpose | Actor | Notification |
|---|---|---|---|---|---|---|
| 1 | `app/api/mobile/disputes/route.ts` | 26 | CREATE | Raise dispute | User | YES (notifyAllAdmins, work queue) |
| 2 | `app/api/admin/disputes/route.ts` | 92 | UPDATE | Status transitions | Admin | NO |

---

## REVIEW SYSTEM — Writers

### Review (V1)
| # | File | Line | Operation | Actor | Notification |
|---|---|---|---|---|---|
| 1 | `app/api/reviews/route.ts` | 66 | CREATE | Public (NO AUTH) | YES (notifyAllAdmins) |
| 2 | `app/api/reviews/[id]/route.ts` | 31 | UPDATE | Admin | NO |
| 3 | `app/api/reviews/[id]/route.ts` | 69 | DELETE | Admin | NO |

### JobReview (V2)
| # | File | Line | Operation | Actor | Side Effects |
|---|---|---|---|---|---|
| 1 | `app/api/mobile/v2/jobs/[id]/reviews/route.ts` | 51 | CREATE | Customer | Updates taskerProfile.rating, fires recalculateReputation |

### ProviderReview (V2)
| # | File | Line | Operation | Actor | Side Effects |
|---|---|---|---|---|---|
| 1 | `app/api/mobile/v2/jobs/[id]/reviews/route.ts` | 91 | CREATE | Provider | None |

---

## CONVERSATION/MESSAGE — Writers

| # | File | Line | Operation | Actor | Side Effects |
|---|---|---|---|---|---|
| 1 | `app/api/mobile/conversations/route.ts` | 98 | CREATE | Auth user | Creates participants |
| 2 | `app/api/mobile/v2/jobs/route.ts` | 136 | CREATE | Customer (targeted job) | Creates participants, notifies tasker |
| 3 | `app/api/properties/[id]/inquiry/route.ts` | 55 | CREATE | Web user | Creates participants |
| 4 | `app/api/mobile/conversations/[id]/messages/route.ts` | 58 | CREATE | Auth user | Updates conversation timestamp, push notification |
| 5 | `app/api/properties/[id]/inquiry/route.ts` | 70 | CREATE | Web user | Initial property inquiry message |

---

## BID — Writers (1 CREATE)

| # | File | Line | Operation | Actor | Status |
|---|---|---|---|---|---|
| 1 | `app/api/mobile/jobs/[id]/bid/route.ts` | 36 | CREATE | Tasker | ACTIVE (legacy V1) |

---

## ASSIGNMENT — Writers (1 UPDATE)

| # | File | Line | Operation | Actor | Status |
|---|---|---|---|---|---|
| 1 | `app/api/mobile/jobs/[id]/route.ts` | 125 | UPDATE | Customer/Tasker (sync with job status) | ACTIVE (legacy V1) |

---

## WRITER COUNT SUMMARY

| Model | Active Writers | Direct | Service-Mediated | V1/V2 | Financial Side Effects |
|---|---|---|---|---|---|
| Booking | 6 | 6 | 0 | V1 | YES (Invoice auto-create) |
| MarketplaceJob | 20 | 15 | 5 (lib/*) | V2 | YES (wallet, escrow, commission) |
| JobPosting | 6 | 3 | 3 (admin) | V1 | NO |
| JobQuote | 5 | 4 | 1 (cron) | V2 | NO |
| TemplateJob | 9 (all seed) | 0 | 9 (seed) | V2 catalog | NO |
| ServiceTemplate | 2 (all seed) | 0 | 2 (seed) | V2 catalog | NO |
| OfferTemplate | 4 | 3 | 1 (seed) | V1 | NO |
| FlashOffer | 4 | 4 | 0 | V1 promo | NO |
| JobEscrow | 11 | 8 | 3 (cron) | V2 | YES (all operations financial) |
| ProviderWallet | 7 | 4 | 3 (lib/cron) | V2 | YES |
| CustomerWallet | 6 | 5 | 1 (lib) | V2 | YES |
| WalletTransaction | 11 | 9 | 2 (lib) | V2 | YES (audit trail) |
| WeeklySettlement | 7 | 5 | 2 (lib) | V2 | YES |
| CommissionPayment | 2 | 2 | 0 | V2 | YES |
| CommissionSettlement | 2 | 2 | 0 | V2 | YES |
| Invoice | 5 | 5 | 0 | V1 | YES |
| Dispute | 2 | 2 | 0 | V1 | NO |
| Review | 3 | 3 | 0 | V1 | NO |
| JobReview | 1 | 1 | 0 | V2 | NO |
| ProviderReview | 1 | 1 | 0 | V2 | NO |
| TaskerReview | 0 | 0 | 0 | V2 | NO |
| Bid | 1 | 1 | 0 | V1 | NO |
| Assignment | 1 | 1 | 0 | V1 | NO |
| Conversation | 3 | 3 | 0 | V2 | NO |
| Message | 2 | 2 | 0 | V2 | NO |
| Payout | 1 (cron) | 0 | 1 (cron) | V2 | YES |

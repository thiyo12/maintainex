# MaintainEX Risk Register

## P0 — Must Fix

| # | Risk | State | Notes | Residual |
|---|---|---|---|---|
| 1 | Path traversal in `/api/files/[...path]` | FIXED | Canonical path + null byte + realpathSync | LOW |
| 2 | Escrow-release cron no transaction | FIXED | `$transaction` + atomic `updateMany` status claim | LOW |
| 3 | Escrow-release double credit | FIXED | `updateMany` returns count=0 on concurrent | LOW |
| 4 | Cash-payment commission bug | FIXED | Uses `getProviderCommissionRate()` + `computeCommission()` | LOW |
| 5 | Float money in wallets | OPEN | 56 Float fields remain. Phase 5B+5B.1 foundation complete: BigInt money utility, ledger schema with idempotency, 9 shadow columns, backfill tool. Phase 5C.3–5C.10: all 7 financial writers dual-writing to FinancialLedger atomically. Pending: backfill (5C.11), read switch (5C.12), reconciliation (5C.14). | MEDIUM |
| 6 | SQLite/PostgreSQL split | FIXED | PostgreSQL is canonical, sed hack removed | RESOLVED |
| 7 | ProviderWallet double credit | FIXED | Atomic `$transaction` in escrow-release | LOW |
| 8 | Unauthenticated CV upload | MITIGATED | Intentional public flow, magic byte validation added | LOW |
| 61 | Canonical auth secrets missing in production | RESOLVED | MARKETPLACE_JWT_SECRET + STAFF_JWT_SECRET generated (64 bytes each), deployed via docker service update, smoke tests pass: 17/17 | LOW |
| 62 | No startup config validation for auth secrets | FIXED | instrumentation.ts + lib/config/env-validation.ts validates at startup, fails closed | LOW |
| 63 | Production data loss (102 Users, 36 Jobs, 31 Bookings) | RESOLVED | Sep 4 backup restored, schema aligned, production cutover complete. 102 Users, 36 Jobs, 31 Bookings verified. Financial totals exact match. Production stable. | RESOLVED |
| 64 | No automated database backups (Dokploy) | RESOLVED | Automated backup script deployed to VPS. Daily cron at 2am. SHA-256 checksums. 7-day retention. First backup verified (188KB). Restore test PASS (8/8 tables match). | LOW |
| 65 | No WAL archiving / PITR | OPEN | archive_mode=OFF. Must enable before production use. | HIGH |
| 66 | Destructive prisma commands in repo docs | RESOLVED | README.md, REBUILD.md, APP-STRUCTURE.md replaced with safe alternatives. package.json renamed `db:push` → `db:push:dev`. route.ts error message updated. | LOW |
| 67 | Escrow auto-release cron not running on VPS | OPEN | Vercel cron DEAD (production on Dokploy). VPS cron for escrow-release NOT YET configured. PROTECTED escrows: LKR 2,120,000 = seed data orphans (no real money) + LKR 12,500 legitimate holds. KEEP PROTECTED until Phase 5. | MEDIUM |
| 68 | Quote status stale on job cancel | OPEN | Job `cmq11nxjb000jau6tj7c2yxzd` (CANCELLED) has ACCEPTED quote. When job transitions QUOTE_ACCEPTED→CANCELLED, accepted quote not auto-rejected. | LOW |
| 69 | Admin force-release skips commission | OPEN | `admin/escrows/route.ts` RELEASE action credits full `escrow.amount` without computing commission. Provider receives more than customer-approved path. No CommissionSettlement created. | HIGH |
| 70 | Wallet top-up dead (501) | OPEN | `POST /api/mobile/v2/wallet` TOP_UP returns 501. CustomerWallet cannot be funded via API. Escrow deposit flow unreachable for non-seeded wallets. | HIGH |
| 71 | Provider withdrawal dead (503) | OPEN | `POST /api/mobile/withdraw` returns 503. Provider earnings accumulate with no payout mechanism. | HIGH |
| 72 | Absolute balance set in refund flows | OPEN | Customer refund (W-006), admin refund (W-010), customer withdrawal (W-008) use `balance: absoluteValue` instead of atomic `{ increment/decrement }`. Race condition risk. | HIGH |
| 73 | No audit trail on financial mutations | OPEN | Only 1 of 27 financial writers creates audit log (W-014 commission payment confirm). All wallet mutations, escrow state changes, admin actions lack audit trails. | HIGH |
| 74 | Broken weekly earnings calculation | OPEN | `calculateWeeklyEarnings()` in admin/commission queries `MarketplaceJob WHERE customerId = providerId` — searches for jobs where provider is customer. Returns 0 for most providers. | HIGH |
| 75 | Cash payment unreachable | OPEN | `JobEscrow.paymentMethod` defaults to CARD. Neither fundEscrow nor acceptJobQuote sets CASH. Cash payment route is unreachable through normal flows. | MEDIUM |
| 76 | Duplicate refund implementations | OPEN | Route `escrow/refund` implements own refund logic (W-006). Domain `refundEscrow()` (W-004) is dead code. They differ in accepted escrow states and quote handling. | MEDIUM |
| 77 | Two-step completion atomicity gap | OPEN | `releaseEscrow()` and `transitionJobWorkspace('COMPLETED')` in complete/route.ts are separate transactions. Failure between them leaves inconsistent state. | MEDIUM |

## P1 — Should Fix

| # | Risk | State | Notes | Residual |
|---|---|---|---|---|
| 9 | Conversation messages IDOR | FIXED | Participant check added to GET | LOW |
| 10 | Invoice cross-branch tampering | FIXED | Branch check added to PATCH + DELETE | LOW |
| 11 | CORS wildcard bug | MITIGATED | Mobile wildcard is browser-only; native apps bypass CORS | LOW |
| 12 | Admin CORS no origin validation | MITIGATED | Admin is same-origin; no cross-origin requests needed | LOW |
| 13 | In-memory rate limiting | OPEN | Acceptable for single-server | LOW |
| 14 | Individual providers 0% commission | FIXED | Falls back to platform default (10%) | LOW |
| 15 | Provider withdrawal no balance check | BLOCKED | Route disabled (503) — no reversal path exists | LOW |
| 16 | Read-before-write audit trail | OPEN | Deferred to Phase 5 | LOW |
| 17 | Pricing train SQLite SQL | FIXED | Changed `datetime('now')` to `NOW()` | RESOLVED |
| 18 | No migration history | FIXED | Baseline created, `migration_lock.toml` exists | RESOLVED |
| 19 | Middleware dual auth system | MITIGATED | Revocation check added | LOW |
| 20 | `npm run build` failure | FIXED | Prisma validate/generate/build all pass with PostgreSQL | RESOLVED |

## P2 — Nice to Have

| # | Risk | State | Notes |
|---|---|---|---|
| 21 | Inconsistent commission formulas | MITIGATED | All routes now use `computeCommission()` |
| 22 | 5 parallel job systems | OPEN | Deferred |
| 23 | 3 admin auth mechanisms | RESOLVED | Phase 3D/E — single canonical staff auth (STAFF_JWT_SECRET), legacy HMAC zero issuance/acceptance, dead code removed |
| 24 | Bookings GET no ownership | FIXED | Ownership check added |
| 25 | CSP unsafe-inline/eval | OPEN | Deferred |
| 26 | Admin route-level CORS any-origin | MITIGATED | Same-origin, no cross-origin needed |
| 27 | dangerouslySetInnerHTML in 10 components | OPEN | Deferred |
| 28 | 14 empty catch blocks | OPEN | Deferred |
| 29 | Dead schema fields (8+) | OPEN | Deferred |
| 30 | Customer withdrawal bookkeeping-only | OPEN | Deferred |

## P3 — Cleanup

| # | Risk | State | Notes |
|---|---|---|---|
| 31 | CustomerWallet.isFrozen never checked | OPEN | Deferred |
| 32 | ProviderWallet.pendingBalance unused | OPEN | Deferred |
| 33 | Category overlaps JobCategory | OPEN | Phase 4A confirmed: V1 Category+Service vs V2 JobCategory+TemplateJob+ServiceTemplate — different taxonomies, keep both |
| 34 | Settings overlaps AppSetting | OPEN | Deferred |
| 35 | PayoutRequest overlaps Payout | OPEN | Phase 4A confirmed: PayoutRequest has ZERO callers — DEAD model, safe to remove |
| 36 | QualityMetric never consumed | OPEN | Deferred |
| 37 | DemandForecast never consumed | OPEN | Deferred |
| 38 | DB-level concurrency testing | OPEN | Step 5B verified UserSession service; escrow concurrency remains deferred to Phase 5 |
| 39 | Wallet cascade delete hazard | OPEN | Deferred to Phase 5 |
| 40 | WalletTransaction idempotency | OPEN | Deferred to Phase 5 |
| 52 | CompanySpecialty has ZERO callers | OPEN | Phase 4A confirmed: DEAD model, safe to remove from schema |
| 53 | 19 models with 0 production rows | OPEN | Phase 4A confirmed: OfferBooking, OfferEnrollment, OfferMatchQueue, Bid, Assignment, JobMatchQueue, TaskerSkill, TeamMember, Conversation, Message, TaskerReview, JobReview, ProviderReview, SeasonalOffer, SeasonalOfferJob, PayoutRequest, CompanySpecialty, TaskerReview, ProviderReview — all have active code but 0 data. Classify as UNCERTAIN/EXPERIMENTAL |
| 54 | FlashOffer claim endpoint has NO auth | OPEN | Phase 4A confirmed: POST /api/flash-offers/claim has no authentication — anyone can increment currentClaims. Potential abuse vector |
| 55 | Review POST endpoint has NO auth | OPEN | Phase 4A confirmed: POST /api/reviews uses fixed guest user (maintainex.lk@gmail.com) — unauthenticated review submission |
| 56 | Seed endpoint has NO auth | OPEN | Phase 4A confirmed: /api/seed/test-data has no auth check — creates test data in production |
| 57 | 3 V1 job systems coexist (Booking, JobPosting, MarketplaceJob) | OPEN | Phase 4A confirmed: V1 Booking (31 rows) + V1 JobPosting (5 rows) + V2 MarketplaceJob (36 rows) — all active, no consolidation yet |
| 58 | No recurring job support | OPEN | Phase 4A confirmed: No recurring field, model, or route exists anywhere |
| 59 | No project/milestone support for marketplace jobs | OPEN | Phase 4A confirmed: Contract model exists for companies but no marketplace job project support |
| 60 | Dispute model references JobPosting (V1) not MarketplaceJob (V2) | OPEN | Phase 4A confirmed: V1 Dispute (5 rows) links to JobPosting. V2 dispute is via MarketplaceJob DISPUTE action — no dedicated V2 Dispute model |

## Phase 2C Closure Items (ALL EXECUTED AND PASSED)

| # | Risk | State | Notes |
|---|---|---|---|
| 41 | Integration test infrastructure | EXECUTED | Tests run on VPS PostgreSQL |
| 42 | Escrow concurrency (PostgreSQL) | EXECUTED | 2-way and 5-way tests PASS |
| 43 | Transaction rollback (PostgreSQL) | EXECUTED | PostgreSQL ROLLBACK verified |
| 44 | Ownership tests (PostgreSQL) | EXECUTED | Conversation/message isolation PASS |
| 45 | Backup/restore rehearsal | EXECUTED | pg_dump + restore verified |

## Phase 3 — Auth Consolidation Risks (CLOSED)

| # | Risk | State | Notes |
|---|---|---|---|
| 46 | Mobile JWT no revocation (30d stateless) | RESOLVED | Phase 3C — canonical login issues UserSession + 15-min access JWT + 30-day refresh; legacy compat window bounded |
| 47 | Middleware duplicate JWT verifier | RESOLVED | Phase 3D — middleware uses STAFF_JWT_SECRET, canonical Edge-compatible HMAC verification |
| 48 | NEXTAUTH_SECRET shared across systems | RESOLVED | Phase 3D — separate MARKETPLACE_JWT_SECRET + STAFF_JWT_SECRET; NEXTAUTH_SECRET retained temporarily for legacy mobile compat cutoff only |
| 49 | verifySimpleToken dual-format (JWT+HMAC) | RESOLVED | Phase 3D — removed; all routes use canonical staff/marketplace JWT verification |
| 50 | Dead code: createSimpleToken, adminAuthorize, getSessionFromCookie | RESOLVED | Phase 3E — all removed; AdminRefreshToken model dropped; lib/admin-jwt.ts deleted |
| 51 | Auth-utils SessionUser missing suspend/ban fields | RESOLVED | Phase 3C — authenticateRequest returns full AuthenticatedUser with suspend/ban fields; assertNotSuspended enforced on write routes |

## Master Correction Sequence

| Phase | Focus | Status |
|---|---|---|
| Phase 0 | Audit | COMPLETE |
| Phase 1 | Emergency security + financial hotfix | COMPLETE |
| Phase 2 | PostgreSQL + database foundation | VERIFIED AND CLOSED |
| Phase 3 | Identity / Authentication / RBAC | CODE COMPLETE — 108/108 tests PASS, dead code removed, legacy issuance ZERO. SECRETS DEPLOYED (P0 #61 RESOLVED). Schema aligned via recovery migration. |
| Phase 4A | Domain Discovery | COMPLETE — 4A.1-4A.7 all documented, no schema changes, no production mutations |
| Phase 4B | Canonical Marketplace Design | COMPLETE — architecture frozen, 11 documents created, no schema changes, no production mutations |
| Phase 4B.1 | Final Architecture Corrections | COMPLETE — 7 corrections applied, conditional retention, FK risk MEDIUM |
| Phase 4C | Canonical Marketplace Implementation | COMPLETE — domain service, BOOK_NOW convergence, security gaps closed, 188 tests pass |
| Phase 4 | Canonical Marketplace Domain | FULLY CLOSED — 4A+4B+4B.1+4C+4E+4F complete, financial safety gate passed, real PostgreSQL concurrency verified, automated backups configured, production stable, ready for Phase 5 |
| Phase 5 | Financial Core / Money / Ledger / Payments / Payouts | PENDING |
| Phase 6 | Provider / Company / Trust | PENDING |
| Phase 7 | Matching / Pricing | PENDING |
| Phase 8 | Country Engine | PENDING |
| Phase 9 | Production Infrastructure | PENDING |
| Phase 10 | Full Testing / Beta Readiness | PENDING |

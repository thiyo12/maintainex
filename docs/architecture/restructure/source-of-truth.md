# Source of Truth — One Canonical Implementation per Domain (Section 41E)

Classification vocabulary: `CANONICAL` · `COMPATIBILITY` (kept for callers mid-migration) ·
`READ_ONLY_LEGACY` · `MIGRATION_REQUIRED` · `SAFE_TO_REMOVE` (only via the retirement ladder).

Importer counts = files with import statements at baseline (`dbae2f73`).

## The table

| DOMAIN | CURRENT IMPLEMENTATIONS | CANONICAL | LEGACY | MIGRATION REQUIRED |
|---|---|---|---|---|
| **Website session auth** | `lib/auth-utils.ts` (`getSession`, 51 importers) | `lib/auth-utils.ts` (web) | — | fold into `lib/modules/auth` (compatibility wrapper) |
| **Mobile customer auth** | `lib/mobile-auth.ts` (86), `lib/auth/marketplace-auth.ts` (24) | `lib/auth/marketplace-auth.ts` (target) | `lib/mobile-auth.ts` (COMPATIBILITY, huge caller base) | 86 importers → marketplace-auth, screen-by-screen |
| **Admin simple-token** | `lib/admin-auth.ts` (37 admin routes) | **current production truth** (37 routes depend on it) | — | supersede with staff-session system, then retire |
| **Admin JWT + 2FA** | `lib/admin-jwt.ts` (5) + `app/api/admin/auth/login` (creates `AdminSession` directly) | login/refresh/2FA issuance | — | becomes `lib/modules/admin/auth` |
| **Staff sessions** | `lib/auth/staff-sessions.ts` (9; `authenticateStaffRequest` guards 7 routes), `staff-jwt.ts` (1), `staff-rotation.ts` (2); **`createStaffSession` has 0 callers** | session validation used by 7 routes (works — login creates rows) | unused `createStaffSession`/rotation helpers | consolidate all of §staff-auth into ONE system (Section 16) |
| **Route guard** | `middleware.ts` (545 ln: JWT + simple-token + rate-limit re-implementations) vs per-route wrappers | per-route `requirePermission` (target) | middleware duplication | shrink middleware after RBAC centralization |
| **RBAC** | scattered: role arrays in admin routes + frontend role checks | single permission source (Section 17) | all local role arrays | `requirePermission()` backend + `can()` frontend |
| **Mobile API transport** | `apps/mobile/lib/api.ts` (57 importers), `api-v2.ts` (48) | `api-v2.ts` | `api.ts` | split into `apps/mobile/api/*` per domain, migrate screen-by-screen |
| **Jobs** | `MarketplaceJob` model + `lib/domain/job-lifecycle.ts` (17) vs legacy `JobPosting` model | `MarketplaceJob` | `JobPosting` model (READ_ONLY_LEGACY) | job-lifecycle split → marketplace/jobs + finance/escrow |
| **Quotes** | v2 `JobQuote` (+ release-gate unique constraints in new migrations) | `JobQuote` | legacy quote paths | quote concurrency tests guard it |
| **Matching** | `lib/job-matcher.ts` (0 importers), `lib/matching-engine.ts` (0 importers; only read as source-strings by `tests/phase8/negative-security.test.ts` + docs) | whichever is actually invoked by routes (verify per-route usage before retiring) | both file-level import counts are 0 | keep until route-level callers mapped; retire via ladder |
| **Payments** | `lib/payment/payment-service.ts` + `lib/payment/payhere-adapter.ts` (5), 3 payhere callback routes, webhook | `lib/payment/*` | ad-hoc writes in legacy routes | all money writes behind services |
| **Escrow** | inside `lib/domain/job-lifecycle.ts` AND `lib/ledger.ts` `postEscrowDeposit/Release/Refund` (10) + `JobEscrow` model | `lib/ledger.ts` + escrow module (target) | duplicate escrow rules inside job-lifecycle | **highest-risk split** (Phase B) |
| **Wallets** | `ProviderWallet`, `CustomerWallet`, `WalletBalance` models coexist; `lib/financial-read.ts`, Float shadow-wallet writes found in audit | `WalletBalance` (target canonical) | `ProviderWallet`/`CustomerWallet` + 5 legacy Float writes | behind wallet application service |
| **Commission** | `CommissionSettlement` vs legacy `WeeklySettlement` | `CommissionSettlement` | `WeeklySettlement` | payout-engine path |
| **Payouts** | `Payout` vs `PayoutRequest` models; `lib/payout-engine.ts` (4) | `Payout` + payout-engine | `PayoutRequest` (0 meaningful callers — verify) | RESERVED-never-completes gap is a known finance bug (separate fix) |
| **Disputes** | old `Dispute` model vs v2 dispute lifecycle | `MarketplaceDispute` (target entity) | old `Dispute` | canonical dispute module → calls finance services |
| **Notifications** | `lib/notifications.ts` (18) vs `lib/notifications-phase10-4.ts` (5) | `lib/notifications.ts` | phase10-4 copy | merge phase10-4 (5 files) into canonical |
| **Pricing** | `lib/pricing/*` (23) canonical; Phase C removed dead `lib/pricing-engine.ts`, `lib/smart-pricing.ts`, `lib/pricing-countries.ts`, root `lib/pricing-types.ts` | `lib/pricing/*` | none — `docs/architecture/pricing-engine.md` already documents `lib/pricing/` | done (Phase C) |
| **Admin alert/work-queue** | `AdminAlert` model + auto-assignment logic | `AdminAlert` → CRM work queue (Section 21) | — | add category/SLA fields later |
| **Audit** | `lib/admin-rbac.ts` audit logging (per AGENTS.md) + `AuditLog` | `AuditLog` via admin module | scattered audit calls | centralize in `lib/modules/admin/audit` |
| **i18n** | `apps/mobile/lib/i18n/locales/{en,si,ta}` — parity tests failing (ta/si missing hundreds of keys) | all three locales, parity-enforced | — | fix as mobile-phase task (baseline failure) |

## Entity-level canonical set (Section 14)

`MarketplaceJob` · `JobQuote` · `JobWorkspace` · `CompanyJobAssignment` · `JobVerificationPin` ·
`PaymentIntent` · `JobEscrow` · `FinancialLedger` · `WalletBalance` · `CommissionSettlement` ·
`Payout` · `MarketplaceDispute` · `Admin` · `AdminSession` · `AdminAlert` · `AuditLog`

Anything not in this list is either infrastructure or awaiting a decision recorded in
`migration-map.md`.

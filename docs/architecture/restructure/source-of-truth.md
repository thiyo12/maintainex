# Source of Truth — One Canonical Implementation per Domain (Section 41E)

Classification vocabulary: `CANONICAL` · `COMPATIBILITY` (kept for callers mid-migration) ·
`READ_ONLY_LEGACY` · `MIGRATION_REQUIRED` · `SAFE_TO_REMOVE` (only via the retirement ladder).

Importer counts = files with import statements at baseline (`dbae2f73`).

## The table

| DOMAIN | CURRENT IMPLEMENTATIONS | CANONICAL | LEGACY | MIGRATION REQUIRED |
|---|---|---|---|---|
| **Website session auth** | `lib/auth/authentication/auth-utils.ts` (`getSession`, 52 importers — canonical since Phase H `c9db65a8`) | `lib/auth/authentication/auth-utils.ts` (web) | root shim REMOVED (Phase H) | migrate callers gradually |
| **Mobile customer auth** | `lib/auth/compatibility/mobile-auth.ts` (89 importers; root shim retired Phase H `c9db65a8`), `lib/auth/marketplace-auth.ts` (24) | `lib/auth/marketplace-auth.ts` (target) | `mobile-auth` (COMPATIBILITY, huge caller base — DEFERRED_AFTER_H) | 89 importers → marketplace-auth, screen-by-screen; **conflict kept**: mobile-auth checks `session.isValid`, marketplace-auth does not — no current writer of `isValid=false`, unification deferred (silent behavior choice) |
| **Admin simple-token** | `lib/auth/authentication/admin-auth.ts` (37 admin routes; root shim retired Phase H `c9db65a8`) | **current production truth** (37 routes depend on it) | root shim REMOVED (Phase H) | supersede with staff-session system, then retire; **Phase D conflict**: middleware's inline 2-part legacy verifier uses `base64(secret+payload).slice(0,32)` while canonical uses HMAC-hex (`createSimpleToken` has 0 callers) — middleware not delegated (edge runtime + unresolved scheme authority) |
| **Admin JWT + 2FA** | `lib/auth/authentication/admin-jwt.ts` (5 importers; root shim retired Phase H `c9db65a8`) + `app/api/admin/auth/login` (creates `AdminSession` directly) | login/refresh/2FA issuance | root shim REMOVED (Phase H) | login routes migrate onto canonical module when superseding simple-token |
| **Staff sessions** | `lib/auth/staff-sessions.ts` (9; `authenticateStaffRequest` guards 7 routes), `staff-jwt.ts` (1), `staff-rotation.ts` (2); **`createStaffSession` has 0 production callers** | session validation used by 7 routes (works — login creates rows) | unused `createStaffSession`/rotation helpers (test-coupled: DB tests of revoke/getActive cover them) | consolidate §staff-auth into ONE system; **DEFERRED_AFTER_H** (ladder's zero-caller step unreachable without losing security test coverage) |
| **Route guard** | `middleware.ts` (507 ln: JWT + simple-token re-implementations; Phase D: admin role allowlist now derives from canonical `ADMIN_ROLES`) | per-route `requirePermission` (target) | middleware verifier duplication (edge-runtime: cannot import node crypto/jsonwebtoken; see admin-simple-token conflict) | shrink middleware after RBAC centralization |
| **RBAC** | vocabulary centralized Phase D at `lib/auth/rbac/permissions.ts` (`AdminRole`/`ADMIN_ROLES`/`ROLE_PERMISSIONS`, `lib/admin-types.ts` re-exports); enforcement still inline in 77 route files | single permission source = `lib/auth/rbac/permissions.ts` | all local role arrays | `requirePermission()` backend + `can()` frontend — incremental; exact-status/payload variance (401 vs 403) forbids big-bang migration |
| **Mobile API transport** | `apps/mobile/api/{client,v2-client,<domain>}.ts` (114 call sites now import canonical `@/api/<domain>`; shims retired Phase H `a7530c6f`) | `apps/mobile/api/*` (two transports kept separate: error semantics + default base URL differ — NOT unified) | root shims REMOVED (Phase H) | done |
| **Jobs** | `MarketplaceJob` model + `lib/domain/job-lifecycle.ts` (17) vs legacy `JobPosting` model | `MarketplaceJob` | `JobPosting` model (READ_ONLY_LEGACY) | job-lifecycle split → marketplace/jobs + finance/escrow |
| **Quotes** | v2 `JobQuote` (+ release-gate unique constraints in new migrations) | `JobQuote` | legacy quote paths | quote concurrency tests guard it |
| **Matching** | `lib/matching/index.ts` (live candidate discovery + DB-level country filters); legacy `lib/{job-matcher,matching-engine}.ts` REMOVED Phase H `b642bad3` (0 importers; negative-security source-reads retargeted to canonical) | `lib/matching/index.ts` (+ `lib/job-matching.ts`, `lib/offer-matcher.ts` for their flows) | none | done (Phase H) |
| **Payments** | `lib/payment/payment-service.ts` + `lib/payment/payhere-adapter.ts` (5), 3 payhere callback routes, webhook | `lib/payment/*` | ad-hoc writes in legacy routes | all money writes behind services |
| **Escrow** | `lib/finance/escrow/escrow-service.ts` (canonical, called directly by 8 routes since Phase H `187ce68d`) + `JobEscrow` model; job-lifecycle keeps transitions only | `lib/finance/escrow/escrow-service.ts` | escrow re-exports from job-lifecycle REMOVED (Phase H) | job-lifecycle internal escrow cleanup remains Phase B target |
| **Wallets** | `ProviderWallet`, `CustomerWallet`, `WalletBalance` models coexist; `lib/financial-read.ts`, Float shadow-wallet writes found in audit | `WalletBalance` (target canonical) | `ProviderWallet`/`CustomerWallet` + 5 legacy Float writes | behind wallet application service |
| **Commission** | `CommissionSettlement` vs legacy `WeeklySettlement` | `CommissionSettlement` | `WeeklySettlement` | payout-engine path |
| **Payouts** | `Payout` vs `PayoutRequest` models; `lib/finance/payouts/payout-engine.ts` (root shim retired Phase H `187ce68d`) | `Payout` + payout-engine | `PayoutRequest` (0 meaningful callers — verify) | RESERVED-never-completes gap is a known finance bug (separate fix) |
| **Disputes** | old `Dispute` model vs v2 dispute lifecycle | `MarketplaceDispute` (target entity) | old `Dispute` | canonical dispute module → calls finance services |
| **Notifications** | `lib/notifications/index.ts` (single system; both root shims REMOVED Phase H `afc6ebd0`) | `lib/notifications/index.ts` | none | done (Phase H) |
| **Pricing** | `lib/pricing/*` (23) canonical; Phase C removed dead `lib/pricing-engine.ts`, `lib/smart-pricing.ts`, `lib/pricing-countries.ts`, root `lib/pricing-types.ts` | `lib/pricing/*` | none — `docs/architecture/pricing-engine.md` already documents `lib/pricing/` | done (Phase C) |
| **Admin alert/work-queue** | `AdminAlert` model + auto-assignment logic | `AdminAlert` → CRM work queue (Section 21) | — | add category/SLA fields later |
| **Audit** | `createAuditLog()` in `lib/auth/authorization/admin-rbac.ts` + `AuditLog` | `AuditLog` via admin module | scattered audit calls | centralize in `lib/modules/admin/audit` |
| **i18n** | `apps/mobile/lib/i18n/locales/{en,si,ta}` — parity tests failing (ta/si missing hundreds of keys) | all three locales, parity-enforced | — | fix as mobile-phase task (baseline failure) |

## Entity-level canonical set (Section 14)

`MarketplaceJob` · `JobQuote` · `JobWorkspace` · `CompanyJobAssignment` · `JobVerificationPin` ·
`PaymentIntent` · `JobEscrow` · `FinancialLedger` · `WalletBalance` · `CommissionSettlement` ·
`Payout` · `MarketplaceDispute` · `Admin` · `AdminSession` · `AdminAlert` · `AuditLog`

Anything not in this list is either infrastructure or awaiting a decision recorded in
`migration-map.md`.

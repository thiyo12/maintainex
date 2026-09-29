# Where to Fix a Bug

Symptom → owning location. During migration, follow the arrow chain to the current owner
(see `restructure/source-of-truth.md` for canonical vs legacy). Target paths under
`lib/modules/` activate as Phases A–D land; until then the legacy path is authoritative.

| Symptom | Where to fix |
|---|---|
| Login / OTP / session bug (website) | `lib/auth/authentication/auth-utils.ts` (root shim retired in Phase H) |
| Login / 2FA / refresh bug (admin) | `lib/auth/authentication/admin-jwt.ts` + `app/api/admin/auth/login` → target `lib/modules/admin/auth` |
| Admin route rejects/accepts wrongly (simple-token) | `lib/auth/authentication/admin-auth.ts` (root shim retired in Phase H) |
| Staff session validation bug (7 routes) | `lib/auth/staff-sessions.ts` (`authenticateStaffRequest`) |
| Permission / role / country-scope bug | `lib/auth/authorization/admin-rbac.ts` + `lib/auth/rbac/permissions.ts` (Phase D canonical) + inline role arrays in routes |
| Mobile token / suspension bug | `lib/auth/compatibility/mobile-auth.ts` (kept, DEFERRED_AFTER_H) → migrating to `lib/auth/marketplace-auth.ts` |
| Job lifecycle / state transition bug | `lib/domain/job-lifecycle.ts` → target `lib/modules/marketplace/jobs` |
| Quote bug (create/accept/concurrency) | `app/api/mobile/v2/jobs/.../quotes` + `JobQuote` service → target `lib/modules/marketplace/quotes` |
| Matching / who-gets-the-job bug | `lib/matching/index.ts` (canonical; legacy engines retired in Phase H) → target `lib/modules/marketplace/matching` |
| Company assignment / workforce bug | `CompanyJobAssignment` routes (legacy `lib/branch-assignment.ts` retired in Phase H) → target `lib/modules/marketplace/assignments` |
| Payment bug (intent, gateway, webhook) | `lib/payment/payment-service.ts`, `lib/payment/payhere-adapter.ts`, `app/api/payments/payhere/*`, webhooks → target `lib/modules/finance/payments` |
| Escrow bug (PROTECTED/RELEASE/REFUND) | `lib/finance/escrow/escrow-service.ts` + `lib/domain/job-lifecycle.ts` (escrow re-exports retired in Phase H) → target `lib/modules/finance/escrow` |
| Ledger / double-entry bug | `lib/finance/ledger/ledger-service.ts` (root shim retired in Phase H) → target `lib/modules/finance/ledger` |
| Commission bug | commission code in job-lifecycle/payout paths → target `lib/modules/finance/commission` |
| Wallet balance bug | `WalletBalance` / `lib/financial-read.ts` → target `lib/modules/finance/wallets` |
| Refund bug | `escrow/refund` route + ledger `postEscrowRefund` → target `lib/modules/finance/refunds` |
| Payout bug | `lib/finance/payouts/payout-engine.ts` (root shim retired in Phase H) → target `lib/modules/finance/payouts` |
| Reconciliation / ledger mismatch | `lib/financial-audit.ts` → target `lib/modules/finance/reconciliation` |
| KYC / identity verification bug | KYC routes + `identityStatus` gating → target `lib/modules/trust/kyc` |
| Dispute bug | legacy `Dispute` vs v2 lifecycle (check model!) → target `lib/modules/trust/disputes` |
| Risk / suspension bug | `assertNotSuspended()` in `lib/auth/compatibility/mobile-auth.ts` + risk routes → target `lib/modules/trust/risk` |
| Chat bug | chat routes + participant checks → target `lib/modules/communications/chat` |
| Notification not sent | `lib/notifications/index.ts` (both root shims retired in Phase H) → target `lib/modules/communications/notifications` |
| Push / outbox retry bug | outbox/retry logic near notifications → target `lib/modules/communications/outbox` |
| SMS/OTP delivery bug | SMS provider infra + OTP routes → target `lib/modules/communications/sms` |
| Pricing wrong quote | `lib/pricing/*` (canonical; `pricing-engine.ts`/`smart-pricing.ts` removed in Phase C) |
| Admin page (CRM UI) bug | `app/(admin)/admin/**` pages (thin) + `app/api/admin/**` → target `lib/modules/admin` |
| Admin login page bug (UI) | `app/(auth)/admin/login/**` (page + layout; middleware guards `/admin/login`) |
| Admin API data bug | `app/api/admin/**` route → thin controller over module service |
| Mobile auth / OTP / session bug (app) | `apps/mobile/features/auth/` (screens `features/auth/screens/**`, context `features/auth/context/auth.tsx`) |
| Customer booking / find-a-tasker bug | `apps/mobile/features/customer/` (screens + components) |
| Job lifecycle screen bug (any role) | `apps/mobile/features/jobs/screens/{customer,tasker,company}/**` |
| Quote flow screen bug | `apps/mobile/features/quotes/screens/{customer,tasker,company}/**` |
| Tasker screen bug (availability, identity, discovery) | `apps/mobile/features/tasker/` |
| Company screen bug (team, workforce, dispatch) | `apps/mobile/features/company/` |
| Chat / messaging screen bug | `apps/mobile/features/messaging/` |
| Wallet / payment screen bug | `apps/mobile/features/payments/screens/**` |
| Notification screen bug (app) | `apps/mobile/features/notifications/` (platform push setup: `features/notifications/platform.ts`) |
| Profile / settings screen bug (app) | `apps/mobile/features/profile/` + role settings under `features/{customer,tasker,company}/screens/settings` |
| Real-estate screen bug | `apps/mobile/features/real-estate/` |
| Mobile screen bug (any) | `apps/mobile/app/<route>.tsx` is a THIN route wrapper — implementation lives in `apps/mobile/features/**` |
| Mobile API call bug | `apps/mobile/api/*` (`api/client.ts` v1 transport, `api/v2-client.ts` v2 transport, domain adapters `api/jobs|quotes|auth|...`; root shims retired in Phase H) |
| Mobile shared UI bug | `apps/mobile/components/` (ui primitives, AISearchBar, ProfileHeader, PropertyCard) |
| Website page / SEO bug | `app/(public)/**` pages (homepage = `app/(public)/page.tsx`) + `components/**` → target `components/public`; system pages `app/setup`, `app/maintenance` stay at root |
| Test fails | `tests/<domain>/**` (Phase F layout: auth rbac security finance pricing jobs quotes notifications admin company tasker customer mobile structural integration e2e legacy helpers) |

## Test ownership (Phase F)

Every implementation area has an obvious home for its tests (see
`restructure/testing-map.md` for the full tree):

| Bug area | Implementation | Tests |
|---|---|---|
| Auth / sessions / JWT | `lib/auth/**` | `tests/auth/` (characterization retargeted to canonical in Phase H) |
| RBAC / permissions | `lib/auth/rbac/**`, `lib/auth/authorization/admin-rbac.ts` | `tests/rbac/` |
| Security (IDOR, rate limit, isolation, redaction) | `lib/security/**`, route guards | `tests/security/` |
| Escrow | `lib/finance/escrow/**` (job-lifecycle escrow) | `tests/finance/escrow/` |
| Ledger / money | `lib/finance/ledger/ledger-service.ts`, `lib/money` | `tests/finance/ledger/` |
| Payments / webhooks | `lib/payment/**`, `app/api/payments/**` | `tests/finance/payments/` |
| Payouts | `lib/finance/payouts/payout-engine.ts` | `tests/finance/payouts/` |
| Commission / fees | job-lifecycle + pricing fees | `tests/finance/` (root files) |
| Pricing | `lib/pricing/**` | `tests/pricing/` |
| Jobs / matching / lifecycle | `lib/matching/**`, `lib/domain/**` | `tests/jobs/` |
| Quotes / change orders | `lib/domain/quotes/**`, v2 quotes routes | `tests/quotes/` |
| Notifications | `lib/notifications/**` | `tests/notifications/` |
| Admin review queues | `app/(admin)/admin/**`, `app/api/admin/**` | `tests/admin/` |
| Company / KYC / invites | company routes + membership services | `tests/company/` |
| Tasker / professions | profession routes + matching eligibility | `tests/tasker/` |
| Mobile app (any feature) | `apps/mobile/features/**` | `tests/mobile/` (lib units; i18n retained under `apps/mobile/lib/i18n/__tests__`) |
| Schema / migrations | `prisma/schema.prisma` | `tests/structural/` |
| Cross-domain flows | multiple | `tests/integration/` |
| Compatibility shims | **all retired in Phase H** (root auth/finance/notification/mobile shims deleted) | remaining DEFERRED_AFTER_H items: `createStaffSession`, `rotateStaffTokenFamily`, `createSimpleToken`, mobile-auth/marketplace-auth `session.isValid` divergence, middleware legacy verifier (see `restructure/source-of-truth.md`) |

Fast discovery: `npx vitest run tests/<domain>/`. The shared DB guard lives in
`tests/helpers/test-guard.ts`.

## Fast lookup commands

```bash
# who calls this module?
grep -rn "from ['\"].*lib/domain/job-lifecycle" --include='*.ts*' app lib components

# which route auth does this use?
grep -rln "authenticateStaffRequest\|requireAdminAuth\|verifyMarketplaceToken" app/api

# is this file dead? (retirement ladder requires more than this)
git grep -n "lib/some-module" -- app lib components tests scripts
```

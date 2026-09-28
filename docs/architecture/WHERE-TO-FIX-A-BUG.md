# Where to Fix a Bug

Symptom → owning location. During migration, follow the arrow chain to the current owner
(see `restructure/source-of-truth.md` for canonical vs legacy). Target paths under
`lib/modules/` activate as Phases A–D land; until then the legacy path is authoritative.

| Symptom | Where to fix |
|---|---|
| Login / OTP / session bug (website) | `lib/auth/authentication/auth-utils.ts` (Phase D canonical; root `lib/auth-utils.ts` = shim) |
| Login / 2FA / refresh bug (admin) | `lib/admin-jwt.ts` + `app/api/admin/auth/login` → target `lib/modules/admin/auth` |
| Admin route rejects/accepts wrongly (simple-token) | `lib/auth/authentication/admin-auth.ts` (Phase D canonical; root `lib/admin-auth.ts` = shim) |
| Staff session validation bug (7 routes) | `lib/auth/staff-sessions.ts` (`authenticateStaffRequest`) |
| Permission / role / country-scope bug | `lib/auth/authorization/admin-rbac.ts` + `lib/auth/rbac/permissions.ts` (Phase D canonical) + inline role arrays in routes |
| Mobile token / suspension bug | `lib/mobile-auth.ts` → migrating to `lib/auth/marketplace-auth.ts` |
| Job lifecycle / state transition bug | `lib/domain/job-lifecycle.ts` → target `lib/modules/marketplace/jobs` |
| Quote bug (create/accept/concurrency) | `app/api/mobile/v2/jobs/.../quotes` + `JobQuote` service → target `lib/modules/marketplace/quotes` |
| Matching / who-gets-the-job bug | `lib/matching-engine.ts` / `lib/job-matcher.ts` (both 0 importers — verify route callers first) → target `lib/modules/marketplace/matching` |
| Company assignment / workforce bug | `CompanyJobAssignment` routes + `lib/branch-assignment.ts` (dead?) → target `lib/modules/marketplace/assignments` |
| Payment bug (intent, gateway, webhook) | `lib/payment/payment-service.ts`, `lib/payment/payhere-adapter.ts`, `app/api/payments/payhere/*`, webhooks → target `lib/modules/finance/payments` |
| Escrow bug (PROTECTED/RELEASE/REFUND) | `lib/domain/job-lifecycle.ts` escrow section + `lib/ledger.ts` → target `lib/modules/finance/escrow` |
| Ledger / double-entry bug | `lib/ledger.ts` → target `lib/modules/finance/ledger` |
| Commission bug | commission code in job-lifecycle/payout paths → target `lib/modules/finance/commission` |
| Wallet balance bug | `WalletBalance` / `lib/financial-read.ts` → target `lib/modules/finance/wallets` |
| Refund bug | `escrow/refund` route + ledger `postEscrowRefund` → target `lib/modules/finance/refunds` |
| Payout bug | `lib/payout-engine.ts` → target `lib/modules/finance/payouts` |
| Reconciliation / ledger mismatch | `lib/financial-audit.ts` → target `lib/modules/finance/reconciliation` |
| KYC / identity verification bug | KYC routes + `identityStatus` gating → target `lib/modules/trust/kyc` |
| Dispute bug | legacy `Dispute` vs v2 lifecycle (check model!) → target `lib/modules/trust/disputes` |
| Risk / suspension bug | `assertNotSuspended()` in `lib/mobile-auth.ts` + risk routes → target `lib/modules/trust/risk` |
| Chat bug | chat routes + participant checks → target `lib/modules/communications/chat` |
| Notification not sent | `lib/notifications.ts` (canonical; `notifications-phase10-4.ts` is the merge copy) → target `lib/modules/communications/notifications` |
| Push / outbox retry bug | outbox/retry logic near notifications → target `lib/modules/communications/outbox` |
| SMS/OTP delivery bug | SMS provider infra + OTP routes → target `lib/modules/communications/sms` |
| Pricing wrong quote | `lib/pricing/*` (canonical; `pricing-engine.ts`/`smart-pricing.ts` removed in Phase C) |
| Admin page (CRM UI) bug | `app/admin/**` pages (thin) + `app/api/admin/**` → target `app/(admin)/admin/**` + `lib/modules/admin` |
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
| Mobile API call bug | `apps/mobile/api/*` (Phase E: `api/client.ts` v1 transport, `api/v2-client.ts` v2 transport, domain adapters `api/jobs|quotes|auth|...`; root `lib/api.ts`/`lib/api-v2.ts` = COMPATIBILITY shims, Phase H) |
| Mobile shared UI bug | `apps/mobile/components/` (ui primitives, AISearchBar, ProfileHeader, PropertyCard) |
| Website page / SEO bug | `app/**` pages + `components/**` → target `app/(public)/**` + `components/public` |
| Test fails | `tests/phaseN/**` today → `tests/{unit,integration,concurrency,security,e2e,release-gate}/<domain>` (Phase F) |

## Test ownership (Phase F)

Every implementation area has an obvious home for its tests (see
`restructure/testing-map.md` for the full tree):

| Bug area | Implementation | Tests |
|---|---|---|
| Auth / sessions / JWT | `lib/auth/**` | `tests/auth/` (+ `tests/auth/auth-characterization` guards root shims) |
| RBAC / permissions | `lib/auth/rbac/**`, `lib/admin-rbac.ts` | `tests/rbac/` |
| Security (IDOR, rate limit, isolation, redaction) | `lib/security/**`, route guards | `tests/security/` |
| Escrow | `lib/finance/escrow/**` (job-lifecycle escrow) | `tests/finance/escrow/` |
| Ledger / money | `lib/ledger.ts`, `lib/money` | `tests/finance/ledger/` |
| Payments / webhooks | `lib/payment/**`, `app/api/payments/**` | `tests/finance/payments/` |
| Payouts | `lib/payout-engine.ts` | `tests/finance/payouts/` |
| Commission / fees | job-lifecycle + pricing fees | `tests/finance/` (root files) |
| Pricing | `lib/pricing/**` | `tests/pricing/` |
| Jobs / matching / lifecycle | `lib/matching/**`, `lib/domain/**` | `tests/jobs/` |
| Quotes / change orders | `lib/domain/quotes/**`, v2 quotes routes | `tests/quotes/` |
| Notifications | `lib/notifications*` | `tests/notifications/` |
| Admin review queues | `app/admin/**`, `app/api/admin/**` | `tests/admin/` |
| Company / KYC / invites | company routes + membership services | `tests/company/` |
| Tasker / professions | profession routes + matching eligibility | `tests/tasker/` |
| Mobile app (any feature) | `apps/mobile/features/**` | `tests/mobile/` (lib units; i18n retained under `apps/mobile/lib/i18n/__tests__`) |
| Schema / migrations | `prisma/schema.prisma` | `tests/structural/` |
| Cross-domain flows | multiple | `tests/integration/` |
| Compatibility shims (Phase H) | root shims (`lib/auth-utils.ts`, `lib/admin-rbac.ts`, `lib/notifications.ts`, `apps/mobile/lib/api*.ts`) | `tests/legacy/` + characterization suites — do not delete before Phase H |

Fast discovery: `npx vitest run tests/<domain>/`. The shared DB guard lives in
`tests/helpers/test-guard.ts`.

## Fast lookup commands

```bash
# who calls this module?
grep -rn "from ['\"].*lib/domain/job-lifecycle" --include='*.ts*' app lib components

# which route auth does this use?
grep -rln "authenticateStaffRequest\|requireAdminAuth\|verifyMarketplaceToken" app/api

# is this file dead? (retirement ladder requires more than this)
grep -rn "lib/demand-engine" --include='*.ts*' app lib components tests scripts
```

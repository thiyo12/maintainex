# Where to Fix a Bug

Symptom → owning location. During migration, follow the arrow chain to the current owner
(see `restructure/source-of-truth.md` for canonical vs legacy). Target paths under
`lib/modules/` activate as Phases A–D land; until then the legacy path is authoritative.

| Symptom | Where to fix |
|---|---|
| Login / OTP / session bug (website) | `lib/auth-utils.ts` → target `lib/modules/auth` |
| Login / 2FA / refresh bug (admin) | `lib/admin-jwt.ts` + `app/api/admin/auth/login` → target `lib/modules/admin/auth` |
| Admin route rejects/accepts wrongly (simple-token) | `lib/admin-auth.ts` → Phase D target `lib/modules/auth` |
| Staff session validation bug (7 routes) | `lib/auth/staff-sessions.ts` (`authenticateStaffRequest`) |
| Permission / role / country-scope bug | `lib/admin-rbac.ts` + inline role arrays → target `lib/modules/admin/rbac` |
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
| Mobile screen bug | `apps/mobile/app/**` → logic belongs in `apps/mobile/features/**` (target) |
| Mobile API call bug | `apps/mobile/lib/api.ts` (old) or `api-v2.ts` (new) → target `apps/mobile/api/*` |
| Website page / SEO bug | `app/**` pages + `components/**` → target `app/(public)/**` + `components/public` |
| Test fails | `tests/phaseN/**` today → `tests/{unit,integration,concurrency,security,e2e,release-gate}/<domain>` (Phase F) |

## Fast lookup commands

```bash
# who calls this module?
grep -rn "from ['\"].*lib/domain/job-lifecycle" --include='*.ts*' app lib components

# which route auth does this use?
grep -rln "authenticateStaffRequest\|requireAdminAuth\|verifyMarketplaceToken" app/api

# is this file dead? (retirement ladder requires more than this)
grep -rn "lib/demand-engine" --include='*.ts*' app lib components tests scripts
```

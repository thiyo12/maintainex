# Testing Map — Baseline, Gates, Target Layout

## Frozen baseline (run at `dbae2f73` + baseline fixes, Node v22.14.0)

| Check | Result |
|---|---|
| `npm ci` (root + `apps/mobile`) | PASS (lockfiles unchanged by sync) |
| `npx prisma generate` | PASS |
| `npx prisma validate` | PASS |
| `npx tsc --noEmit` (web) | **PASS after baseline fix** — was 3 pre-existing errors in `tests/phase9/otp-demo-rate-limit.test.ts` (readonly `NODE_ENV`), fixed in `3525dc5c` |
| `npx tsc --noEmit -p apps/mobile/tsconfig.json` | **FAIL — 491 pre-existing errors** (KNOWN BASELINE; 351 × TS2339 missing theme/i18n properties across screens; Expo/Metro never type-checks) |
| `npm run lint` | PASS — 0 errors, 43 pre-existing warnings |
| `npm run build` | PASS |
| `npx vitest run tests` (158 files incl. mobile i18n) | **71 passed / 41 failed / 46 skipped files** → **1184 tests passed / 85 failed / 666 skipped** |

### Known baseline failures (85 tests / 41 files)

By directory: `tests/phase10-5` (16 files), `phase10-1` (10), `phase10-8` (8), `phase7` (7),
`phase10-7` (6), `phase10-6` (2), `phase5f` (2), mobile i18n (2), plus 1 each in
`release-gate/quote-concurrency-postgres`, `phase9/chat-isolation`, `phase4/quote-acceptance`,
`phase10-2/pipeline-10k`, `tests/e2e-fix-batch`.

Failure clusters observed:
1. **i18n locale parity** — `ta`/`si` missing hundreds of keys (parity tests assert `[]`).
2. **Notification creation** — `PrismaClientInitializationError` in `lib/notifications.ts:17`
   under test env (3 occurrences).
3. **Assertion drift** — PIN messaging ("PIN is only available for an accepted job"),
   escrow state ("Job is not in progress"), authorization ("Only the customer can approve"),
   pricing/capability shape mismatches.
4. Local PostgreSQL was reachable (`localhost:5432` open) — failures are **not** connection
   failures.

**Regression rule**: every phase must produce `tests passed ≥ 1184` and
`failed ≤ 85`, and web tsc = 0, mobile tsc ≤ 491, build PASS, prisma validate PASS.
Any new failure vs this file = restructure regression (Section 7 distinction).

## CI

`.github/workflows/phase0-7-validation.yml` is valid (npm ci → prisma → tsc → suites →
build) but **never starts**: GitHub billing failure ("recent account payments have failed").
Local gates are authoritative until billing is resolved.

## Surface gates (Section 32 — required in every phase report)

```
Mobile App:       PASS / FAIL / NOT AFFECTED
Public Website:   PASS / FAIL / NOT AFFECTED
CRM:              PASS / FAIL / NOT AFFECTED
Shared Backend:   PASS / FAIL
Database:         PASS / FAIL / NOT AFFECTED
Security:         PASS / FAIL
Regression:       PASS / FAIL
```

Mobile/Website/CRM deep gates = Sections 33–35 (registration, OTP, PIN flow, payments,
disputes, wallet; homepage/SEO/sitemap; login/2FA/RBAC/360s/work-queue) — executed at
phase boundaries touching those surfaces, using existing suites first, manual/runtime
checks where suites don't exist (runtime checks against the VPS need explicit approval).

## Test layout — ACTUAL (Phase F complete; phase-number directories retired)

```
tests/
├── auth/           authentication, sessions, JWT/refresh/rotation (+ manual usersession.{sh,sql})
├── rbac/           permission boundaries, admin/consistency RBAC
├── security/       idor, rate limits, isolation, redaction, bypass closure, privacy, risk-scoring
├── finance/        commission, fees, financial-audit, money-precision, currency invariants
│   ├── escrow/     escrow concurrency + release
│   ├── ledger/     ledger/money/balance/atomicity + financial-truth-closure (source guard)
│   ├── payments/   payhere, invoice, withdrawal, intent/concurrency (postgres)
│   └── payouts/    payout-engine
├── pricing/        pricing engine/bounds/idempotency/snapshot/zero-config
├── jobs/           matching, scoring, wave, booking, job-pin, gates, pipeline-10k
├── quotes/         quote acceptance/revision/change-order/inspection/line-items + benchmark
├── notifications/  inspection + booking notification suites
├── admin/          audit-rollback, market-config, credential/risk-event review, pdf-generation
├── company/        membership, invites, ownership, KYC, workforce, provider eligibility
├── tasker/         professions, skills, provider suspension/deactivation
├── customer/       customer lifecycle
├── mobile/         apps/mobile lib unit tests (category-icons/identity/payment/quotes)
├── structural/     schema, migration, idempotency-key, deployment-safety guards
├── integration/    cross-domain lifecycle, postgres, persona-switch, canonical integration
├── e2e/            e2e-fix-batch
├── legacy/         backward-compatibility (auth; Phase H decides)
├── helpers/        test-guard (assertNotProductionDb / isPostgres / requiresPostgres)
└── retained in place: apps/mobile/lib/i18n/__tests__ — i18next is a mobile-only dependency
   and their locale imports would surface pre-existing TS1117 errors into the web tsc program
```

Historical phase directories are gone; git history preserves phase attribution.
Discovery invariant: 159 test files / 1960 logical tests before and after Phase F.

## Critical financial tests (Section 37) — coverage inventory

Existing guards: `quotes/quote-concurrency-postgres`, `finance/payments/payment-intent-concurrency-postgres`,
`finance/payments/cancellation-payment-postgres`, `finance/payments/payhere-adapter`,
`finance/payments/payment-work-start-lifecycle`, `quotes/quote-acceptance` (failing baseline),
`finance/payouts/payout-engine` (failing baseline). (Paths = Phase F layout.)
Gaps to add later (own change sets): duplicate refund/release/payout idempotency,
wrong amount/currency webhook, ledger reconciliation, payout failure restoration.
Target tolerances: 0 duplicate charges/refunds/releases/payouts, 0 negative wallet via
concurrency, 0 unexplained ledger difference.

## Security tests (Section 38) — existing

`security/negative-security`, `security/chat-isolation` (failing baseline),
`security/phase10-6-security` (+ `-duplicate`), `security/workforce-security`,
`admin/risk-event-review`, `rbac/admin-country-rbac`, `security/matching-isolation`.
All discoverable under tests/{security,rbac,admin}/ (Phase F paths).


## Phase F status (DONE)

Domain-oriented migration completed from `PHASE_F_START_SHA = da3172aeb2ad61842048e31038fc00dc987d5813`
with **zero test semantic change**: 159/159 files, 1960/1960 tests, 1209/85/666 status counts,
and all 85 failing-test messages identical after path normalization (raw paths changed by design).
Baseline failure clusters above: counts unchanged; directory names updated to Phase F paths.
Retention rules: mobile i18n suites stay under `apps/mobile` (reasons in the layout block);
`legacy/backward-compatibility` is labelled for Phase H. See WHERE-TO-FIX-A-BUG.md for the
implementation → test ownership table.

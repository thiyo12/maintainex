# Migration Map — CURRENT → TARGET → REASON → RISK → TEST (Section 41F)

Phased. Each row (or small row group) = one commit series with the full Section 42 gate.
No move starts until the previous phase's gate is green against the frozen baseline
(see `testing-map.md`).

## Phase A — shared foundations (low risk, no behavior change)

| CURRENT | TARGET | REASON | RISK | TEST |
|---|---|---|---|---|
| `lib/money.ts`, scattered currency helpers | `lib/shared/money/` | one money utility source | low | tsc + finance unit tests |
| ad-hoc error classes / throw shapes in routes | `lib/shared/errors/` (Section 22 taxonomy) | consistent safe HTTP mapping | low | tsc + route tests |
| duplicated validation snippets | `lib/shared/validation/` | single Zod layer | low | tsc |
| rate-limit copies (incl. in `middleware.ts`) | `lib/shared/rate-limit/` | one limiter | med (auth paths) | security suite |

Gate: `tsc` 0 · build PASS · vitest ≥ baseline (1184 passed / 85 failed).

## Phase B — finance (SAFETY-CRITICAL, highest care)

| CURRENT | TARGET | REASON | RISK | TEST |
|---|---|---|---|---|
| `lib/ledger.ts` | `lib/modules/finance/ledger/` | canonical ledger, import-path only at first | med | ledger tests + reconciliation |
| `lib/payment/*` | `lib/modules/finance/payments/` | canonical payments (PayHere adapter) | med | payhere-adapter, webhook tests |
| escrow rules inside `lib/domain/job-lifecycle.ts` (926 ln) | `lib/modules/finance/escrow/` + lifecycle keeps transitions only | ONE escrow system (Section 45); removes duplicate escrow knowledge | **HIGH** | escrow concurrency, cancellation-payment, refund path |
| `lib/payout-engine.ts` | `lib/modules/finance/payouts/` | canonical payouts | med | payout-engine tests (2 known failures baseline) |
| commission calc (in job-lifecycle / engine) | `lib/modules/finance/commission/` | one commission system | med | commission tests |
| 5 legacy Float shadow-wallet writes (audit finding) | wallet application service | no direct balance writes (Section 19) | med | wallet tests |
| `ProviderWallet`/`CustomerWallet` read paths | `WalletBalance` reads via service | one balance source | med | wallet/payout tests |
| `WeeklySettlement` | `CommissionSettlement` path | one settlement system | low | commission tests |

Gate: full vitest + **zero regressions in finance/concurrency suites** + build + tsc.
Known separate work (test-first, not this program): webhook amount/currency verification,
payout RESERVED completion, `mobile/earnings` wrong-model reads, vacuous phase1 finance tests.

## Phase C — communications + pricing consolidation

| CURRENT | TARGET | REASON | RISK | TEST |
|---|---|---|---|---|
| `lib/notifications-phase10-4.ts` (5 importers) | merge into `lib/notifications.ts` → `lib/modules/communications/notifications/` | ONE notification system | low | notifications tests |
| outbox/retry scattered | `lib/modules/communications/outbox/` | one retry path | med | notification retry tests |
| `lib/pricing-engine.ts`, `lib/smart-pricing.ts`, `lib/pricing-countries.ts`, root `pricing-types.ts` (all 0 importers) | retirement ladder → delete (done, Phase C) | REMOVED; pricing suite green pre-delete | low | complete |

## Phase D — auth + RBAC consolidation (Sections 16–17)

| CURRENT | TARGET | REASON | RISK | TEST |
|---|---|---|---|---|
| `lib/auth/staff-{jwt,sessions,rotation}.ts` + `lib/admin-jwt.ts` | `lib/modules/auth/` + `lib/modules/admin/auth/` | ONE staff-auth system: login → 2FA → AdminSession → short access + rotating refresh → permission → country scope → audit | **HIGH** (7 routes + 37 simple-token routes) | auth/security suites, CRM login gate |
| `lib/admin-auth.ts` simple-token (37 routes) | compatibility wrapper over canonical session | one system without breaking routes | **HIGH** | admin route tests |
| unused `createStaffSession`/rotation helpers (0 callers) | retired via ladder | dead code | low | tsc |
| role arrays scattered in routes/pages | `requirePermission`/`can` single source | one RBAC source (Section 17) | **HIGH** | admin-country-rbac, rbac suites |
| `lib/auth-utils.ts` (51) + `lib/mobile-auth.ts` (86) + `marketplace-auth` (24) | `lib/modules/auth/` wrappers, callers migrate gradually | one auth module, no big-bang rewrite | med | all auth tests |
| `middleware.ts` (545 ln duplication) | thin middleware (token parse + rate limit only) | stop re-implementing guards | med | security suites |

Gate: full suite + security tests + no route loses authentication (route-inventory diff).

Phase D execution status: canonical boundary + shims + vocabulary + middleware allowlist DONE
(commits `9a9c9808`..`561f6f5e`); route inventory diff = identical (209 guarded / 47 public, same sets).
Deferred with documented conflicts: mobile↔marketplace verifier unification (`session.isValid`),
middleware verifier delegation (edge runtime + legacy scheme divergence), `createStaffSession`
removal (test-coupled → Phase H), `requirePermission()` route migration (per-route status/payload
variance → incremental).

## Phase E — mobile consolidation (Section 18)

| CURRENT | TARGET | REASON | RISK | TEST |
|---|---|---|---|---|
| `apps/mobile/lib/api.ts` (57 files) + `api-v2.ts` (48) | `apps/mobile/api/{client,auth,jobs,quotes,companies,payments,disputes,notifications,wallet}.ts` | ONE transport client (auth, refresh, requestId, timeout, error normalization, retry, idempotency) | med | mobile tsc + screen-by-screen manual gates |
| fat screens (1329 ln max) | `apps/mobile/features/<domain>/` logic extraction | screens are clients (Section 9A) | med | mobile tsc (baseline 491 — must not grow) |
| `lib/icons.tsx` (0 importers) | retirement ladder | SAFE_TO_REMOVE | low | mobile tsc |

## Phase F — tests reorganization (Section 24)

| CURRENT | TARGET | REASON | RISK | TEST |
|---|---|---|---|---|
| `tests/phaseN/**` (25 dirs, 146 files) | `tests/{unit,integration,concurrency,security,e2e,release-gate}/<domain>/` | find tests by domain/type | low (path moves + config) | counts ≥ baseline: 1184 pass / 85 fail / 666 skip |
| i18n parity failures (ta/si) | fix locales (separate fix commit) | baseline failure → green | low | i18n tests |

## Phase G — surfaces separation (Sections 9, 43)

| CURRENT | TARGET | REASON | RISK | TEST |
|---|---|---|---|---|
| marketing pages in `app/` root | `app/(public)/**` | website surface ownership | **HIGH (URLs/SEO)** | website gate: sitemap, canonical, redirects |
| admin pages | `app/(admin)/admin/**` capability dirs | CRM surface ownership | med | CRM gate |
| admin components | `components/admin/` | shared CRM UI | low | visual/CRM gate |
| public components | `components/public/` | website UI ownership | low | website gate |
| fat admin API routes (50) | thin controllers over `lib/modules/admin/*` | thin routes (Section 13) | med | admin route tests |
| mobile app/api routes (128) | remain; handlers thin; regroup only with compat plan | store-shipped paths are contracts | **HIGH if moved** | mobile gate |

Route-group moves under `app/` are LAST and only with redirect tests.

## Phase H — legacy retirement (Section 40 ladder)

Only after `CALLERS MAPPED → REPLACEMENT READY → CALLERS MIGRATED → READ ONLY →
ZERO CALLERS → TEST PASS`:

candidates (see `legacy-retirement.md`): `job-matcher.ts`, `matching-engine.ts`,
`pricing-engine.ts`, `smart-pricing.ts`, `pricing-countries.ts`, `demand-engine.ts`,
`bi-engine.ts`, `branch-assignment.ts`, `PayoutRequest`, `JobPosting`, old `Dispute`,
`lib/icons.tsx`, `notifications-phase10-4.ts` (after merge).

## Non-goals of this program

- Fixing the known finance bugs (webhook amount verification, payout completion,
  `mobile/earnings` reads) — separate test-first change sets.
- GitHub billing/CI repair (account-level).
- Dependency upgrades (locked at baseline).
- Mobile theme/type debt (491 errors) — recorded baseline; bulk-fix only as its own
  approved task.

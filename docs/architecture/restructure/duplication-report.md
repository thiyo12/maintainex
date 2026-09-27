# Duplication Report (Section 41D)

Measured at baseline `dbae2f73`. "Importers" = files importing the module (statement-level).

## Auth (worst duplication)

Five parallel systems:

| System | File | Importers | Role today |
|---|---|---|---|
| Website session | `lib/auth-utils.ts` | 51 | `getSession()` for legacy website pages/APIs |
| Mobile JWT | `lib/mobile-auth.ts` | 86 | mobile token verify + `assertNotSuspended()` |
| Marketplace v2 | `lib/auth/marketplace-auth.ts` | 24 | v2 marketplace routes |
| Admin simple-token | `lib/admin-auth.ts` | 37 | HMAC `admin_token` cookie check — biggest admin guard |
| Admin JWT/2FA | `lib/admin-jwt.ts` | 5 | login/refresh/2FA issuance; login route creates `AdminSession` directly |

Staff subsystem detail:
- `lib/auth/staff-sessions.ts`: `authenticateStaffRequest` guards **7 admin routes**
  (service-requirements, professions, professions/submissions, companies/[id]/verification).
  It reads `AdminSession` rows created by the JWT login flow → **functioning**.
- `createStaffSession()` has **0 callers**; rotation helpers have **~0 callers**
  (`staff-rotation.ts` imported by 2 files — verify non-app usage) → orphaned scaffolding.
- `staff-jwt.ts` imported by 1 file.

`middleware.ts` (545 lines) re-implements JWT verify + simple-token + rate limiting —
a third/fourth copy of guard logic.

**Decision**: one staff-auth system (Section 16 target flow), one customer auth module,
one permission checker. Migrate by wrappers, not by deletion.

## RBAC

- Backend: role checks inlined per admin route + `lib/admin-rbac.ts` (audit + session bits).
- Frontend: page-level role arrays in admin pages.
- No single permission source; no `can()` helper shared with backend.

**Decision**: `lib/modules/admin/rbac/` single permission vocabulary; `requirePermission()`
backend, `can()` frontend; country scope server-side.

## Mobile APIs

| Client | Importers | Notes |
|---|---|---|
| `apps/mobile/lib/api.ts` | 57 files | older transport |
| `apps/mobile/lib/api-v2.ts` | 48 files | newer transport |

Overlapping endpoint coverage; inconsistent auth refresh/error handling between them.

**Decision**: `api-v2` semantics → split `apps/mobile/api/*` per domain; migrate
screen-by-screen; retire `api.ts` last.

## Jobs

- **Models**: `MarketplaceJob` (canonical, v2) vs legacy `JobPosting` still in schema.
- **Logic**: `lib/domain/job-lifecycle.ts` (926 ln, 17 importers) owns BOTH job state
  transitions AND escrow operations — the single biggest architectural fusion.
- Legacy booking path was disabled outside escrow lifecycle by sync'd commit `8c50f1de`.

**Decision**: split → transitions to `lib/modules/marketplace/jobs`, escrow to
`lib/modules/finance/escrow`. Keep `JobPosting` READ_ONLY until data migration decided.

## Finance

- Escrow logic lives in **job-lifecycle** AND `lib/ledger.ts` (`postEscrowDeposit/Release/
  Refund`) AND payment routes — three places that know escrow rules.
- Canonical flow target (Section 19): Quote → PaymentIntent → Gateway → Escrow → Ledger →
  Commission → WalletBalance → Payout.
- Audit findings (separate remediation, recorded): webhook does not verify amount/currency
  vs escrow; 5 legacy Float shadow-wallet writes; 3 vacuous phase1 finance tests.

**Decision**: ledger+payment services are canonical; escrow extracted from job-lifecycle;
all money writes behind services; no route re-implements rules.

## Wallets

Models: `ProviderWallet`, `CustomerWallet`, `WalletBalance` coexist.
Reads scattered (e.g. `mobile/earnings` reads wrong models — known bug).
**Decision**: `WalletBalance` canonical behind a wallet service; others READ_ONLY.

## Payout

- `Payout` vs `PayoutRequest` models (grep: both present in schema).
- `lib/payout-engine.ts` (4 importers) is the engine; `PayoutRequest` has no meaningful
  callers (verify before retire).
- Known gap: RESERVED payout never completes (finance fix, separate change set).

**Decision**: `Payout` + `payout-engine` canonical; `PayoutRequest` ladder candidate.

## Disputes

- Legacy `Dispute` model vs v2 dispute lifecycle (schema contains both patterns).
- Target: single `MarketplaceDispute` with OPEN → TRIAGED → UNDER_REVIEW →
  REFUND_CUSTOMER | RELEASE_PROVIDER | PARTIAL_SPLIT → RESOLVED, resolving through
  canonical finance services only.

## Notifications

| Impl | Importers | Status |
|---|---|---|
| `lib/notifications.ts` | 18 | CANONICAL |
| `lib/notifications-phase10-4.ts` | 5 | merge into canonical (Phase C) |

Outbox/retry logic scattered; target `lib/modules/communications/{notifications,outbox}`.

## Pricing

| Impl | Importers | Status |
|---|---|---|
| `lib/pricing/*` | 23 | CANONICAL |
| `lib/pricing-engine.ts` | 0 | SAFE_TO_REMOVE (ladder) |
| `lib/smart-pricing.ts` | 0 | SAFE_TO_REMOVE (ladder) |
| `lib/pricing-countries.ts` | 0 | SAFE_TO_REMOVE (ladder) |
| root `lib/pricing-types.ts` | check | align with `lib/pricing/types` |

Note `docs/architecture/pricing-engine.md` documents the old engine — update docs on retire.

## Matching

| Impl | Importers | Status |
|---|---|---|
| `lib/job-matcher.ts` | 0 (statement-level) | verify route-level callers before retire |
| `lib/matching-engine.ts` | 0 — only read as source text by `tests/phase8/negative-security.test.ts` | same |

Route-level usage must be re-verified per route (some routes may `require` dynamically) —
ladder rule applies.

## Other dead-file candidates (0 importers at baseline)

`lib/demand-engine.ts`, `lib/bi-engine.ts`, `lib/branch-assignment.ts`,
`lib/backfill.ts` (verify), `apps/mobile/lib/icons.tsx` (renamed at baseline, 0 importers).

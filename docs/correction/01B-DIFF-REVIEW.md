# Phase 1B — Diff Review

## Exact File Counts (from `git diff --name-only` + `git status --short`)

### Production Code Files Changed: 12

| # | File | Phase 1 Change | Unrelated Refactor | Risk |
|---|---|---|---|---|
| 1 | `app/api/cron/escrow-release/route.ts` | Atomic transaction + idempotency + shared commission | None | LOW |
| 2 | `app/api/files/[...path]/route.ts` | Canonical path traversal protection | None | LOW |
| 3 | `app/api/invoices/[id]/route.ts` | Branch ownership check on PATCH/DELETE | None | LOW |
| 4 | `app/api/mobile/bookings/[id]/route.ts` | Ownership check on GET | None | LOW |
| 5 | `app/api/mobile/conversations/[id]/messages/route.ts` | Participant check on GET | None | LOW |
| 6 | `app/api/mobile/v2/jobs/[id]/cash-payment/route.ts` | Shared commission utility | None | LOW |
| 7 | `app/api/mobile/v2/jobs/[id]/complete/route.ts` | Shared commission utility | None | LOW |
| 8 | `app/api/mobile/v2/jobs/[id]/release-escrow/route.ts` | Shared commission utility | None | LOW |
| 9 | `app/api/mobile/withdraw/route.ts` | Disabled — no safe reversal path | None | LOW |
| 10 | `app/api/upload/cv/route.ts` | PDF magic byte validation | None | LOW |
| 11 | `lib/admin-auth.ts` | Admin session revocation check | None | LOW |
| 12 | `lib/mxid.ts` | `getProviderCommissionRate()` + `computeCommission()` | None | LOW |

### Config Files Changed: 1

| # | File | Change |
|---|---|---|
| 1 | `package.json` | Added `test` and `test:watch` scripts |

### Test Files Changed: 7

| # | File | Tests |
|---|---|---|
| 1 | `tests/phase1/path-traversal.test.ts` | 8 |
| 2 | `tests/phase1/commission.test.ts` | 8 |
| 3 | `tests/phase1/conversation-idor.test.ts` | 3 |
| 4 | `tests/phase1/booking-idor.test.ts` | 3 |
| 5 | `tests/phase1/invoice-branch.test.ts` | 4 |
| 6 | `tests/phase1/withdrawal-safety.test.ts` | 4 |
| 7 | `tests/phase1/escrow-concurrency.test.ts` | 5 |

### Documentation Files Changed: ~30

All files under `docs/correction/` — created or updated.

## Diff Review Per File

No unrelated refactoring detected. No sensitive values added. No legacy code deleted. All changes are targeted Phase 1 security/financial fixes.

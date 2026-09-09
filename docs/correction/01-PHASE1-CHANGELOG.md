# MaintainEX Phase 1 — Changelog

## Summary

Emergency security and financial integrity hotfixes. 10 production code files modified, 6 test files created.

## Changes

### Security Fixes
- `app/api/files/[...path]/route.ts` — Canonical path comparison prevents directory traversal
- `app/api/upload/cv/route.ts` — Server-side PDF magic byte validation
- `app/api/mobile/conversations/[id]/messages/route.ts` — GET handler participant membership check
- `app/api/mobile/bookings/[id]/route.ts` — Booking ownership check (customer or assigned provider)
- `app/api/invoices/[id]/route.ts` — Branch ownership check on PATCH and DELETE
- `lib/admin-auth.ts` — Admin session revocation enforcement via database check

### Financial Fixes
- `lib/mxid.ts` — Added `getProviderCommissionRate()` and `computeCommission()` shared utilities
- `app/api/mobile/v2/jobs/[id]/cash-payment/route.ts` — Fixed commission rate/amount confusion
- `app/api/mobile/v2/jobs/[id]/release-escrow/route.ts` — Uses shared commission utility
- `app/api/mobile/v2/jobs/[id]/complete/route.ts` — Uses shared commission utility
- `app/api/cron/escrow-release/route.ts` — Atomic transaction + idempotent status claim
- `app/api/mobile/withdraw/route.ts` — Atomic balance check + deduction + payout creation

### Test Infrastructure
- `package.json` — Added `test` and `test:watch` scripts
- `tests/phase1/path-traversal.test.ts` — 8 regression tests
- `tests/phase1/commission.test.ts` — 8 regression tests
- `tests/phase1/conversation-idor.test.ts` — 3 regression tests
- `tests/phase1/booking-idor.test.ts` — 3 regression tests
- `tests/phase1/invoice-branch.test.ts` — 4 regression tests
- `tests/phase1/withdrawal-safety.test.ts` — 4 regression tests

### Documentation
- `docs/correction/01-SECRET-ROTATION.md` — Secret rotation report
- `docs/correction/01-SECURITY-FIXES.md` — Security fix details
- `docs/correction/01-FINANCIAL-HOTFIXES.md` — Financial hotfix details
- `docs/correction/01-TEST-RESULTS.md` — Test results
- `docs/correction/01-PHASE1-CHANGELOG.md` — This file
- `docs/correction/00-RISK-REGISTER.md` — Updated with Phase 1 status

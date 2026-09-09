# Phase 1–7 Canonical Integration Prechange Safety

## Snapshot

- **HEAD**: `b813f03` (Phase 7.2)
- **Branch**: `main`
- **Local changes**: 109 unrelated (102 modified, 1 untracked, 6 deleted) — must NOT be staged/committed
- **Date**: 2026-09-09

## Known Legacy Bypasses

### Auth (STEP 1)
- `lib/mobile-auth.ts` exports `authenticateRequest()` — tries canonical marketplace JWT first, then falls back to legacy JWT via `NEXTAUTH_SECRET`.
- 68+ route files import `authenticateRequest` from `@/lib/mobile-auth`.
- `lib/auth/marketplace-auth.ts` exports `authenticateMarketplaceUser()` — canonical only, no legacy fallback.
- 16 route files already use `authenticateMarketplaceUser()` (company routes, quotes, certifications, provider eligibility).
- Login routes already use `createMarketplaceAuthSession()` (canonical).
- Legacy path is gated by `LEGACY_MOBILE_AUTH_CUTOFF` env var — if unset or past cutoff, legacy path is dead code.

### Financial Writers (STEP 2)
- Escrow fund/release/complete routes use inline `prisma.$transaction` with direct wallet `update`/`upsert` and `walletTransaction.create`.
- Canonical ledger exists in `lib/ledger.ts` (double-entry, idempotent, BigInt minor units).
- Canonical domain logic in `lib/domain/job-lifecycle.ts` (`fundEscrow`, `releaseEscrow`, `approveCompletion`).
- Withdrawal route exists but should return 503.

### Lifecycle Wiring (STEP 3)
- Marketplace job lifecycle routes use inline Prisma transactions instead of canonical domain functions from `lib/domain/job-lifecycle.ts`.

### Phase 6 Eligibility (STEP 4)
- `lib/phase6/provider-eligibility.ts` `checkIndividualProviderEligibility()` rejects users with empty `skills` JSON even if `TaskerSkill` relational records exist.
- `checkCompanyEligibility()` rejects companies with empty `services` JSON even if `CompanySpecialty` records exist.

### Matching Routes (STEP 6)
- `app/api/mobile/v2/match/[jobId]/route.ts` imports from `@/lib/job-matching` (legacy Float-based).
- Canonical matching engine in `lib/matching/` (BigInt, capability resolution).

### Pricing Routes (STEP 7)
- `app/api/mobile/v2/pricing/estimate/route.ts` imports from `@/lib/pricing-engine` (legacy Float-based).
- Canonical pricing engine in `lib/pricing/` (BigInt, bounds enforcement).

## Expected Changes

1. Remove legacy JWT fallback from `lib/mobile-auth.ts` or make `authenticateRequest` delegate to canonical.
2. Migrate 68+ routes from `authenticateRequest` to `authenticateMarketplaceUser` (or make `authenticateRequest` canonical-only).
3. Wire escrow/release/complete routes to canonical `lib/domain/job-lifecycle.ts` + `lib/ledger.ts`.
4. Wire marketplace lifecycle routes to canonical domain functions.
5. Fix Phase 6 eligibility to check `TaskerSkill`/`CompanySpecialty` relational records.
6. Migrate matching routes from `@/lib/job-matching` to `@/lib/matching`.
7. Migrate pricing routes from `@/lib/pricing-engine` to `@/lib/pricing`.
8. Neutral explanation wording for unknown availability/travel.
9. Job creation validation for required fields.
10. API money safety — no Float, no `Math.random()`.
11. Withdrawal route → 503.
12. Integration tests for auth, financial, lifecycle, matching, pricing.
13. Regression — full test suite passes.
14. Call graph audit — no legacy imports remain.
15. Legacy bypass audit — `authenticateRequest` removed or canonical-only, no `NEXTAUTH_SECRET` in production paths.
16. Git safety — commit only closure files.
17. Deploy to production.

## Rollback Plan

If any step breaks production:
1. Revert the specific commit for that step.
2. Run `npx prisma migrate deploy` on VPS if schema changed.
3. Redeploy with previous image.

# Legacy Retirement — Classification & Ladder (Section 40)

## The ladder (every retirement walks ALL steps)

```
ACTIVE
→ CALLERS MAPPED
→ REPLACEMENT READY
→ CALLERS MIGRATED
→ READ ONLY
→ ZERO CALLERS
→ TEST PASS
→ REMOVE
```

Rules:
- Never delete because code "looks outdated".
- Deleting requires: caller-map evidence, green tests, a commit of its own,
  and an entry in this file moving to REMOVED.
- Protected local files are never candidates: `.env*`, `apps/mobile/.env`, `AGENTS.md`,
  `prisma/schema.prisma.local.bak`, `uploads/`, certificates, keys, backups.

## Classification register

| Artifact | Class | Evidence | Next step |
|---|---|---|---|
| `lib/pricing-engine.ts` | REMOVED | 0 importers; pricing suite green pre-delete | done (Phase C removal commit) |
| `lib/smart-pricing.ts` | REMOVED | 0 importers; pricing suite green pre-delete | done (Phase C removal commit) |
| `lib/pricing-countries.ts` | REMOVED | 0 importers; pricing suite green pre-delete | done (Phase C removal commit) |
| root `lib/pricing-types.ts` | REMOVED | 0 importers; pricing suite green pre-delete | done (Phase C removal commit) |
| `lib/demand-engine.ts` | SAFE_TO_REMOVE | 0 importers | same |
| `lib/bi-engine.ts` | SAFE_TO_REMOVE | 0 importers | same |
| `lib/branch-assignment.ts` | SAFE_TO_REMOVE | 0 importers | same |
| `apps/mobile/lib/icons.tsx` | SAFE_TO_REMOVE | 0 importers; JSX-in-ts bug fixed by rename | mobile-phase candidate |
| `createStaffSession` + unused rotation helpers | MIGRATION_REQUIRED → REMOVE (ladder-blocked) | 0 production callers; login creates sessions directly; BUT phase3 unit tests cover them — deletion would change frozen test identity | Phase D: classified; remove in Phase H together with test restructuring |
| `lib/notifications-phase10-4.ts` | COMPATIBILITY (shim) | merged into `lib/notifications/` (Phase C); 4 route importers + 1 test mock still on shim path | retire shim in Phase H |
| `lib/job-matcher.ts`, `lib/matching-engine.ts` | MIGRATION_REQUIRED | 0 statement-level importers; source-string assertions in `tests/phase8/negative-security.test.ts`; referenced in `docs/correction/00-MARKETPLACE-GENERATIONS.md` | map route-level callers (dynamic require?) → rewrite test assertions → remove |
| `lib/admin-auth.ts` (simple-token) | COMPATIBILITY (Phase D: root file is now a re-export shim; impl at `lib/auth/authentication/admin-auth.ts`) | 37 live admin routes | supersede with staff-session system, then ladder |
| `lib/mobile-auth.ts` | COMPATIBILITY (Phase D: root file is now a re-export shim; impl at `lib/auth/compatibility/mobile-auth.ts`) | 86 live importers | gradual migrate to marketplace-auth/module |
| `lib/auth-utils.ts` | COMPATIBILITY (Phase D: root file is now a re-export shim; impl at `lib/auth/authentication/auth-utils.ts`) | 51 importers | migrate gradually |
| `lib/admin-jwt.ts`, `lib/admin-rbac.ts` | COMPATIBILITY (Phase D: root files are re-export shims; impls at `lib/auth/authentication/admin-jwt.ts`, `lib/auth/authorization/admin-rbac.ts`) | 5 + 22 importers | retire shims in Phase H |
| `createSimpleToken` | SAFE_TO_REMOVE_LATER | 0 callers (issuer of legacy 2-part HMAC-hex tokens) | ladder; needs legacy-scheme decision first (see source-of-truth admin-simple-token conflict) |
| `adminAuthorize`, `getSessionFromCookie` (`admin-rbac`) | SAFE_TO_REMOVE_LATER | 0 callers | ladder (Phase H) |
| `requireMarketplaceAuth` | SAFE_TO_REMOVE_LATER | 0 callers | ladder (Phase H) |
| `revokeStaffTokenFamily`, `isStaffTokenClaims` | SAFE_TO_REMOVE_LATER | 0 callers | ladder (Phase H) |
| `apps/mobile/lib/api.ts`, `lib/api-v2.ts` | COMPATIBILITY (Phase E: explicit exact-set shims over `apps/mobile/api/*`) | 57 + 49 mobile callers | migrate callers to `@/api/<domain>`, then remove (Phase H) |
| `apps/mobile/lib/icons.tsx` | SAFE_TO_REMOVE | 0 importers (Phase E: verified, left in place) | Phase H |
| `apps/mobile/components/CountryChangeBanner.tsx`, `components/shared/BottomNav.tsx`, `components/ui/{BottomNav,Button,Card,CategoryPills,LoadingScreen,Logo,PhotoUploader,PremiumCard,ProgressSteps,SafeContainer,ScreenHeader,SuccessAnimation}.tsx` | SAFE_TO_REMOVE | 0 importers (Phase E verified) | Phase H |
| `apps/mobile/features/jobs/components/*`, `features/offers/components/*` | SAFE_TO_REMOVE (moved from `components/{jobs,offers}`, still 0 importers) | 0 importers | Phase H |
| Root auth shims (`lib/auth-utils.ts`, `lib/admin-auth.ts`, `lib/admin-rbac.ts`, …) | COMPATIBILITY (Phase D) | `tests/auth/auth-characterization.test.ts` + `tests/rbac/admin-rbac*.test.ts` (characterization guards) | migrate callers, retarget characterization to `lib/auth/*` canonical, then remove (Phase H) |
| `lib/notifications.ts` + merge copy (`notifications-phase10-4.ts`) | COMPATIBILITY | `tests/notifications/{inspection,booking}-notifications.test.ts` import `@/lib/notifications` | retarget tests to `lib/notifications/*` canonical when shim retires (Phase H) |
| `apps/mobile/lib/api.ts`, `lib/api-v2.ts` (COMPATIBILITY shims, Phase E) | COMPATIBILITY | exercised indirectly via suites importing `@/lib/api*` (`tests/e2e/e2e-fix-batch`, payment suites) | migrate callers to `@/api/*`, retarget, remove (Phase H) |
| Auth backward-compatibility behavior | COMPATIBILITY | `tests/legacy/backward-compatibility.test.ts` (labelled legacy) | delete only together with the compatibility behavior it proves (Phase H) |
| `JobPosting` model | READ_ONLY_LEGACY | legacy data path | data migration decision (out of scope) |
| old `Dispute` model | READ_ONLY_LEGACY | superseded by v2 lifecycle | data migration decision |
| `ProviderWallet` / `CustomerWallet` | MIGRATION_REQUIRED | wallet reads | migrate to `WalletBalance` service |
| `WeeklySettlement` | MIGRATION_REQUIRED | superseded by `CommissionSettlement` | migrate then ladder |
| `PayoutRequest` | MIGRATION_REQUIRED | verify 0 callers | ladder if confirmed |
| `PayoutRequest`-era payout UI routes | COMPATIBILITY | verify per-route | migrate then thin |
| legacy booking path (mobile) | READ_ONLY_LEGACY | disabled outside escrow by `8c50f1de` | keep disabled; retire later |
| `docs/correction/*` (~160 audit docs) | READ_ONLY_LEGACY | historical record | reference only; never duplicate their content |

## Retirement checklist (per removal commit)

1. `grep -rn "<symbol>" --include='*.ts*' app lib components apps tests scripts` —
   include dynamic `require(`/`import(` patterns.
2. Route-level check for any handler importing it indirectly.
3. Tests that read source text (`readFileSync`) rewritten or removed.
4. Related docs updated (`docs/architecture/*`, `docs/correction/*` pointers).
5. Full gate: tsc (web 0 / mobile ≤491 baseline) + build + vitest ≥ baseline.
6. Commit: `refactor(<domain>): remove <artifact> after zero-caller verification`.

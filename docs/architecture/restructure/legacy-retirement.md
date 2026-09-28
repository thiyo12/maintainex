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
| `lib/demand-engine.ts` | REMOVED | 0 importers | done (Phase H, `b642bad3`) |
| `lib/bi-engine.ts` | REMOVED | 0 importers | done (Phase H, `b642bad3`) |
| `lib/branch-assignment.ts` | REMOVED | 0 importers | done (Phase H, `b642bad3`) |
| `apps/mobile/lib/icons.tsx` | REMOVED | 0 importers | done (Phase H, `a7530c6f`) |
| `createStaffSession` + unused rotation helpers | DEFERRED_AFTER_H | 0 production callers; sole session-creation helper for DB tests of revoke/getActive — deletion would lose security coverage | ladder-blocked: needs test restructuring beyond Phase H scope |
| `lib/notifications-phase10-4.ts` | REMOVED | 4 v2 routes + 1 test migrated to `@/lib/notifications` in Phase H (`afc6ebd0`) | done |
| `lib/job-matcher.ts`, `lib/matching-engine.ts` | REMOVED | 0 importers; `tests/security/negative-security.test.ts` country-filter assertions retargeted to canonical `lib/matching/index.ts` (same DB-level property) | done (Phase H, `b642bad3`) |
| `lib/admin-auth.ts` (simple-token) | REMOVED as shim (impl at `lib/auth/authentication/admin-auth.ts` kept — 37 live admin routes) | Phase H `c9db65a8` migrated all 37 | supersede with staff-session system, then ladder the impl |
| `lib/mobile-auth.ts` | REMOVED as shim (impl at `lib/auth/compatibility/mobile-auth.ts` kept — 89 live importers) | Phase H `c9db65a8`; `session.isValid` divergence from marketplace-auth = DEFERRED_AFTER_H | gradual migrate to marketplace-auth/module |
| `lib/auth-utils.ts` | REMOVED as shim (impl at `lib/auth/authentication/auth-utils.ts` kept — 52 importers now canonical) | Phase H `c9db65a8` | migrate gradually |
| `lib/admin-jwt.ts`, `lib/admin-rbac.ts` | REMOVED as shims (impls canonical at `lib/auth/{authentication/admin-jwt,authorization/admin-rbac}.ts`) | Phase H `c9db65a8`: 5 + 24 importers migrated | done |
| `createSimpleToken` | SAFE_TO_REMOVE_LATER | 0 callers (issuer of legacy 2-part HMAC-hex tokens) | ladder; needs legacy-scheme decision first (see source-of-truth admin-simple-token conflict) |
| `adminAuthorize`, `getSessionFromCookie` (`admin-rbac`) | REMOVED | 0 code refs re-verified pre-delete | done (Phase H, `c9db65a8`) |
| `requireMarketplaceAuth` | REMOVED | 0 code refs re-verified pre-delete | done (Phase H, `c9db65a8`) |
| `revokeStaffTokenFamily`, `isStaffTokenClaims` | REMOVED | 0 code refs re-verified pre-delete | done (Phase H, `c9db65a8`) |
| `apps/mobile/lib/api.ts`, `lib/api-v2.ts` | REMOVED | 114 call sites migrated to `@/api/<domain>` (incl. 3 dynamic imports + 4 relative forms) | done (Phase H, `a7530c6f`) |
| `apps/mobile/lib/icons.tsx` | SAFE_TO_REMOVE | 0 importers (Phase E: verified, left in place) | Phase H |
| `apps/mobile/components/CountryChangeBanner.tsx`, `components/shared/BottomNav.tsx`, `components/ui/{BottomNav,Button,Card,CategoryPills,LoadingScreen,Logo,PhotoUploader,PremiumCard,ProgressSteps,SafeContainer,ScreenHeader,SuccessAnimation}.tsx` | REMOVED | 0 importers re-verified by import-statement scan (no barrels) | done (Phase H, `a7530c6f`) |
| `apps/mobile/features/{jobs,offers}/components/*` dead clusters (9 files: CategoryChip, JobCard, QuoteCard, BookingSheet, CategoryGrid, FindingTaskerScreen, OfferCard, OfferProgramSection, SeasonalOffers) | REMOVED | 0 importers (live `features/customer/components/JobCard` untouched) | done (Phase H, `a7530c6f`) |
| Root auth shims (`lib/auth-utils.ts`, `lib/admin-auth.ts`, `lib/admin-jwt.ts`, `lib/admin-rbac.ts`, `lib/mobile-auth.ts`) | REMOVED | 207 specifiers across 184 files migrated to `lib/auth/*` canonical; pdf-generation vi.mock retargeted | done (Phase H, `c9db65a8`) |
| `lib/notifications.ts` + merge copy (`notifications-phase10-4.ts`) | REMOVED | 26 importers auto-resolved to `lib/notifications/index.ts` (directory import); notifications tests identity exact | done (Phase H, `afc6ebd0`) |
| `apps/mobile/lib/api.ts`, `lib/api-v2.ts` (COMPATIBILITY shims, Phase E) | REMOVED | see above | done (Phase H, `a7530c6f`) |
| Auth backward-compatibility behavior | COMPATIBILITY (kept) | `tests/legacy/backward-compatibility.test.ts` proves live legacy behavior — behavior itself is still production truth | DEFERRED_AFTER_H: retire together with the behavior, never before |
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

## Phase H execution record (H1–H9 complete; verdict after H10 final regression)

Branch `architecture/10of10-restructure`, start `960d2b8e`, commits:

| Commit | Batch | Retired |
|---|---|---|
| `e3540c60` | H2 shared | 5 shims (`lib/{money,currency-format,utils,phone,bigint-polyfill}.ts`-style root files) → `lib/shared/*` (59 specifiers, 46 files) |
| `afc6ebd0` | H3 notifications | `lib/notifications.ts` + `lib/notifications-phase10-4.ts` → `lib/notifications/index.ts` |
| `187ce68d` | H4 finance | `lib/ledger.ts` + `lib/payout-engine.ts` → `lib/finance/{ledger/ledger-service,payouts/payout-engine}`; job-lifecycle escrow re-exports removed (8 routes + 4 test files import canonical) |
| `c9db65a8` | H5 auth | 5 root auth shims → `lib/auth/*` canonical (207 specifiers); 5 dead functions removed (`adminAuthorize`, `getSessionFromCookie`, `requireMarketplaceAuth`, `revokeStaffTokenFamily`, `isStaffTokenClaims`) |
| `a7530c6f` | H6 mobile | `apps/mobile/lib/{api,api-v2}.ts` → `@/api/<domain>` (114 sites); 24 dead component files + `lib/icons.tsx` removed |
| `b642bad3` | H7+H8 | negative-security country-filter tests retargeted to `lib/matching/index.ts`; 9 dead prod files removed (`lib/{admin-audit,admin-schemas,backfill,bi-engine,branch-assignment,demand-engine,property-search,matching-engine,job-matcher}.ts`) |

DEFERRED_AFTER_H (kept deliberately, reasons recorded above):
`createStaffSession` + rotation helpers (DB-test security coverage),
`rotateStaffTokenFamily` replay tests, `createSimpleToken` (legacy-scheme decision first),
mobile-auth `session.isValid` divergence, middleware legacy verifier (edge runtime),
`lib/auth/compatibility/mobile-auth.ts` caller base (89), `lib/pricing.ts` (2 live importers),
`lib/auth/index.ts` barrel (canonical doc anchor), `docs/correction/*` (historical).

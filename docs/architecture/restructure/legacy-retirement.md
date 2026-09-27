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
| `lib/pricing-engine.ts` | SAFE_TO_REMOVE | 0 importers | confirm → ladder step "TEST PASS" → remove (Phase C/H) |
| `lib/smart-pricing.ts` | SAFE_TO_REMOVE | 0 importers | same |
| `lib/pricing-countries.ts` | SAFE_TO_REMOVE | 0 importers | same |
| `lib/demand-engine.ts` | SAFE_TO_REMOVE | 0 importers | same |
| `lib/bi-engine.ts` | SAFE_TO_REMOVE | 0 importers | same |
| `lib/branch-assignment.ts` | SAFE_TO_REMOVE | 0 importers | same |
| `apps/mobile/lib/icons.tsx` | SAFE_TO_REMOVE | 0 importers; JSX-in-ts bug fixed by rename | mobile-phase candidate |
| `createStaffSession` + unused rotation helpers | MIGRATION_REQUIRED → REMOVE | 0 callers; login creates sessions directly | remove with Phase D auth consolidation |
| `lib/notifications-phase10-4.ts` | MIGRATION_REQUIRED | 5 importers → merge | Phase C merge, then remove |
| `lib/job-matcher.ts`, `lib/matching-engine.ts` | MIGRATION_REQUIRED | 0 statement-level importers; source-string assertions in `tests/phase8/negative-security.test.ts`; referenced in `docs/correction/00-MARKETPLACE-GENERATIONS.md` | map route-level callers (dynamic require?) → rewrite test assertions → remove |
| `lib/admin-auth.ts` (simple-token) | COMPATIBILITY | 37 live admin routes | supersede in Phase D, then ladder |
| `lib/mobile-auth.ts` | COMPATIBILITY | 86 live importers | gradual migrate to marketplace-auth/module |
| `lib/auth-utils.ts` | READ_ONLY_LEGACY (website) | 51 importers | wrap, migrate gradually |
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

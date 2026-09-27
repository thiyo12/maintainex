# MaintainEX Restructure — Program Hub

Status: **PHASE 0 COMPLETE (Steps 1–7)** — baseline frozen, reports written, no production code moved yet.

Branch: `architecture/10of10-restructure` (never restructure on `main`, never force-push `main`).
Base: `origin/main` = `dbae2f73` + 4 pre-restructure commits (gitignore recovery, baseline fixes).

## What this program is

Restructure the existing repository into a professional modular monolith with three clearly
separated product surfaces (Mobile App, Public Website, CRM/Admin) over ONE canonical backend.
No rebuild, no second project, no deletion of legacy code before migration + tests.

## Documents

| Doc | Purpose |
|---|---|
| [current-repository-map.md](./current-repository-map.md) | Where everything lives today (Section 41C) |
| [target-architecture.md](./target-architecture.md) | Target tree for the three surfaces + `lib/modules` |
| [source-of-truth.md](./source-of-truth.md) | One canonical implementation per subsystem (Section 41E) |
| [module-boundaries.md](./module-boundaries.md) | Layer rules, import rules, ownership |
| [migration-map.md](./migration-map.md) | Every planned move: CURRENT → TARGET → REASON → RISK → TEST (Section 41F) |
| [duplication-report.md](./duplication-report.md) | Auth, mobile APIs, finance, wallets, payouts, disputes, notifications, pricing (Section 41D) |
| [legacy-retirement.md](./legacy-retirement.md) | Classification + retirement ladder for old systems |
| [testing-map.md](./testing-map.md) | Current tests, baseline numbers, target test layout |
| [file-recovery.md](./file-recovery.md) | What was recovered from GitHub and why it was missing |
| [../WHERE-TO-FIX-A-BUG.md](../WHERE-TO-FIX-A-BUG.md) | Symptom → owning module quick index |

Related existing docs (do not duplicate): `docs/architecture/*` (api-reference, authentication,
data-model, financial-ledger, matching-engine, pricing-engine, testing-strategy, security-layers),
`docs/correction/*` (~160 prior audit documents).

## Rules of engagement (non-negotiable)

1. Local folder stays `/Users/thiyoth/Documents/NEWM/maintainex`. No second project.
2. `origin/main` is source of truth. Compare before overwriting anything.
3. Protected local files are never deleted or committed: `.env`, `apps/mobile/.env`,
   `AGENTS.md`, `prisma/schema.prisma.local.bak`, `uploads/`, certificates, keys, backups.
   Never print secret values. Never `git clean -fdx`.
4. No `prisma db push` / destructive DB commands against production. No production data in tests.
5. Legacy code is deleted only through the retirement ladder in `legacy-retirement.md`.
6. Every move: map callers → smallest safe unit → tsc → build → affected tests → regression →
   docs → commit. Never one giant restructuring commit.
7. Financial code is safety-critical (Section 19): no route re-implements escrow/ledger rules.
8. Phase completion requires the full Section 42 gate. Build ≠ complete.

## Progress tracker

- [x] Step 1 — local/GitHub synchronization (HEAD == origin/main == `dbae2f73`)
- [x] Step 2 — file recovery (16/16 restored; gitignore root-cause fixed; orphaned admin security-logs route force-added)
- [x] Step 3 — cleanup classification (nothing untracked; `.next`/`.expo` caches cleared; protected files preserved)
- [x] Step 4 — install exact lockfiles (`npm ci` root + mobile)
- [x] Step 5 — baseline validation (see `testing-map.md` for numbers)
- [x] Step 6 — repository inventory + duplication/source-of-truth reports
- [x] Step 7 — restructure map + these documents
- [x] Step 8 — branch `architecture/10of10-restructure` created and pushed
- [ ] Phase A — `lib/shared/*` extraction
- [ ] Phase B — finance module (escrow out of job-lifecycle, ledger canonical)
- [ ] Phase C — notifications merge, pricing retirement
- [ ] Phase D — staff-auth consolidation + one RBAC permission source
- [ ] Phase E — mobile API consolidation + `features/` extraction
- [ ] Phase F — tests reorganization by type/domain
- [ ] Phase G — CRM capability dirs + thin route controllers
- [ ] Phase H — legacy retirement (only through the ladder)

## Environment baseline (frozen)

```
SHA:            dbae2f73 (+4 pre-restructure commits on branch)
Node:           v22.14.0
npm:            10.8.2
Next.js:        15.5.24
Prisma client:  ^5.14.0 (provider postgresql)
Expo:           ^56.0.12 / React Native 0.85.3
CI (GitHub):    RED — billing block ("recent account payments have failed");
                workflow itself is valid. Local gates are authoritative.
```

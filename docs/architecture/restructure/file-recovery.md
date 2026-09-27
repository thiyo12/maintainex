# File Recovery Log (Section 41 items 1–2, prompt Section 5)

## What happened

Local `main` was 253 commits behind `origin/main` (0 local commits, clean tree → fast
fast-forward). All missing tracked files existed on `origin/main`; the sync recovered them
by `git reset --hard origin/main` (equivalent to `git restore --source=origin/main -- *`
across the full delta, with 0 local work at risk).

Sync verification:
```
HEAD            == dbae2f73bb86ef6c49a69478b5db82cfbac8bc11
origin/main     == dbae2f73bb86ef6c49a69478b5db82cfbac8bc11
git diff        == empty
git status      == clean
```

## Files that were missing locally (16/16 recovered)

```
app/api/payments/payhere/[intentId]/route.ts
app/api/payments/payhere/cancel/route.ts
app/api/payments/payhere/return/route.ts
app/api/mobile/company/context/route.ts
lib/domain/job-lifecycle-audit.ts
apps/mobile/app/(tasker)/company-assignments.tsx
apps/mobile/app/company-invite.tsx
prisma/migrations/20260926010000_release_gate_quote_uniqueness/migration.sql
prisma/migrations/20260926020000_release_gate_payment_intent_unique/migration.sql
prisma/migrations/20260926030000_release_gate_job_lifecycle_audit/migration.sql
tests/phase10-5/payhere-adapter.test.ts
tests/phase10-5/payment-work-start-lifecycle.test.ts
tests/release-gate/cancellation-payment-postgres.test.ts
tests/release-gate/payment-intent-concurrency-postgres.test.ts
tests/release-gate/persona-switch.test.ts
tests/release-gate/quote-concurrency-postgres.test.ts
```

94 further files were brought up to origin/main state (29 `app/api/mobile`, 27
`apps/mobile/app`, `prisma/schema.prisma`, `lib/payment/*`, `lib/notifications.ts`, 16 tests).

## The gitignore bug (root-cause fix, commit `b00f221f` + `da139852`)

`app/api/admin/security/logs/route.ts` (68 lines; called by
`app/(web)/admin/analytics/security/page.tsx`) existed **only in the local working tree** —
absent from `origin/main` AND from local `HEAD`. Cause: `.gitignore` line 56 was `logs/`
(matched ANY `logs/` directory, including `app/api/admin/security/logs/`). The rule existed
on both sides, so the route could never be committed from any machine.

Fix:
1. `.gitignore`: `logs/` → `/logs/` (root-scoped only).
2. `git add -f app/api/admin/security/logs/route.ts` → now tracked.

Verified no other files became unignored by the narrowing (status delta = exactly 2 entries).

## Baseline fix commits on the branch (pre-restructure)

```
b00f221f fix(repo): narrow logs/ ignore rule so admin security logs route is tracked
da139852 chore(repo): scope logs/ ignore rule to repository root
8d237f27 fix(mobile): rename icons.ts to icons.tsx so JSX parses
3525dc5c test(phase9): type-allow NODE_ENV mutation in otp rate-limit test
```

Notes on the last two:
- `icons.ts` had JSX with a `.ts` extension; its **parse errors suppressed all semantic
  checking** in the mobile program (54 reported errors pre-rename vs 491 real post-rename).
  Renamed (preserved, zero importers) instead of deleted per the retirement ladder.
- The `NODE_ENV` casts are test-only; web tsc went 3 → 0 errors.

## Cleanup classification (prompt Section 3)

- `git clean -fdn` → empty (0 untracked non-ignored files). `git clean -fdx` never used.
- Removed stale generated caches only: `.next/` (452 MB), `apps/mobile/.expo/` (5.6 MB).
- Preserved: `.env`, `apps/mobile/.env`, `AGENTS.md`, `prisma/schema.prisma.local.bak`,
  `uploads/`, `node_modules` (refreshed via `npm ci`), `apps/mobile/node_modules` (`npm ci`).

## Completeness verification (prompt Section 5)

Top-level areas present: `app/ apps/ components/ lib/ prisma/ tests/ docs/ scripts/
public/ .github/ package.json`. Systems present: Customer/Tasker/Company surfaces, public
website, CRM, auth, jobs, quotes, matching, scheduling, chat, payments, escrow, ledger,
commission, wallet, payout, KYC, disputes, notifications, company workforce, admin RBAC,
audit, security (see `current-repository-map.md`).

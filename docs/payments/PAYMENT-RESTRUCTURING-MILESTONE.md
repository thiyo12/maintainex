# Payment restructuring milestone

Updated: 2026-10-25

Branch: `feature/payment-restructuring`

Starting head: `956fd471fdcbafdf3d2c4494005598d73b48d3a7`

## Verified in this milestone

- Hardened `scripts/bootstrap-fresh-database.sh`: it now refuses existing public relations and Prisma migration history, installs the current Prisma schema and versioned PostgreSQL-only invariants before resolving historical migration records, fails on any resolution error, verifies deploy/status, and checks the successful migration count.
- Removed the unsafe `SKIP_BASELINE_SQL` bypass and avoided modifying the developer's Prisma schema during bootstrap.
- Moved the CI baseline setup to the same checked-in bootstrap procedure and recorded the migration compatibility policy in `docs/architecture/database-migrations.md`.
- Added structural regression checks for the empty-database guard, invariant ordering, error propagation, and CI reuse.
- Cash collection contests now create or link the canonical `MarketplaceDispute` for the job and route the Support alert to that case. No commission is posted on contest; the immutable lifecycle event remains the dispute evidence.

## Test evidence

- Focused bootstrap and raw-invariant regression tests: 9 passed.
- Cash collection and lifecycle regression tests after case linking: 12 passed.
- `npx prisma validate`: passed.
- Prisma baseline SQL generation: passed (5,329 lines generated from the current schema).
- Root TypeScript check: passed.
- `bash -n scripts/bootstrap-fresh-database.sh` and `git diff --check`: passed.
- Isolated PostgreSQL execution of the bootstrap was attempted locally but could not start in the sandbox because PostgreSQL shared-memory setup is denied. Exact-head CI is exercising the full PostgreSQL procedure.

Previously verified at `956fd471fdcbafdf3d2c4494005598d73b48d3a7`: full regression 4,547 passed / 100 environment-gated skips, financial suite 402 passed / 4 skipped, production build and all three exact-head GitHub Actions workflows passed.

## Still open

- Persistent Admin bank-statement import and commission reconciliation workflow.
- Full financial case assignment, correction, appeal, and resolution workflows.
- Provider-neutral external evidence state machines and reconciliation for refunds and payouts. Transfers remain disabled until bank/PSP arrangements are approved.
- Clean bootstrap execution on isolated PostgreSQL for this milestone's exact head; direct replay of historical migrations remains invalid because of the pre-baseline `User` reference. Existing databases must continue to use `prisma migrate deploy`.
- Provider selection, human approvals, and physical/operational tests.

No production data, users, provider credentials, live payments, deployments, or merges were used.

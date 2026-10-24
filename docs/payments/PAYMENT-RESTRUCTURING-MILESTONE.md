# Payment restructuring milestone

Updated: 2026-10-25

Branch: `feature/payment-restructuring`

Starting head: `956fd471fdcbafdf3d2c4494005598d73b48d3a7`

Previously verified implementation head: `6b0d84edda7892f304fdf56f23f468acd273d05b`

## Current bank-reconciliation implementation (verification pending)

- Added durable PostgreSQL models and an additive migration for statement imports, normalized bank transactions, reconciliation proposals, FIFO debt allocations, and append-only audit events. The clean-bootstrap invariants mirror the migration's amount/provenance checks and append-only triggers.
- Added a country-scoped Admin statement import queue and page. It stores normalized rows and a SHA-256 digest, not the uploaded JSON file. Imported evidence remains `UNVERIFIED`; screenshots or typed references cannot change balances.
- Added a provider-neutral HMAC callback contract for an independently authenticated bank source. It requires `MAINTAINEX_BANK_EVIDENCE_SOURCE` and a 32+ character `MAINTAINEX_BANK_EVIDENCE_HMAC_SECRET`, signs the exact raw JSON body with SHA-256, and rejects callbacks older than five minutes. No source is configured or active.
- Added exact reference/debtor/market validation, a separate maker-checker approval request, and a balanced idempotent ledger recovery that allocates partial remittances oldest-first to the Tasker or legal Company identity. Bank transactions, allocations, and case events cannot be duplicated by replay.
- No bank connection, PSP, or production credential was selected or configured. Authenticated source evidence and isolated-PostgreSQL execution remain required before this path can be verified end to end.

The verification callback body is `{ "sourceSystem": "…", "statementId": "…", "contentSha256": "…", "verificationRef": "…", "timestamp": 1792890000000 }`. The caller sends `X-MaintainEX-Signature: sha256=<hex HMAC-SHA256 of the exact raw body>`. The callback only verifies the matching unverified statement digest; it does not reconcile or post money.

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
- Exact-head GitHub CI at `6b0d84edda7892f304fdf56f23f468acd273d05b`: International Fast Gates, Security Exposure Audit, and CRM V2 Release Validation all passed.
- CRM CI clean PostgreSQL bootstrap, `migrate deploy` no-op, schema/invariant checks, root/mobile TypeScript, lint, production build, full regression, and Docker/runtime checks passed.
- Full CI regression: 4,650 passed. Blocking security suite: 2,286 passed, 40 skipped. Local HTTP security: 8 passed, 18 skipped.
- Isolated PostgreSQL startup was attempted locally but could not start in the sandbox because PostgreSQL shared-memory setup is denied; CI verified the full clean-database procedure.
- Current changes, before exact-head CI: focused bank import/matching/governance tests 20 passed; Prisma validate, TypeScript, targeted ESLint, and `git diff --check` passed. The local finance suite reported 328 passed, 13 payout integration failures because `localhost:5432` is unavailable, and 72 skipped. These failures are environment/database availability, not claimed passes.

Previously verified at `956fd471fdcbafdf3d2c4494005598d73b48d3a7`: full regression 4,547 passed / 100 environment-gated skips, financial suite 402 passed / 4 skipped, and production build passed.

## Still open

- Verify the new bank migration and complete reconciliation against isolated PostgreSQL, including concurrent duplicate imports/posting and signed-source callbacks. Implement reversals as governed compensating entries; current reversal rows are safely held for review.
- Add a configured bank-source adapter only after source selection/approval; the HMAC contract is present but no external bank result is connected.
- Full financial case assignment, correction, appeal, and resolution workflows.
- Provider-neutral external evidence state machines and reconciliation for refunds and payouts. Transfers remain disabled until bank/PSP arrangements are approved.
- Clean bootstrap execution on isolated PostgreSQL for this milestone's exact head; direct replay of historical migrations remains invalid because of the pre-baseline `User` reference. Existing databases must continue to use `prisma migrate deploy`.
- Provider selection, human approvals, and physical/operational tests.

No production data, users, provider credentials, live payments, deployments, or merges were used.

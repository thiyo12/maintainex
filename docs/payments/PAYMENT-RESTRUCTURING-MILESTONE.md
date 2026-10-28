# Payment restructuring milestone

Updated: 2026-10-26

Branch: `feature/payment-restructuring`

Latest payment implementation and test evidence: `a3b0bcc9d33d5223b81eba60c29fe4cf2991fea2`. All exact-head GitHub checks passed (57/57 steps, including regression and Docker build).

PR #152 remains open, draft and unmerged. Exact-head CI passed for `a3b0bcc9d33d5223b81eba60c29fe4cf2991fea2`; the previous verified code head was `101836c03517abc5f851426529456a6408e87b35`.

Previously verified implementation head: `6b0d84edda7892f304fdf56f23f468acd273d05b`

## Bank-reconciliation implementation (CI-verified)

- Added durable PostgreSQL models and an additive migration for statement imports, normalized bank transactions, reconciliation proposals, FIFO debt allocations, and append-only audit events. The clean-bootstrap invariants mirror the migration's amount/provenance checks and append-only triggers.
- Added a country-scoped Admin statement import queue and page. It stores normalized rows and a SHA-256 digest, not the uploaded JSON file. Imported evidence remains `UNVERIFIED`; screenshots or typed references cannot change balances.
- Added a provider-neutral HMAC callback contract for an independently authenticated bank source. It requires `MAINTAINEX_BANK_EVIDENCE_SOURCE` and a 32+ character `MAINTAINEX_BANK_EVIDENCE_HMAC_SECRET`, signs the exact raw JSON body with SHA-256, and rejects callbacks older than five minutes. No source is configured or active.
- Added exact reference/debtor/market validation, a separate maker-checker approval request, and a balanced idempotent ledger recovery that allocates partial remittances oldest-first to the Tasker or legal Company identity. Bank transactions, allocations, and case events cannot be duplicated by replay.
- Commission receipts are scoped to the exact weekly settlement. Cumulative partial credits cannot exceed the due; the payment and settlement close only after the verified credits cover that due. A follow-up additive migration links reconciliations to their commission payment without changing the already-published bank migration.
- Added a CI-only forward-upgrade fixture that applies both additive migrations to a minimal prior-schema PostgreSQL fixture and checks duplicate keys, amount/provenance constraints, foreign keys, and append-only triggers. This does not claim coverage of every historical development database shape.
- No bank connection, PSP, or production credential was selected or configured. Authenticated source evidence and isolated-PostgreSQL execution remain required before this path can be verified end to end.

The verification callback body is `{ "sourceSystem": "…", "statementId": "…", "contentSha256": "…", "verificationRef": "…", "timestamp": 1792890000000 }`. The caller sends `X-MaintainEX-Signature: sha256=<hex HMAC-SHA256 of the exact raw body>`. The callback only verifies the matching unverified statement digest; it does not reconcile or post money.

## Bank reversals (implementation at `0af1aa52`)

- Added an additive, PostgreSQL-backed reversal, allocation, and event model. A reversal debit must link to the exact bank account/source/transaction ID and the exact posted reconciliation, debtor, country, currency, recovery rows, and original commission allocations.
- Reversals are maker-checker gated and self-approval is blocked. Posting is serializable and idempotent; it appends a compensating ledger entry and reversal events, restores receivables, and reopens the weekly commission due without deleting the original receipt. Partial reversals are reserved across pending and posted records; invalid cross-market links, unposted originals, and over-reversals are rejected.
- A fully reversed reconciliation is marked `REVERSED`; partial reversals retain the posted original and track cumulative reversed amounts. Suspended settlements remain suspended; overdue debt remains overdue.
- HMAC proves callback sender authenticity only. Posting requires explicit source allowlisting plus matching verified-source provenance. No trusted bank feed is currently configured, so genuine bank reconciliation is not active.
- The forward-upgrade migration fixture now applies all three bank migrations, including the new reversal migration, and checks reversal FKs, duplicate protection, and append-only allocation/event triggers.

## Dispute case assignment (implementation at `a3f82105`)

- Added an Admin/Finance self-claim action for Marketplace financial disputes. It enforces the existing country-scoped `disputes:resolve` guard, locks the case row while claiming its existing work-queue alert, and moves an open case to `UNDER_REVIEW` in the same transaction.
- Another staff member's active assignment cannot be overwritten; closed cases cannot be claimed. Claim outcomes are audit logged and the queue displays the assigned role and whether the current staff member owns the case.
- This implements assignment/claim only. It does not complete evidence submission, appeal, correction, or full case-resolution workflows.

## Dispute resolution history (implementation at `2a3fbe74`)

- Case finalization now locks the dispute row and commits the `RESOLVING` → `RESOLVED` transition, active queue closure, and `FINANCIAL_DISPUTE_RESOLVED` job-lifecycle event in one database transaction.
- A repeated identical finalization returns the existing decision without creating a second history event; an attempted change to the financial outcome is rejected.
- This hardens resolution history and duplicate handling. It does not add case-specific evidence upload, staff-to-staff reassignment, or a customer appeal workflow.

## Duplicate case-alert assignment (implementation at `e1071531`)

- Claiming a case now checks every active queue alert under the locked dispute row. Any conflicting assignee blocks the claim, and all duplicate active alerts for that same case are assigned consistently, preventing different staff from appearing to own duplicate queue entries.

## Dispute appeals and staff reassignment (implementation at `99213cfb`, privacy follow-up at `50c21e75`)

- Added an authenticated participant appeal route for customers, accepted individual providers, and currently authorized company managers/assigned workers. Participant authority is resolved again inside the row-locked transaction.
- Appeals reopen resolved cases while preserving the prior resolution and append-only case history. A Support queue alert is created or reopened atomically; an appeal does not post or move funds. Same-key retries are idempotent and competing appeals conflict.
- Added a participant-scoped case lookup and case detail view for mobile, including customer/provider/company navigation, localized English/Sinhala/Tamil strings, and case history. The case response no longer exposes the submitter email.
- Added Admin reassignment for active disputes using existing `disputes:resolve` permissions, country scoping, target staff validation, SUPER_ADMIN MFA, self-assignment protection, and transactional audit records. Active queue alerts and the case assignee are updated together; closed cases cannot be reassigned.
- Appeals store only a SHA-256 digest of the idempotency key. The mobile commercial-history response removes that digest from appeal metadata. A regression test verifies the digest is not returned.
- This record predates the acknowledged `b7c29d26` dispute-evidence and governed-commission-correction milestone; those earlier gaps are not part of the current refund/payout milestone.

## Provider-neutral refund and payout reconciliation (implementation `a3b0bcc9`)

- Added an additive PostgreSQL `FinancialTransferEvidence` record with source/event deduplication, market/currency/amount/provenance constraints, payload digests, and an update/delete-blocking trigger. No raw provider payload, credentials, or headers are stored.
- Approved Admin refunds now create a provider-`UNSELECTED` request only. Approved payouts move to `PROCESSING_AWAITING_EXTERNAL_EVIDENCE`; neither action sends money. Reconciliation requires a successful matching maker-checker approval plus a trusted bank/PSP adapter result.
- The provider-neutral reconciliation service checks exact target, country, currency, amount, source event and payload digest. Pending, succeeded, failed and reversed outcomes are idempotent; payout failures restore reserved funds, settlement/reversal and refund/reversal post compensating ledger transactions, and originals remain intact.
- Finance refund and payout queues expose sanitized attempts/evidence. Legacy PayPal/PayHere history remains read-only; no provider is selected and no production source adapter is registered. Partial refunds are rejected until their ledger allocation model is implemented.
- Forward-migration verification used a disposable PostgreSQL database created from the prior schema and preserved a synthetic pre-existing refund row. The new constraints and append-only evidence trigger were verified. Full isolated PostgreSQL Vitest regression: 4,608 passed, 100 existing skips, 0 failed. Focused transfer/approval tests: 45 passed; root/mobile TypeScript, Prisma validation/generation, lint (0 errors, 40 existing warnings), and production build passed. Build and tests used no production data.
- Dependency status update (2026-10-28): root npm audit reports 1 low (`esbuild`, Windows development-server file read), 0 moderate/high/critical. Mobile `node-forge` is upgraded from `1.4.0` to upstream `1.4.2` without changing Expo 56. A clean Expo `56.0.23` install, mobile TypeScript, and 6 actual-package signature regressions pass; mobile npm audit reports 0 high/critical (11 moderate, 7 low). The previous local postinstall patch is removed because upstream 1.4.1/1.4.2 includes nested DigestAlgorithm and canonical DER validation. GHSA-86w9 still says no patched version, while upstream published the same issue as GHSA-2g46 (patched in 1.4.1); confirm private Dependabot alert state separately. Exact-head GitHub CI passed on code SHA `d198e5088d9c226426b39bbe3ef134be96d13f95`: CRM, Security Exposure Audit, and International Fast Gates succeeded; CRM ran 4,762 tests across 508 files with no skips. A documentation-only follow-up is pending exact-head CI. Default-branch aggregate alerts remain unverified.
- GitHub’s push notice reports 37 default-branch alerts (1 critical, 9 high, 23 moderate, 4 low). The connected GitHub integration cannot read the private Dependabot alert records (security endpoint returns 404/unsupported); exact default-branch affected-package details therefore remain unverified. Branch lockfile audits above are the available package-level evidence.

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
- Earlier CI at `9ebfeee8e031e5f8c0352dd1b6176f62110902b5` had one regression failure: fully paid bank receivables left `WeeklySettlement` pending. The shared recovery service was fixed in `c8fadc0cfd284845e81b6ad0e2e892f9da4bad6e`; the later passing run verifies the repair.
- Latest local focused checks: API attack-surface, bank import and cash contest tests 21 passed; Prisma validation, TypeScript, targeted ESLint and `git diff --check` passed. The full PostgreSQL bank integration cannot run locally because the isolated PostgreSQL service is unavailable in this sandbox.
- On `0af1aa52`, focused finance/security/cash regression tests: 40 passed across 7 files; TypeScript, targeted ESLint, Prisma generation/validation, and production build passed. `npm audit --audit-level=high` found no high-or-critical npm advisories (3 low/moderate findings remain); the mobile audit reports one controlled upstream high advisory in Expo CLI `node-forge`, with no patched upstream release.
- Bank upgrade test ran successfully on a disposable local PostgreSQL cluster on port 55432; no project `.env` database or VPS was used. This validates the prior-schema bank/reversal migration fixture only, not the full application bootstrap or all finance concurrency paths.
- Exact-head GitHub CI for `0af1aa52f8aeff252e494339209d3c2b27d7ce27` passed: CRM V2 Release Validation (`40193843481`), Security Exposure Audit (`40193843488`), and International Fast Gates (`40193843472`). CRM reported 4,675 regression tests passed; the separate blocking-security invocation reported 2,292 passed and 40 skipped. The 40 are the API/database-gated Phase 10.6 fixtures: the standalone security invocation does not start the test API, while the full regression job starts it and runs both the original and byte-identical duplicate fixture successfully. They are not untested in the full regression result; the standalone report still contains 40 environment-gated skips.
- After case claim and resolution-history changes, local focused dispute/security tests passed: 14 tests across 4 files. Root TypeScript, targeted ESLint, `git diff --check`, and production build passed. Build/lint reported existing repository warnings only.
- Exact-head GitHub CI for `2a3fbe745e93ef902b3b421487ac35db31c32575` passed: International Fast Gates (`40196317688`), Security Exposure Audit (`40196317731`), and CRM V2 Release Validation (`40196317767`). CRM reported 484 regression files and 4,681 tests passed, no regression skips; bootstrap, forward-migration checks, lint, web/mobile TypeScript, production build, financial lifecycle, Docker build/start/health, market-isolation smoke, and non-root checks passed.
- In the separate blocking-security invocation, 40 Phase 10.6 tests remain environment-gated because that invocation does not start the local HTTP test API. The full regression job does start the API and ran both those fixtures successfully; the regression report had no skipped tests. The 40 remain reported as skips in the standalone security artifact, not counted as passing there.
- Exact-head GitHub CI for `3a07d29870ca4df27b7d30e6654ee35adf505624` passed: Security Exposure Audit (`40198096626`), International Fast Gates (`40198096629`), and CRM V2 Release Validation (`40198096847`). CRM reported 4,681 regression tests passing across 484 files with no regression skips; standalone blocking security reported 2,292 passed and 40 environment-gated skips. PostgreSQL bootstrap and forward-migration fixtures, lint, web/mobile TypeScript, production build, full regression, orphan audit, Docker build/start/health, market-isolation smoke, and non-root checks passed. The 40 skipped tests ran in the full regression suite, which reported no skips.
- A local run of the blocking security suite could not substitute for PostgreSQL CI: 2,070 passed, 238 skipped, and 20 tests failed because the database at `localhost:5432` was unreachable. No CI failure is represented as a local pass.
- Exact-head GitHub Actions completed successfully for `4ea90f70827274f32d2f4ed60548d8ecae484843`: Security Exposure Audit (run `40188323376`), International Fast Gates (`40188323383`), and CRM V2 Release Validation (`40188323375`). CRM validation reported 4,663 regression tests passed; security suite 2,288 passed and 40 skipped; local HTTP security 8 passed and 18 skipped. PostgreSQL bootstrap, both additive migration checks, lint, web/mobile TypeScript, financial lifecycle gates, production build, full regression, final PostgreSQL orphan audit, Docker build/start/health, market-isolation smoke, and non-root verification passed.
- Appeal/reassignment focused local suite: 26 tests passed across 5 files; root TypeScript, targeted ESLint, and `git diff --check` passed.
- Exact-head GitHub CI on `101836c03517abc5f851426529456a6408e87b35` passed all three workflows: CRM V2 Release Validation (`40214836740`), Security Exposure Audit (`40214836786`), and International Fast Gates (`40214836745`). CRM reported 4,696 regression tests passed across 489 files with no skips, 136 financial flow tests passed, and 2,295 standalone blocking-security tests passed with 40 environment-gated skips across 2 files. PostgreSQL bootstrap and migration checks, root/mobile TypeScript, lint, production build, final PostgreSQL orphan audit, Docker build/start/health, market-isolation smoke, non-root verification, and cleanup passed. The standalone security invocation does not start the test HTTP API for the 40 gated tests; they ran in the full regression suite, which reported zero skips.

Previously verified at `956fd471fdcbafdf3d2c4494005598d73b48d3a7`: full regression 4,547 passed / 100 environment-gated skips, financial suite 402 passed / 4 skipped, and production build passed.

## Still open

- Verify the prior bank-reversal posting/concurrency path against its authenticated source fixtures; it is outside this refund/payout change and remains dependent on a selected trusted bank source.
- Add a configured bank-source adapter only after source selection/approval; the HMAC contract is present but no external bank result is connected.
- Register a real bank/PSP adapter only after provider/source approval. Until then the reconciler has synthetic test sources only; online payment, refund, and payout transfers remain disabled.
- Partial external refunds are rejected; they require an approved split-allocation/ledger model.
- The GHSA-86w9 advisory metadata still lists no patched version even though node-forge 1.4.2 contains the upstream nested-parameter and canonical-DER fixes and passes actual-package regression tests. Confirm the private Dependabot record is closed or document its status; remaining mobile moderate/low tooling advisories need separate compatibility review.
- Exact package records for the default branch's 1 critical/9 high Dependabot alerts are not available through the connected GitHub integration; only the default-branch aggregate and current branch lockfile audits were verified.
- Clean bootstrap execution on isolated PostgreSQL for this milestone's exact head; direct replay of historical migrations remains invalid because of the pre-baseline `User` reference. Existing databases must continue to use `prisma migrate deploy`.
- Provider selection, human approvals, and physical/operational tests.

No production data, users, provider credentials, live payments, deployments, or merges were used.

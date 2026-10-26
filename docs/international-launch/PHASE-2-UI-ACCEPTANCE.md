# Phase 2 Synthetic UI Acceptance

Date: 2026-10-26  
Branch: `feature/payment-restructuring`  
Starting head: `a9ff7a15288b768196b99052e840fc351d2c2f56`

Scope is synthetic acceptance only. The PostgreSQL instances were created solely under a temporary local cluster with the required `maintainex_test` database name. No production/VPS data, real OTP delivery, payment provider, transfer, or customer communication was used.

## Admin Finance approval and rejection

| Screen / action | API evidence | Database and audit evidence | Result |
| --- | --- | --- | --- |
| FINANCE sign-in and step-up | Synthetic staff login and step-up completed; `POST /api/admin/auth/step-up` returned 200. UI showed FINANCE role and 2FA protection. | Step-up grant was consumed; `STEP_UP_VERIFIED` security audit recorded. | Pass in local production-mode build under the repository's unchanged production CSP. |
| `/admin/approvals` queue | Synthetic LK/LKR `finance.payout` requests loaded; decision endpoints returned 200. | Separate maker/checker identities, Finance authorization, LK country scope, and fresh TOTP step-up. No transfer provider was configured. | Pass. |
| Approve synthetic request | `POST /api/admin/approvals/{id}/decision` with APPROVE returned 200; UI displayed “Approved and executed successfully”. | Approval `SUCCEEDED`; payout moved `RESERVED → PROCESSING`; events `APPROVAL_GRANTED` and `EXECUTION_SUCCEEDED`; payout security audit recorded. `FinancialTransferEvidence=0`, `FinancialLedger=0`. | Pass. This records approval/staging only, not a payout or money movement. |
| Reject synthetic request | Same decision endpoint with REJECT returned 200; UI displayed “Approval request rejected” and queue emptied. | Approval `REJECTED`; payout remained `RESERVED`; `APPROVAL_REJECTED` event recorded. No payout update, transfer evidence, or ledger entry. | Pass. |

Fixtures were synthetic and used an isolated disposable PostgreSQL database. The approve/reject paths were repeated once in a strict-CSP production-mode local build after a Next dev-server worker-chunk failure; repository CSP was not relaxed. No financial transfer or ledger posting occurred.

## Gated PostgreSQL tests

Ran `tests/integration/real-postgresql-integration.test.ts` against a freshly initialized local PostgreSQL 16 cluster on a temporary port and an isolated `maintainex_test_phase2` database, after applying the current Prisma schema. Result: **26 passed, 0 failed, 0 skipped**. The cluster was not an existing development or production database. This verifies the gated integration file; it does not represent a historical migration-chain replay or full PostgreSQL suite.

## Native mobile screen acceptance checklist

Expo 56 native UI automation was unavailable: the installed app dependency tree was Expo 57, a clean isolated lockfile install resolved Expo 56, but the simulator UI controller could not connect. No native journey below is claimed as passed. Use this checklist when a controllable supported simulator/device is available; capture screen, request/response, resulting DB transition, and screenshot for every interaction.

| Role | Screen-by-screen synthetic journey and assertions | Status |
| --- | --- | --- |
| Customer | Welcome → LK/CA phone selection → mocked OTP login/register → profile/onboarding → service discovery → service detail/quote → booking review/submit → booking detail/status → cancel or dispute/appeal → payment/receipt. Assert authenticated customer ownership, market/currency, booking/quote API responses, duplicate-submit behavior, dispute history, and no fabricated paid/refunded state. | Blocked: native controller unavailable. |
| Individual Tasker | Welcome → mocked OTP login → profile/KYC status → assigned jobs → job detail/accept or decline → permitted work-start control → progress/evidence → completion → cash-collected/partial/contested state → commission balance/settlement → dispute/evidence/appeal. Assert only assigned jobs are visible/actionable and ledger/commission transitions are idempotent. | Blocked: native controller unavailable. |
| Company manager | Welcome → mocked OTP login → company profile/authority → company job list → assignment → job detail/progress → completion → cash/commission state → dispute and reconciliation views. Assert current manager authority, legal company debtor/beneficiary, market isolation, and no employee access beyond granted scope. | Blocked: native controller unavailable. |
| Company worker | Welcome → mocked OTP login → worker membership → assigned job → accept → permitted work-start/progress → completion submission → cash/dispute status. Assert membership and assignment checks, no authority to act as company manager or receive company funds, and no cross-company/customer data exposure. | Blocked: native controller unavailable. |

## Other Phase 2 evidence and known limits

- Finance → Payout Queue responsive search/filter overlap remains fixed; `tests/admin/payout-queue-responsive-filters.test.ts` passed (1/1) on the prior verified revision. This turn did not change application code.
- Previous UI snapshot's 4,709 automated tests and exact-head CI were prior evidence, not rerun in this turn. Exact-head CI will be rerun for this documentation revision.
- A development-mode route test encountered a missing Next worker chunk; approval/rejection was independently completed in production mode with the repository's original CSP and successful API/database assertions.
- Public homepage claims finding preserved for security/content review: remove “Trusted by 500+ users” / “join 500+ others” unless verified counts support them. Leave payment, insurance, guarantees, vetting, market-size, and performance claims unchanged pending evidence and business approval. No homepage copy changed.
- Physical device testing, all four mobile roles, full browser journeys beyond the Admin approval queue, and operational acceptance remain pending.

## Acceptance decision

Synthetic Admin approval/rejection and the gated PostgreSQL integration file passed. Phase 2 is **conditionally acceptable for these automated/database and Admin decision flows only**. Overall Phase 2 UI acceptance is **not closed** because native Customer, Tasker, Company, and worker journeys remain blocked. Phase 3 has not started.

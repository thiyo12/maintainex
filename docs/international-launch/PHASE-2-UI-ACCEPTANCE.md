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

**Rechecked 2026-10-27 on `952e178059f057748d201bb30d52e58bf31bebe7`.** The lockfile resolves Expo 56.0.23; the existing ignored `apps/mobile/node_modules` resolves Expo 57.0.27 and was left untouched. Xcode lists an iPhone 17 Pro on iOS 26.5 and `simctl` booted it; a simulator home-screen screenshot was captured, but the app was not installed or opened. Native interaction is blocked: Codex's native-app controller returned `Computer Use server error -10005: codex app-server exited before returning a response`; `idb list-targets` fails because `/usr/local/bin/idb_companion` is absent; Android `adb devices -l` reports no connected devices. AppleScript GUI control also failed with macOS error `-10827`. The official Facebook idb Homebrew tap was verified and its two idb formulas were individually trusted, but installation of `idb-companion` was refused because the local Command Line Tools are behind Homebrew's required Xcode 27.0 level. No Xcode/CLT update was attempted. Thus a simulator runtime exists, but no working UI interaction controller was available and no role journey is claimed as passed. SecureStore was not replaced.

The required safe backend was also unavailable. `pg_isready` reported no PostgreSQL response at `localhost:5432`; the root `.env` points to database `maintainex` (not an isolated test database), and `apps/mobile/.env` points to `maintainex.lk`. Neither was used. The app was not launched with the public API URL. Native testing must wait for a disposable database/API and Expo 56 clean install. No customer, job, OTP, or financial records were created.

### Reproducible native-device run when a controller is available

1. Use a clean checkout/copy of the reviewed `feature/payment-restructuring` revision; do not reuse the mismatched `apps/mobile/node_modules`. In `apps/mobile`, run `npm ci` (not `npm install`) and verify `node -p "require('expo/package.json').version"` prints `56.0.23`. Do not change the SDK or lockfile.
2. Start the web API against a disposable PostgreSQL database with only synthetic Customer, individual Tasker, Company manager/worker, and Admin identities. Use the test OTP/mock email delivery configuration; keep real SMTP, payment-provider keys, and financial transfers disabled.
3. Configure `EXPO_PUBLIC_API_URL` to the isolated local API (`http://127.0.0.1:3000` for iOS Simulator; Android Emulator normally reaches the host at `http://10.0.2.2:3000`). Confirm requests cannot reach production before launching the app.
4. Start an installed Xcode iOS runtime or Android Emulator and verify it is controllable (`xcrun simctl list devices available` / Android `adb devices`). Build and launch the native app with `npm run ios` or `npm run android`; do not use the web target as a substitute and retain native SecureStore.
5. Run each role journey in the checklist below. For every screen action capture the screenshot, account/role, request and response status/body with secrets redacted, expected and actual database transition, and pass/fail. Repeat duplicate, retry, cancellation and dispute paths with synthetic data, then destroy the disposable database and test checkout.

If simulator device control or the isolated API/database is unavailable, record the affected role/screens as blocked and attach the exact error. Do not point synthetic testing at `maintainex.lk`, use the existing `maintainex` database, or mark browser/API coverage as native acceptance.

| Role | Screen-by-screen synthetic journey and assertions | Status |
| --- | --- | --- |
| Customer | Welcome → LK/CA phone selection → mocked OTP login/register → profile/onboarding → service discovery → service detail/quote → booking review/submit → booking detail/status → cancel or dispute/appeal → payment/receipt. Assert authenticated customer ownership, market/currency, booking/quote API responses, duplicate-submit behavior, dispute history, and no fabricated paid/refunded state. | Blocked: native controller unavailable. |
| Individual Tasker | Welcome → mocked OTP login → profile/KYC status → assigned jobs → job detail/accept or decline → permitted work-start control → progress/evidence → completion → cash-collected/partial/contested state → commission balance/settlement → dispute/evidence/appeal. Assert only assigned jobs are visible/actionable and ledger/commission transitions are idempotent. | Blocked: native controller unavailable. |
| Company manager | Welcome → mocked OTP login → company profile/authority → company job list → assignment → job detail/progress → completion → cash/commission state → dispute and reconciliation views. Assert current manager authority, legal company debtor/beneficiary, market isolation, and no employee access beyond granted scope. | Blocked: native controller unavailable. |
| Company worker | Welcome → mocked OTP login → worker membership → assigned job → accept → permitted work-start/progress → completion submission → cash/dispute status. Assert membership and assignment checks, no authority to act as company manager or receive company funds, and no cross-company/customer data exposure. | Blocked: native controller unavailable. |

## Other Phase 2 evidence and known limits

- Finance → Payout Queue responsive search/filter overlap remains fixed; `tests/admin/payout-queue-responsive-filters.test.ts` passed (1/1) on the prior verified revision. This turn did not change application code.
- Previous UI snapshot's 4,709 automated tests and exact-head CI, and commit `952e178` CI evidence, are prior automated evidence; they do not exercise native screens. No application code changed in this recheck, so tests and CI were not rerun.
- A development-mode route test encountered a missing Next worker chunk; approval/rejection was independently completed in production mode with the repository's original CSP and successful API/database assertions.
- Public homepage claims finding preserved for security/content review: remove “Trusted by 500+ users” / “join 500+ others” unless verified counts support them. Leave payment, insurance, guarantees, vetting, market-size, and performance claims unchanged pending evidence and business approval. No homepage copy changed.
- Physical device testing, all four mobile roles, full browser journeys beyond the Admin approval queue, and operational acceptance remain pending. Phase 3 security findings remain tracked separately in `docs/security/PHASE-3-SCOPED-SECURITY-ASSESSMENT.md`; this document does not change their status.

## Acceptance decision

Synthetic Admin approval/rejection and the gated PostgreSQL integration file passed in the previously recorded milestone. This recheck found no usable native UI controller or isolated backend, so it adds no native journey passes. Phase 2 is **not ready for closure**: Customer, Individual Tasker, Company manager, and Company worker native journeys remain blocked. Phase 3 security findings remain open as recorded in the separate assessment.

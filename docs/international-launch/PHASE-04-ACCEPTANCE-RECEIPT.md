# Phase 04 — Provider Onboarding & Workforce Acceptance Receipt

**Status: IN PROGRESS — NOT ACCEPTED.** This is an implementation and test-evidence
receipt, not a product/operations approval. Scope is the existing 24-category /
239-service catalogue, Sri Lanka's 25 districts (LKR) and the City of
Vancouver municipality (CAD). The proposed 27/548 catalogue is **not enabled**.

**Branch / draft PR:** `feature/international-launch-12phase` /
[#80](https://github.com/thiyo12/maintainex/pull/80). Last complete successful
three-workflow check at the beginning of this session:
`6a1528d9ef19436f65b818470e39094d8ac2a3e9`.
Subsequent implementation commits:
- `0baab2cb8e6548c67c38c0079f8033a42d8920fe` — transaction-locked
  dispatcher authority for new and replacement assignments;
- `4d7996efc9fe6ea1e0d32b3feeb5a6a4c580278a` — ownership-transfer
  restricted-account checks.

**Do not treat either new commit as fully CI-certified until its exact SHA has
a completed, green validation run.** Tests that run only in PostgreSQL CI
must not be described as locally executed.

## Implemented paths and executable evidence

| Acceptance area | Canonical path and regression coverage | Verdict |
| --- | --- | --- |
| Existing service selections preserved | `app/api/mobile/taskers/skills/route.ts`; `tests/security/phase04-tasker-skill-save-payload.test.ts` | Code implemented; physical mobile UI acceptance pending |
| Individual and company eligibility | `lib/phase6/provider-eligibility.ts`; `tests/security/phase04-provider-capability-eligibility.test.ts`, `phase04-company-worker-account-eligibility.test.ts` | Automated checks; human onboarding approval pending |
| Exact service and market grants | `lib/matching/index.ts`, `lib/matching/eligibility.ts`; `tests/security/phase04-exact-job-matching.test.ts`, `phase04-matching-entry-point-service-identity.test.ts` | Automated checks |
| Mandatory credentials, verification, expiry | `lib/matching/eligibility.ts`; `tests/security/phase04-jurisdiction-certificates.test.ts` | Automated checks; licence-document operations sign-off pending |
| Company invitations and role restrictions | `lib/phase6/invitation.ts`, `lib/phase6/rbac.ts`; `tests/security/phase04-company-invitation-market.test.ts`, `phase04-company-workforce-management-permissions.test.ts` | Automated checks; real account lifecycle pending |
| Worker identity, assignment, work-start PIN | `lib/domain/company-job-assignment.ts`, `lib/domain/job-pin.ts`; `tests/security/phase04-dispatch-transaction-identity.test.ts`, `phase04-worker-booking-acceptance.test.ts`, `phase04-dispatch-actor-commit-authorization.test.ts` | Automated checks; both-party device/PIN scenario pending |
| Scheduling and worker capacity | `lib/phase6/provider-eligibility.ts`, `lib/domain/company-job-assignment.ts`; `tests/security/phase04-company-worker-exact-job.test.ts`, `phase04-dispatch-transaction-identity.test.ts` | Single-worker conflict protection; multi-worker crew unsupported |
| Ownership change and account restriction | `lib/phase6/company-ownership.ts`; `tests/security/phase04-owner-transfer-account-lock.test.ts`, `tests/company/ownership-transfer.test.ts` | New regression pending full latest-commit CI |

## Final engineering pass — exact-head CI required

This single-commit batch restores the company dispatch workforce API contract:
team members include authoritative membership status, removed rows are excluded,
and suspended memberships are not offered verified worker photographs. The
mobile picker only accepts active WORKER accounts and unstarted single-worker
bookings, and checks required worker photo verification before submitting.

The server additionally locks worker global account and membership rows before
assignment acceptance, preventing suspended/demoted members racing an accept.
Assignment revocation now locks and rechecks actor authority during the
transaction and refuses a job that began or changed assignees. Current member
roles, not the historical company founder link, govern assignment details.
Fast gates and regression tests cover these changes; **CI evidence applies
only to the exact pushed commit**, not an earlier green run.

Crew bookings remain deliberately blocked until a real multi-person workflow
supports crew identity, scheduling, acceptance, PIN, cancellation, safety and
migration. Device testing, geographically isolated real-world fixtures and
operational sign-off also remain open. **Status: IN PROGRESS — NOT ACCEPTED.**

## Phase 04 additional correction — one-batch commit

The company dispatch screen now requests V2 job details with the **company**
context so an authorized owner/dispatcher can actually read accepted company
quotes before assignment. Without that context, individual-provider-only
quote lookup could silently hide otherwise assignable company bookings.

V2 create/edit routes now share positive, database-safe integer validation
for `workersCount`; zero, fractions, booleans, exponential strings and
oversized crew counts cannot be stored or passed into canonical BigInt
pricing. Existing omitted values continue to default to one worker. All
multi-worker jobs remain explicitly **not dispatchable** by the single-worker
workflow. This is not a crew feature or Phase 04 acceptance claim.

## Remaining blockers — cannot mark Phase 04 accepted

1. **Multi-worker crew support.** The job has a `workersCount` requirement,
   while canonical company assignment currently models one active worker
   per job. Jobs with `workersCount > 1` are intentionally refused by
   `checkWorkerEligibility`, rather than advertised as staffable.
   Multi-worker schema, crew scheduling and acceptance require a separately
   proven end-to-end design; do not drop the guard to improve apparent coverage.
2. **Physical onboarding acceptance.** Test preserved selections, verification,
   document review, invitations, role transitions and identity-photo
   confirmation on real test accounts/devices for both supported markets.
   Confirm role/member transitions do not alter customers' existing bookings.
3. **Owner identity and authority semantics.** Ownership transfer changes
   active `TeamMember` roles while `CompanyProfile.userId` retains the
   historical creator. `checkCompanyEligibility` now verifies current active
   owner memberships rather than this historical link, with regressions for
   suspended successor owners. Canonical matching eligibility also derives
   owner authority from these current memberships, and canonical discovery
   filters on the registered company market rather than the historical
   founder's country/account restrictions. Continue auditing remaining
   owner-linked account/UI paths before declaring full ownership acceptance
   and UI paths before transferred-company onboarding is accepted; do not
   blindly rewrite historical owner data.
4. **Cross-market live acceptance.** Exercise real test fixtures for LK
   district service addresses and City-of-Vancouver-only addresses. Confirm
   tasker/company matching, dispatch, identity check and work-start behavior.
   The address/coordinate geocoding-vendor decision is a separate Phase 02
   blocker; do not claim street-address accuracy without it.
5. **Release evidence.** Latest exact-head security audit, fast gates, full
   regression, PostgreSQL orphan integrity and container checks must all
   complete. Separate LK and Vancouver operational sign-offs belong to
   Phase 11 and cannot be inferred from CI.

## Release safety

No merge/deployment; no production data edits; no payment-provider enablement;
no new paid geocoding; no publication of the unapproved catalogue.
Maintain original customer and provider data, permissions and identity records.
Any CI test records are isolated and must be cleaned up by owned fixture IDs.

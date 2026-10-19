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

## Phase 04 workforce edge-case regression batch

Follow-up work (requires exact commit CI):
- Worker acceptance now rechecks a job's single-worker requirement and locks
  a verified provider-identity photo when required, closing the gap between
  onboarding preflight and acceptance commit.
- A worker's rejection conditionally claims only the unchanged quote-accepted
  assignment, restoring the company job target and writing the audit within
  the same transaction; stale cancellations or reassignments return a domain
  conflict instead of an opaque 500.
- Team reads now hide identity-photo approval for globally banned, suspended
  or inactive workers, and the dispatch picker filters those accounts.
- Assignment list parameters reject malformed/negative/unsafe pagination and
  restricted accounts cannot list active company assignments.
- Regression tests run in the launch fast gates. These code gates do not
  certify crew coverage, device flows or operational readiness.

## Phase 04 — workforce actor authority at commit

All three workforce actions now revalidate the acting manager's unrestricted
global account and active persisted role **under transaction row locks** before
editing a target. A demoted, removed, suspended or banned manager cannot reuse
a stale authorization context to change a role, deactivate staff or reactivate
a suspended team membership. The company row and actor locks are acquired
before the target membership. Dedicated regressions cover all actions;
exact-head CI and physical acceptance are still required.

## Phase 04 — build-gate repair and mutable-booking dispatch races

The previous head `22a9bae` passed fast gates and the security audit,
but **failed full CRM validation** because the Next.js API route exported an
internal helper (`assertCurrentWorkforceManager`) as an unsupported route
export. The helper is now file-private; a fast-gate structural regression
guards against that exact production-build failure.

Company dispatch and reassignment now conditionally claim only a job that
is still single-worker and whose identity-photo requirement, preferred date
and preferred time slot match the eligibility/schedule snapshot. If any
changed while the dispatcher was working, the atomic claim fails and no
worker assignment or workspace mutation is committed. Assignment
completion also conditionally requires the parent job to remain COMPLETED.
New tests cover these stale-state conditions. No crew enablement, actual
device signoff or go-live certification is implied.

## Phase 04 — crew/PIN boundary and per-assignment identity freshness

Worker dispatch and reassignment now invalidate earlier customer `MATCHED`
worker-photo confirmations and revoke still-active PINs within their respective
transactions. An old
approval can no longer be replayed if a worker leaves a job and is assigned
again. `MISMATCH_REPORTED` and `REVIEW_REQUIRED` records are preserved for
Trust & Safety review.

The current single-worker PIN system now explicitly refuses crew bookings
at PIN generation, rotation and verification, and the work-start eligibility
gate rejects them too. The PIN verifier locks the job row to serialize arrival
with worker reassignment. Both initial assignment and reassignment fail closed
if any arrival PIN for that booking was previously verified, rather than
inheriting a previous worker's proof of arrival.
Regression coverage locks these boundaries. This deliberately **does not
activate multi-worker crews**: shared/individual PIN design, crew identities,
each-worker acceptance, scheduling, safety and lifecycle remain unimplemented.

## Crew readiness design and physical acceptance evidence

The mobile company dispatcher now identifies how many accepted crew bookings
were omitted from the single-person picker and tells owners why they are
blocked. The defence-in-depth submit check also refuses any multi-worker
selection rather than silently assigning one person.

[Multi-worker schema and lifecycle implementation plan](PHASE-04-CREW-IMPLEMENTATION-PLAN.md)
defines the necessary migration, full-crew capacity lock, individual
acceptances, all-worker identity/PIN barrier, cancellation semantics,
backward-compatible target resolution and exact tests. It is a **design,
not crew implementation**. The
[LK/Vancouver physical-device acceptance runbook](PHASE-04-DEVICE-ACCEPTANCE-RUNBOOK.md)
enumerates independent human checks and evidence fields. None are marked
completed without actual test devices and operational reviewers.

The last exact-head three-workflow green baseline is `614a0ec`; subsequent
batch changes require their own exact-commit CI.

## Phase 04 — read-only crew candidate readiness implementation

At validated baseline `7c6df6c` the three workflows were all green.
This batch adds `checkCrewCandidateEligibility`, which shares the exact
service, country, membership, identity and schedule rules of production worker
eligibility but may inspect multi-worker bookings **only in preview mode**.
The existing `checkWorkerEligibility` dispatch guard is unchanged, and
single-worker assignment, PIN and work-start remain fail-closed for crews.

An authenticated company owner/manager/dispatcher with `workers:assign`
may POST to `/api/mobile/company/crew/readiness` to evaluate a bounded
list of distinct members, but only when their company has the accepted quote.
Results show missing crew slots, individual blockers, and existing
single-worker assignment conflicts. Every result is
`previewOnly: true` / `dispatchEnabled: false`, with no persistence,
notifications or reservation. The mobile dispatch screen allows a proposed
roster to be selected and inspected without assigning it. The report is
explicitly point-in-time and MUST be revalidated under transaction locks in
the eventual full crew workflow. Negative unit/route/mobile tests are part
of the international fast gates. These edits are not crew acceptance.

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

## Crew candidate photo requirement (preview-only)

The read-only crew readiness preview now separately checks every selected
worker for an approved verified identity photo, even if the booking's
single-worker `workerIdentityCheckRequired` flag was not set. An incomplete
crew roster fails preflight with a per-worker reason. This does **not** reserve
capacity, approve a crew booking, dispatch workers, or replace customer
identity confirmation; each of those still requires the crew lifecycle
implementation and physical acceptance.

## Phase 04 — versioned crew scaffold and stricter readiness preflight

The feature branch now contains an **additive, unused** database model for
`CompanyCrewDispatch` and optional per-worker crew slot / identity / arrival
evidence fields on `CompanyJobAssignment`. The migration does not remove the
single-active-worker uniqueness index. No crew roster can be persisted by an
application endpoint yet, and crew PIN/work-start, per-worker acceptance and
worker/customer lifecycle stay deliberately blocked. No production migration
has been run.

Read-only crew preview now also blocks unverified/restricted companies,
missing unrestricted active owners, cancelled subscriptions, unsupported
job-address markets and company/job country drift. The mobile screen discards
slow preview responses once the selected job, roster or team changes. These
are engineering prerequisites only, **not Phase 04 approval**. Latest-commit
CI and isolated PostgreSQL migration verification are still required; LK and
Vancouver physical-device and operational acceptance remain outstanding.

## Phase 04 — transaction-scoped all-worker commit gate

The internal `checkCrewRosterAtCommit` helper now runs on a SERIALIZABLE
PostgreSQL transaction. Before any future reservation can be written it
locks the acting dispatcher, accepted quote, booking, company and each
proposed worker in sorted order; it requires an unchanged 2–12-worker job,
current company/owner/market authorization, zero prior arrivals/safety
mismatches, exact worker service/market eligibility, photos and capacity.
All eligibility queries share the transaction client; earlier preview
results do not grant authorization. The helper returns
`dispatchEnabled: false`, makes **no writes** and has no public route.

A dedicated PostgreSQL CI suite uses owned test fixtures only to exercise
the commit gate, account/skill revocation and competing crew-record
uniqueness, with dependent-row cleanup. The suite is wired into blocking
release checks. This is not an implemented crew roster reservation,
all-worker acceptance, crew PIN/work-start authorization or operational
approval. No production migration is applied by these development commits.

## Phase 04 — transaction lifetime boundary correction

The read-only `checkCrewRosterAtCommit` wrapper holds locks only for its own
SERIALIZABLE transaction, then returns `dispatchEnabled: false`. Its result
is **not** a capacity hold and cannot authorize writes in another transaction.
The separately exported `assertCrewRosterReadyInsideTransaction(tx, input)`
allows a future writer to reuse the exact guard **within the same still-open
SERIALIZABLE reservation transaction** before staging all slots atomically.
No writer, crew acceptance or PIN route is enabled here.

## Phase 04 — internal all-or-nothing FORMING crew staging

The internal `stageCrewReservationInsideTransaction` primitive now writes a
`CompanyCrewDispatch` FORMING row and **all required** `CREW_RESERVED`
worker slot rows in the same existing SERIALIZABLE transaction as the
commit-time authorization/identity/market/schedule gate. The nominated
lead must be in the selected roster; a partial slot insert aborts. It writes
an audit entry but does **not** send invitations/notifications, update the
booking target, publish worker identity, create PINs/workspaces, or enable
work-start or payment. There is no API or mobile caller.

Both preflight and existing single-worker transaction scheduling now count
`CREW_RESERVED` slots as consuming capacity on other bookings, to prevent a
future staged crew from being double-booked. The isolated PostgreSQL test
races complete staging transactions, checks exactly one whole roster survived,
and confirms a staged worker blocks single-person scheduling. A FORMING
roster is **not a dispatched, accepted or start-ready crew**.

Still required before exposing any endpoint: complete all-worker accept/reject,
revocation/suspension/cancellation, explicit epoch-bound PIN/arrival/photo and
workspace barriers, company/customer/worker UI, real-device acceptance, and
approved operational sign-off. Current exact-head CI remains necessary.

## Phase 04 — internal staged worker decisions (no launch authority)

New internal transaction-only helpers let a named, authenticated-in-future
worker **accept** one `CREW_RESERVED` slot as `CREW_ACCEPTED`, rechecking
the accepted COMPANY quote, unchanged job/crew version, company market and
status, exact worker capability, verified photo, membership, schedule and
unresolved safety state. No endpoint invokes this code and even unanimous
acceptance leaves the crew `FORMING`; no PIN, workspace, payment or work-start
authority is granted. The future route must derive the worker ID from the
authenticated session and use one SERIALIZABLE transaction.

An internal **refusal** marks that member `REJECTED` and every other
`CREW_RESERVED`/`CREW_ACCEPTED` slot `REVOKED` within the same
transaction; the crew moves to `BLOCKED` with an incremented version,
invalidating stale responses and releasing all capacity. Safety mismatches
and audit history are preserved. Legacy single-worker dispatch remains
separate; a staged crew worker still consumes capacity. Dedicated unit and
isolated PostgreSQL tests cover these invariants, including release after
refusal. Neither helper is connected to HTTP or mobile UX, so this is
**not operational crew invitation/acceptance**, and Phase 04 remains open.

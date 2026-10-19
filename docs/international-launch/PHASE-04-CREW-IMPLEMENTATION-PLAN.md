# Phase 04 — Multi-worker crew dispatch: implementation and acceptance design

**Status: DESIGN / BLOCKED — NOT ENABLED.** The deployed-compatible dispatch
path intentionally supports one accepted worker per booking. Do not remove
the `workersCount > 1` eligibility guard or partial unique assignment index
until this entire specification is implemented and approved.

## Existing single-worker coupling (why a toggle is unsafe)

- `MarketplaceJob.workersCount` can exceed one, but
  `CompanyJobAssignment_active_per_job_idx` allows only one active assignment
  per job. `MarketplaceJob.targetTaskerId` is a single worker.
- Dispatch writes that target, worker acceptance and work-start check the
  exact assigned user, and `JobVerificationPin` tracks one arrival/start
  sequence per job. `resolveJobWorkerIdentity` selects one worker identity.
- Revocation, rejection, worker suspension, workspace, completion, disputes,
  location visibility, worker scheduling and company notifications all assume
  one active assigned worker. Dropping the uniqueness constraint alone would
  introduce under-staffed paid jobs, ambiguous start authority and safety gaps.

## Completed first implementation slice — nonbinding roster preview

The company app now shows a read-only multi-worker roster chooser for
accepted company crew bookings. The server checks the authorized manager,
the company's accepted quote, roster-size limits, distinct workers, exact
service capabilities, worker identity, country and current availability.
It reports blockers without creating assignments, holding capacity,
generating PINs or changing a payment/booking. The result includes
`previewOnly: true`, `dispatchEnabled: false` and a preflight status that
**does not imply dispatch can proceed**. A future crew-dispatch transaction
must redo every mutable check while holding locks.

This is *not* the implementation of crew acceptance/start/completion.
Stage 2 remains the proposed schema and migration below.

## Proposed backward-compatible schema and migration

1. Introduce `CompanyCrewDispatch` with `jobId` unique, `companyId`,
   `requiredWorkersCount`, `status` (FORMING, READY, IN_PROGRESS,
   COMPLETED, BLOCKED, CANCELLED), `leadWorkerUserId`, `version`,
   timestamps and a job-level optimistic locking token.
2. Associate multiple `CompanyJobAssignment` rows to crew dispatch; store
   explicit slot/crew role and per-worker accepted/arrived/identity-confirmed
   times. Retain existing jobId/workerUserId uniqueness, preventing accidental
   duplicate invitations.
3. In a non-destructive migration, preserve every preexisting single-worker
   assignment, creating crew records only for newly admitted multi-worker
   bookings. Remove the one-active-assignment-per-job partial unique index
   **only** in the same migration that adds an integrity replacement: unique
   active worker per crew slot; bounded active count; no multi-company crews;
   single-worker legacy semantics preserved. Integrate with PostgreSQL
   locking/constraints rather than relying on request-time counts.
4. Keep `targetTaskerId` compatibility for one-worker jobs. For crew jobs use
   a separate authoritative crew resolver; never arbitrarily select the first
   worker for customer identity, PIN, messaging, payments or safety.
5. Make rollback feature-gated: stop new crew dispatch, leave accepted jobs
   readable and safe, and preserve history. Do not delete historical worker
   data or silently downgrade existing multi-worker jobs to one worker.

## Transaction/authorization requirements

- Validate accepted COMPANY quote, company country/municipality, exact
  catalogue service, customer booking, unchanged `workersCount`, verified
  credentials and each member's market/identity/skills before dispatch.
- Lock company/job and all participating User/TeamMember rows in a stable
  order. Atomically reserve all requested slots and check schedules against
  every existing ASSIGNED, ACCEPTED, IN_PROGRESS commitment, including
  undated/anytime and overlapping times. Reject a half-assigned crew.
- Every invited worker must individually ACCEPT. READY is true only if the
  **entire required count** has accepted, is verified, can legally perform the
  precise service in that market and has no conflict.
- Crew changes invalidate all prior per-worker customer identity confirmations
  and previous arrival/start PINs without erasing mismatch/safety evidence.
  Define a new `crewVersion`/assignment epoch bound to PIN generation,
  arrival and start. Mismatches suspend work for the crew pending Trust &
  Safety review. Require all required member confirmations, not just the lead.
- ARRIVAL and WORK_START must be barrier transitions: one authenticated
  nominated lead, valid crew epoch, all worker acceptances and all required
  customer-verified photos. `JobWorkspace`, `MarketplaceJob`, payment/
  escrow, PIN consumption and all worker statuses change together.
- Cancellation, rejection, revocation and suspension before start either
  atomically refill and reconfirm the entire crew or return the booking to
  a blocked safe state; after start, escalate to support/dispute rather than
  silently reducing the crew. Preserve safety case and audit trail.
- Add company UI for roster selection, each member's identity photo and
  status, acceptance count, conflicts, customer confirmation and blocked
  reasons; worker UI for own invitation, arrival, crew status and safety
  reporting. Do not reveal competing provider quotes to workers.

## Required green evidence before enablement

- Unit and isolated PostgreSQL concurrent dispatch/capacity races, duplicate
  slots, concurrent accept/revoke, founder ownership transfer, worker account
  restriction, group cancellation, membership suspension and payout isolation.
- Negative cases for 2/3+ workers, missing member, unverified photo, expired
  licence, wrong service/market, overlapping appointment, duplicate PIN,
  reused prior-crew arrival, pending safety mismatch and partial acceptance.
- Run complete release CI, Next.js production and mobile builds, container
  smoke, migration upgrade from current schema, migration rollback playbook,
  leak checks and owned fixture cleanup.
- Real device evidence for accepted crew quote, all workers' acceptance and
  simultaneous presence, every photo confirmation, controlled START and
  completion, plus LK and Vancouver operating approvals. Record screenshots,
  test-account fixture IDs (not secrets), app/build versions, operator names,
  time, result and sanitized incident logs in the Phase 04 acceptance receipt.

**Current engineering posture:** unsupported crew bookings are explicitly
blocked from assignment, PIN generation/rotation/verification and work-start.
Existing single-worker paths remain operational. This document is a design,
not a claim of implemented crew staffing.

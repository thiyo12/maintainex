# Phase 04 — Physical-device acceptance runbook (LK / Vancouver)

**Status: NOT EXECUTED / NO SIGN-OFF.** This is a reproducible checklist for
operations and QA, not synthetic device evidence. Use isolated authorized test
accounts; never touch live customers, provider payouts, payment processors or
production bookings. Preserve the approved 24-category / 239-service catalogue.

## Test fixture and device manifest (fill when performed)

| Field | Sri Lanka lane | City of Vancouver lane |
| --- | --- | --- |
| Device/OS/app build | Pending | Pending |
| Customer and company test IDs (redacted) | Pending | Pending |
| Worker test IDs and identity approval IDs (redacted) | Pending | Pending |
| Company registration/document operations reviewer | Pending | Pending |
| Service address, canonical district/municipality | Pending | Pending |
| Service / exact catalogue selection IDs | Pending | Pending |
| Test execution UTC and operator | Pending | Pending |
| Evidence packet location and issue IDs | Pending | Pending |

## Execution sequence — required for each market

1. Create/verify separate company owner, manager/dispatcher, eligible worker,
   restricted worker and customer test personas. Confirm jurisdiction,
   currency and address eligibility: all 25 LK districts in the supported LK
   set; Vancouver only within the City of Vancouver municipality, not wider
   Metro Vancouver. Negative location and catalogue fixtures must fail closed.
2. Select existing exact services and save; log out/relaunch to ensure
   selections persist without inheriting sibling-category capabilities.
3. Upload company and person documents/identity photo using the approved
   manual operations process. Test not-yet-approved, rejected and expired
   credentials, and suspended, banned or demoted identities. Record actual
   reviewer sign-off; automated booleans do not substitute for human approval.
4. Invite worker, accept invite on a second phone, change role, deactivate and
   reactivate. Test an old owner after ownership transfer and an active
   successor owner. Confirm other customers' bookings stay unchanged.
5. Accept a **one-worker** company quote for an approved existing service.
   Dispatch an eligible WORKER, verify worker notification, personal acceptance
   and assigned booking visibility on both phones. Deny a suspended worker,
   missing photo, expired certificate, wrong market, wrong exact service and
   overlapping schedule.
6. With escrow confirmation in a non-live isolated test environment, exercise
   ARRIVAL then new START PIN, customer worker-photo comparison (when
   requested), work-start, safety centre, completion and closure. Attempt an
   incorrect PIN, duplicate use, mismatched identity, removed member and
   concurrent reassignment. Record resulting safe states and audit events.
7. For workersCount >= 2, **expect explicit blocked crew dispatch and PIN**.
   Do not simulate a single worker as completing a multi-person requirement.
   Full crew positive tests are pending the separate verified crew model.
8. Verify unrelated company members cannot access private booking documents,
   address/coordinates, accepted quotes, financials, work-start or worker
   photos. Verify country/municipality separation and cleanup of only
   transaction-owned fixture IDs.

## Acceptance verdict

- Automated validation requires three completed successful workflows at
  the exact final branch SHA. Confirm migration/postgres-orphan audits and
  container production build, not just fast tests.
- Separate QA sign-offs are required for LK and Vancouver for service
  selections, identities, documents, invitations, dispatch, location and PIN.
- **Phase 04 cannot be marked ACCEPTED** until the positive multi-worker
  workflow is implemented, these device tests are performed, and operational
  reviewers formally approve. No signature or outcome is pre-filled.

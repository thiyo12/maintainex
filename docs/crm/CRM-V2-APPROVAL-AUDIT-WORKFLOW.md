# MaintainEX CRM V2 — Approval & Audit Workflow

## Goal

All high-impact operations use one shared approval engine. Individual pages do not invent their own approval logic.

## Approval request lifecycle

DRAFT -> SUBMITTED -> PENDING_APPROVAL -> APPROVED -> EXECUTING -> SUCCEEDED

Alternative states:
- REJECTED
- CANCELLED
- EXPIRED
- ON_HOLD
- FAILED
- RETRY_PENDING (only for safely retryable/idempotent execution)

Approval state never replaces the underlying job/payment/dispute lifecycle.

## Server-side submission sequence

1. Authenticate live staff session.
2. Reload current AdminUser and AdminSession.
3. Evaluate role + explicit ALLOW/DENY.
4. Apply country/market scope.
5. Load target object from canonical source.
6. Verify object authorization.
7. Recompute amount, currency and business state server-side.
8. Classify action R0-R4.
9. Calculate base approval tier.
10. Apply velocity and high-risk exception rules.
11. Produce ALLOW / ESCALATE / HOLD / PROHIBIT.
12. Create approval request when required.
13. Append REQUEST_SUBMITTED audit event.
14. Notify eligible approvers.

The browser cannot provide the authoritative approval tier.

## Approval request data

Store:
- request ID
- action type
- initiator
- market
- target type/ID
- safe amount/currency
- tier
- reversibility class
- reason code
- note
- evidence/reference IDs
- risk flags
- policy version
- idempotency key
- expiry
- required approver classes
- approval/rejection events
- execution result/reference

Never store secrets in approval payloads.

## Approver sequence

For every decision:
1. authenticate live session
2. require step-up auth when policy says so
3. re-evaluate live permission/scope
4. enforce initiator != approver for maker-checker tiers
5. reload current target state
6. recalculate risk/tier
7. reject or re-tier stale request
8. persist decision
9. append audit event

A changed amount, payout destination, dispute state, KYC state, permission, or risk condition can invalidate previous approval.

## Execution sequence

After all approvals:
1. acquire idempotency/concurrency protection
2. reload canonical target
3. re-run invariants and risk policy
4. use transaction where required
5. call canonical domain service
6. persist ledger/business result
7. persist provider/gateway reference
8. append EXECUTION_SUCCEEDED or EXECUTION_FAILED
9. emit notifications
10. return minimal safe result

Approval never authorizes an arbitrary Prisma update.

## Step-up authentication

Required for:
- T2+ finance
- any manual escrow release
- payout destination change
- sensitive staff role/permission/scope change
- disabling major safety controls
- large broadcast
- high-risk exception override
- break-glass activation

Step-up must be time-bounded.

## Audit chain

Append-only event types include:
- REQUEST_CREATED
- REQUEST_SUBMITTED
- POLICY_TIER_CALCULATED
- RISK_HOLD_APPLIED
- APPROVAL_GRANTED
- APPROVAL_REJECTED
- APPROVAL_EXPIRED
- APPROVAL_CANCELLED
- STEP_UP_VERIFIED
- EXECUTION_STARTED
- EXECUTION_SUCCEEDED
- EXECUTION_FAILED
- RETRY_SCHEDULED
- COMPENSATING_ACTION_CREATED

Each event records actor, role, target, market, permission used, request/correlation ID, safe before/after summary, result, policy version, IP/user-agent where relevant.

Audit events cannot be edited through normal CRM.

## Expiry defaults

Initial policy:
- T1/T2 finance: 30 min
- T3/T4 finance: 15 min after final review begins
- payout destination/security changes: 15 min
- large broadcast: 30 min
- ordinary R2 operational approvals: 60 min

Material state changes can invalidate approval earlier.

## Failure policy

- uncertain gateway result -> reconciliation, not blind retry
- DB transaction failure -> no partial business commit
- notification failure after committed finance -> finance remains committed; notification retries separately
- approver loses permission -> invalidate if still needed
- new risk/dispute hold -> stop execution
- duplicate idempotency key -> resolve to existing action

## Break-glass

Break-glass may only move the system toward a safer state.

Allowed:
- freeze payouts
- pause market/channel
- suspend compromised account
- revoke sessions
- block IP
- quarantine file/process

Never allowed:
- mark unpaid money as paid
- release funds
- bypass ledger/idempotency
- delete audit
- silently grant SUPER_ADMIN
- bypass KYC/scope/object authorization

Requires step-up auth, mandatory reason, short-lived activation, CRITICAL audit event and post-incident review.

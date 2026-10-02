# MaintainEX CRM V2 — Action Reversibility & Confirmation Policy

## Why this matters

An action that can be undone safely should not use the same workflow as an action that sends money, publishes data externally, destroys evidence, or changes authentication.

CRM V2 classifies every mutation by reversibility.

## Classes

### R0 — Read-only
No business mutation.

Examples:
- view job
- view ledger
- search customer
- inspect health

Controls:
- authentication
- permission
- country/object scope
- rate limits
- privacy minimization

### R1 — Easily reversible operational action
Can be restored without loss of history or external side effect.

Examples:
- activate/deactivate catalog item
- pause/unpause tasker availability
- enable/disable an offer before it starts
- assign/unassign a non-started internal work item

Controls:
- permission
- validation
- audit
- normal confirmation where user impact exists

### R2 — Sensitive but reversible/controlled action
Can be reversed, but reversal has security/user impact or requires cleanup.

Examples:
- suspend/reactivate account
- change staff country scope
- change delegable permission
- freeze/unfreeze wallet
- reschedule job before work starts
- revoke/replace a credential decision where policy allows

Controls:
- sensitive permission
- step-up authentication for staff/security changes
- reason required
- audit before/after
- revoke/refresh affected sessions/cache where needed
- explicit confirmation

### R3 — Compensating-only action
The original action cannot truly be undone. Recovery requires a new compensating event.

Examples:
- financial ledger entry
- refund initiated at gateway
- payout initiated externally
- commission settlement
- cash-payment correction after accounting
- accepted change order affecting financial snapshot

Controls:
- canonical domain service
- idempotency
- transaction
- approval thresholds
- separation of duties
- step-up authentication
- reason/evidence
- immutable audit
- no delete/edit of original event

Example:
A payout is not "undone" by changing status back to PENDING.
If recovery is possible, create a reconciliation/reversal/return event.

### R4 — Irreversible or externally broadcast action
Cannot be reliably undone once executed.

Examples:
- mass push/email/SMS broadcast
- external payout completed
- destructive legal/privacy deletion after retention rules
- publishing sensitive data externally
- irreversible credential/security rotation event
- permanent purge after retention period

Controls:
- preview/dry-run where possible
- explicit human confirmation
- step-up authentication
- highest applicable permission
- dual approval for high-impact cases
- delayed execution/cooling window where practical
- immutable audit
- execution receipt

## Action map

| Action | Class | CRM behavior |
|---|---|---|
| Activate/deactivate service | R1 | single authorized action + audit |
| Change service ordering | R1 | authorized + audit |
| Disable market booking | R2 | confirmation + reason + audit |
| Suspend customer/tasker/company | R2 | confirmation + reason + session/access effects |
| Reactivate account | R2 | re-check eligibility/risk first |
| Revoke staff session | R2 | immediate, audited; cannot restore same token |
| Change staff role/permission | R2 | step-up + audit + live authorization invalidation |
| Reset staff password | R2 | secure reset + revoke sessions; old password cannot be restored |
| Approve KYC | R2 | evidence required + audit; later revocation is a new decision |
| Reject KYC | R2 | reason + audit |
| Delete private KYC file | R4 or prohibited | only per retention/privacy policy |
| Reschedule job before start | R2 | lifecycle validation + notifications |
| Cancel unstarted job | R2/R3 | may trigger fee/refund; finance effects become compensating-only |
| Cancel in-progress job | R3 | dispute/financial workflow required |
| Complete job | R3 | lifecycle/financial effects; correction via follow-up event |
| Rotate/revoke job PIN | R2 | audit; old PIN becomes invalid |
| Mark arrival/start manually | prohibited direct action | only formal exception workflow |
| Accept quote | R3 | price snapshot/lifecycle effect; changes use revision/change order |
| Change order acceptance | R3 | immutable financial/lifecycle effect |
| Delete/edit historical user chat | prohibited by default | moderation/redaction uses separate audited action |
| Send one support notification | R2/R4 depending channel | preview where possible; cannot guarantee recall |
| Mass broadcast | R4 | audience preview + dual/high-risk confirmation |
| Create refund before gateway call | R2 | request may be cancelled before execution |
| Gateway refund submitted/completed | R3/R4 | compensate/reconcile; cannot edit history |
| Escrow release before external payout | R3 | cannot simply edit back; compensating finance path |
| Payout submitted | R3 | reconciliation/return workflow |
| Payout completed | R4 | external recovery only |
| Wallet correction | R3 | append compensating ledger entry |
| Commission policy future version | R2 | future config can be superseded |
| Historical commission ledger | R3 | append correction only |
| Settlement completed | R3/R4 | reversal/reconciliation event, never delete |
| Block IP | R1/R2 | unblock possible; audit |
| Delete audit record | prohibited | normal CRM has no mutation path |
| Change runtime feature flag | R1/R2 | reversible if runtime supports it |
| Change maintenance mode | R1/R2 | reversible, high operational impact |
| Change payment secret | R4/secure ops | rotation event, not normal CRM field edit |
| DB schema migration | deployment required | release pipeline, rollback/migration plan |
| Source-code change | deployment required | code review/tests/CI/deploy |

## Default confirmation UX

### R1
- no modal for harmless toggles where accidental action is low impact
- otherwise simple confirmation

### R2
- confirmation modal
- show exact affected entity/market
- reason required for sensitive actions
- step-up auth for staff/security/high-impact operations

### R3
- dedicated review screen, not generic modal
- show amount/currency/recipient/job/reference
- show consequences
- idempotency key
- approval state
- typed confirmation for exceptional actions where useful

### R4
- preview/dry run
- explicit acknowledgement
- step-up auth
- dual approval where high impact
- execution receipt
- no misleading "undo" button

## Delete policy

Prefer:
- soft delete
- deactivate
- revoke
- supersede
- compensate

Hard deletion is reserved for:
- privacy/legal retention workflow
- non-production/test data with authorized procedure
- data that has no audit/financial/security retention requirement

Financial, security and audit history must not be hard-deleted through normal CRM.

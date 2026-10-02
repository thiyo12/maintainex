# MaintainEX CRM V2 — Finance Approval Thresholds

## Purpose

Financial controls must use four-eyes approval, market-aware limits, step-up authentication, idempotency, and append-only accounting.

The numbers below are **initial Sri Lanka defaults** for CRM V2 design. They are stored as protected server-side policy, configurable only by SUPER_ADMIN through an audited policy workflow. They are not hardcoded into frontend code.

For additional markets, define equivalent thresholds in the market currency. Never convert an approval limit using a client-supplied FX rate.

## Universal finance rules

1. No staff member may approve their own initiated high-risk financial action.
2. UI approval is never authority; the API recomputes amount, currency, job state, refundability, escrow state, recipient and permission.
3. All money movement uses canonical finance services, transactions and idempotency.
4. Historical ledger rows are append-only. Corrections use compensating entries.
5. Changing payout/bank destination increases risk and may impose a cooling period before payout.
6. High-risk disputes, fraud flags, KYC failure, sanctions/security holds, or currency mismatch override amount thresholds and force escalation.
7. Multiple actions are aggregated for velocity controls to stop threshold splitting.
8. Step-up authentication is required for sensitive approvals.
9. Exact gateway secrets are never exposed in CRM.
10. SUPER_ADMIN is an escalation authority, not the normal daily finance operator.

## Approval tiers

### T0 — System-routine action
No staff approval when all canonical lifecycle conditions are satisfied.

Examples:
- scheduled escrow release after verified completion and release window
- scheduled commission settlement generation
- idempotent gateway reconciliation

Requirements:
- canonical automated rule
- no active dispute/risk hold
- amount/currency match
- immutable audit/ledger event

### T1 — Single finance approval
Initial LK default: up to **LKR 25,000** per manual financial correction/action.

Approver:
- FINANCE with exact permission

Examples:
- small refund
- small compensating wallet adjustment
- retry/reconcile a low-value payout where no destination changed

Requirements:
- step-up auth
- reason code
- supporting reference
- audit
- velocity checks

### T2 — Dual approval
Initial LK default: **LKR 25,001–100,000**.

Actors:
- FINANCE initiates
- MANAGER or a different authorized FINANCE approver approves

Requirements:
- approver cannot equal initiator
- step-up auth for both
- structured reason/evidence
- idempotency and transaction
- audit both actors

### T3 — Senior approval
Initial LK default: **LKR 100,001–500,000**.

Actors:
- FINANCE initiates
- MANAGER reviews
- SUPER_ADMIN approves

For organizations with a designated Finance Lead permission, that role may replace MANAGER review only if explicitly configured.

### T4 — Executive / exceptional approval
Initial LK default: **above LKR 500,000**, or any action escalated by risk policy regardless of amount.

Actors:
- FINANCE prepares
- MANAGER/Finance Lead reviews
- SUPER_ADMIN final approval

Additional:
- explicit human confirmation of recipient/destination
- recent destination-change check
- fraud/risk hold check
- optional out-of-band verification for exceptionally large amounts
- enhanced audit note

## Action-specific policy

### Refunds

- <= LKR 25,000: T1, if within refundable balance and no high-risk flag.
- LKR 25,001–100,000: T2.
- LKR 100,001–500,000: T3.
- > LKR 500,000: T4.
- Full refund after work has started: minimum T2.
- Refund after completion/payment release: minimum T3 unless canonical policy explicitly supports it.
- Refund exceeding remaining refundable amount: prohibited.
- Duplicate refund attempt: prohibited/idempotently rejected.

### Escrow release

Normal lifecycle release:
- T0 when canonical completion, dispute and release conditions are satisfied.

Manual/forced release:
- never T1.
- <= LKR 100,000: minimum T2.
- LKR 100,001–500,000: T3.
- > LKR 500,000: T4.
- any active dispute/risk hold: cannot release until hold is resolved by authorized workflow.

### Escrow refund

Same thresholds as Refunds, but:
- active dispute resolution must be linked
- payout/commission consequences computed server-side
- manual refund after partial release requires at least T3

### Wallet adjustment

Direct balance editing is prohibited.

Compensating ledger adjustment:
- <= LKR 10,000: T1
- LKR 10,001–50,000: T2
- LKR 50,001–250,000: T3
- > LKR 250,000: T4

Every adjustment needs:
- reason code
- source incident/reference
- immutable compensating ledger entry

### Payout / withdrawal

Routine eligible payout:
- <= LKR 100,000: T1
- LKR 100,001–500,000: T2
- LKR 500,001–1,000,000: T3
- > LKR 1,000,000: T4

Escalate regardless of amount when:
- payout destination changed recently
- KYC recently changed
- risk flag exists
- unusual velocity
- first payout above configurable threshold
- payout country/currency mismatch

A payout destination change and payout must not be approved by the same single actor.

### Company/tasker settlements

Per-recipient settlement:
- <= LKR 250,000: T1
- LKR 250,001–1,000,000: T2
- LKR 1,000,001–5,000,000: T3
- > LKR 5,000,000: T4

Batch settlement:
- evaluate both each recipient AND aggregate batch total
- batch total > LKR 5,000,000 requires T4

### Commission configuration

Historical commission:
- never edited

Future commission policy:
- MANAGER/FINANCE may propose
- SUPER_ADMIN publishes
- effective date/version required
- existing jobs retain immutable price/commission snapshots unless explicit migration policy exists

### Cash payment correction

Cash recorded/verified through canonical workflow.

Manual correction:
- <= LKR 25,000: T1
- above LKR 25,000: at least T2
- correction that changes commission/settlement after job completion: minimum T3

## Velocity / anti-splitting controls

Thresholds apply to individual action AND cumulative activity.

Initial detection windows:
- same job: all related financial actions
- same recipient: rolling 24h and 7d totals
- same staff initiator: rolling 24h total
- same payout destination: rolling 24h and 7d total

If multiple smaller operations appear designed to avoid a threshold, escalate to the tier based on aggregate amount.

## Policy implementation

Store finance policy server-side by market:
- currency
- action type
- T1/T2/T3/T4 amount
- velocity limits
- cooling periods
- permitted approver roles
- step-up requirement
- risk escalation rules

Frontend receives safe labels/threshold summaries only, never authority to decide the tier.

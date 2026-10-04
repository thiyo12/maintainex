# MaintainEX Provider Balance, Cash Commission & Identity Integrity Architecture

Status: implementation contract
Branch: `feature/provider-balance-integrity-architecture`
Base main: `025cb38b4bce145633ac485313d4f9106792c57b`

## 1. Goal

Support the complete MaintainEX marketplace across Sri Lanka and Canada without creating separate finance systems.

The same domain layer must support:

- Sri Lanka cash-on-completion
- Sri Lanka online gateway (provider selected later)
- Canada PayPal
- individual taskers
- companies and verified company workers
- commission collection
- provider earnings
- payouts
- refunds/disputes
- provider identity continuity
- account closure and re-registration abuse controls
- customer worker-identity confirmation
- CRM finance, trust and audit controls

Existing canonical primitives remain authoritative:

- PaymentIntent / PaymentProviderTransaction / PaymentProviderEvent
- JobEscrow
- FinancialLedger
- CommissionSettlement / WeeklySettlement
- ProviderWallet / WalletBalance
- MarketplaceRiskEvent
- JobLifecycleEvent
- CRM governance / approval / audit controls

This work extends those primitives. It must not create a parallel payment ledger.

## 2. Domain architecture

```text
                         MARKET / PAYMENT SELECTION
                                  |
                +-----------------+------------------+
                |                                    |
             Sri Lanka                            Canada
          +------+-------+                           |
          |              |                           |
        CASH        LK ONLINE GATEWAY              PAYPAL
          |              |                           |
          +--------------+-------------+-------------+
                                       |
                               Payment / Cash Domain
                                       |
                           +-----------+-----------+
                           |                       |
                     Funded payment           Cash collection
                           |                       |
                    PaymentIntent            Cash confirmation
                    provider verify                 |
                    signed webhook                  |
                           |                 Provider receivable
                           |                       |
                           +-----------+-----------+
                                       |
                                    Ledger
                                       |
                   +-------------------+-------------------+
                   |                   |                   |
                Escrow           Commission           Provider
                                 / receivable          earnings
                   |                   |                   |
                   +-------------------+-------------------+
                                       |
                               Provider Balance
                                       |
                     +-----------------+------------------+
                     |                                    |
              future online offset                 direct settlement
                     |                                    |
                     +-----------------+------------------+
                                       |
                                    Payout
```

## 3. Provider identity architecture

Financial obligations belong to a durable verified provider identity, not to a login account.

```text
User login / company staff account
             |
             v
      ProviderIdentity
      - TASKER
      - COMPANY
      - COMPANY_WORKER
             |
      +------+-------+
      |              |
Identity claims   Verified profile
(HMAC hashes)    photo / KYC state
      |              |
      +------+-------+
             |
      Financial account
             |
      Commission liability
```

Closing/deactivating a login does not delete the provider identity, ledger, unresolved commission, settlements, disputes or audit history.

Identity claims store deterministic protected hashes only. Raw NIC/passport/bank identifiers must not be copied into the duplicate-detection table.

Shared device, IP, address or family relationship is a risk signal only and never sufficient by itself to transfer debt or block another person.

## 4. Cash lifecycle

```text
Customer selects CASH
        |
JobEscrow -> CASH_CONFIRMED
        |
Provider performs work
        |
Customer confirms worker + completion + cash paid
        |
Job -> COMPLETED
        |
Create cash platform receivable
        |
Commission + applicable service fee becomes due
        |
ProviderFinancialAccount updated
        |
Policy evaluated
   +----+-------------------------+
   |                              |
below threshold              threshold / overdue
   |                              |
cash jobs allowed            cash jobs restricted
online jobs allowed          online jobs still allowed
                                  |
                           future online earnings
                                  |
                           automatic debt offset
```

Cash never manufactures escrow funds. MaintainEX records a receivable from the provider instead.

## 5. Provider balance

User-facing name: **MaintainEX Balance**.

It is not a general consumer stored-value wallet.

Required values:

- available earnings
- pending earnings
- commission due
- oldest commission due date
- cash-job eligibility
- next settlement / payout
- transaction / ledger history

Individual tasker:
- cash commission accrues per completed cash job
- direct settlement is allowed
- future online earnings can offset outstanding commission
- cash jobs can be restricted while online jobs remain available for recovery

Company:
- liability belongs to the company provider identity
- employee accounts never own company commission debt
- weekly settlement can aggregate company cash jobs
- future online company earnings can offset the company liability

## 6. Financial standing policy

Policy is configurable by market, provider type and currency.

Required policy outputs:

- CLEAR
- WARNING
- CASH_RESTRICTED
- REVIEW_REQUIRED

Inputs:

- outstanding commission
- oldest unpaid commission age
- warning threshold
- cash restriction threshold
- review threshold
- maximum debt age
- auto-offset enabled

Rules must not use a single threshold as the only fraud control.

## 7. Account closure and re-registration

Before closure:

- active jobs
- disputes
- pending refunds
- payouts
- commission due
- KYC / risk holds

If unresolved commission exists:
- login/work access may be closed
- identity becomes CLOSED_WITH_BALANCE
- financial records remain
- new registration matching strong identity claims becomes PENDING_REVIEW

A relative/friend is not automatically liable for another person's debt.

## 8. Verified worker identity

Tasker public photo is a verified identity photo and is not directly editable.

Photo update:

```text
Request photo change
 -> new photo/selfie
 -> liveness
 -> face/identity match
 -> CRM review when required
 -> approve/reject
 -> audit
```

Customer sees:
- verified photo
- display name
- profession
- rating / completed jobs
- "Identity verified by MaintainEX"

Customer never sees:
- NIC/passport number
- ID document image
- DOB
- address
- bank details
- private KYC metadata

For company work:
- company is verified
- assigned worker is separately verified
- customer sees the assigned worker photo before work starts

## 9. Arrival / start protection

Recommended job sequence:

```text
quote accepted
 -> payment commitment
 -> worker assigned
 -> customer sees verified worker
 -> worker arrives
 -> customer confirms identity
 -> start PIN
 -> work begins
 -> completion request
 -> customer confirms completion/payment
```

"Different person arrived" creates a Trust & Safety event and can stop the start-PIN flow pending resolution.

## 10. Matching and booking restrictions

Provider eligibility remains the shared base gate.

Additional financial gate is payment-method aware:

- online-paid job: normally allowed even when cash-restricted, so debt can be recovered
- cash job: blocked when provider financial standing is CASH_RESTRICTED or REVIEW_REQUIRED
- company worker assignment: assigned worker identity must be verified
- identity mismatch / active integrity hold can block work start

## 11. Online earnings offset

Old cash commission is recovered from future provider online earnings before payout.

Accounting rule:

- do not recognize platform revenue twice
- cash completion already created the platform receivable
- later online recovery clears the provider receivable
- provider wallet receives only the remaining net amount
- allocation must be idempotent and oldest-liability-first

## 12. Sri Lanka and Canada payment architecture

Canada:
- PAYPAL
- CAD
- signed webhook + server capture
- canonical PaymentIntent -> Escrow -> Ledger -> Payout/Refund

Sri Lanka:
- CASH
- LKR
- provider receivable + settlement
- online gateway adapter selected only after marketplace merchant-model approval

The Sri Lanka gateway must support the required receive/refund/reconciliation lifecycle. Authorization/capture is preferred where supported.

## 13. App surfaces

### Customer app
- market-aware payment choices
- cash explanation
- verified provider photo
- assigned company worker photo
- identity confirmation before start
- "different person arrived"
- completion cash confirmation
- receipt/payment/refund status

### Tasker app
- MaintainEX Balance
- commission due
- pending/available earnings
- cash-job eligibility
- pay balance
- future payout offset notice
- immutable verified profile photo
- photo-change request
- financial restriction banners/history

### Company app
- company MaintainEX Balance
- weekly settlement
- outstanding commission
- cash limit / cash eligibility
- employee verification status
- assigned-worker controls
- settlement/payment history
- company-level liability

## 14. CRM surfaces

### Tasker / Company 360
- financial standing
- commission due
- oldest debt
- cash eligibility
- online-job eligibility
- identity status
- verified photo
- linked identity-risk signals
- closure status

### Finance
- provider receivables
- weekly settlements
- commission payments
- future-earning offsets
- provider balances
- payout deductions
- reconciliation
- ledger drill-down

### Trust & Safety
- identity mismatch reports
- duplicate/proxy registration signals
- strong identity-claim matches
- device/IP/shared-address signals as secondary evidence only
- manual review
- actions and audit trail

### Identity
- KYC
- verified photo
- photo change requests
- company worker verification

### Policy
- warning threshold
- cash restriction threshold
- review threshold
- maximum debt age
- settlement cadence
- auto-offset rule
- market/provider-type configuration

High-risk manual financial or identity overrides must use existing CRM step-up/approval/audit controls.

## 15. Security invariants

- no client-controlled commission amount
- no client-controlled payment amount/currency
- no raw strong identifiers in duplicate-identity indexes
- deterministic claim hashes use a server-side secret/pepper
- no provider can edit verified profile photo directly
- no deletion of financial history on account closure
- all balance mutations idempotent
- FinancialLedger remains accounting source of truth
- cash flow never credits fake escrow funds
- debt cannot move between unrelated people automatically
- device/IP signals are never sole identity proof
- currency isolation is mandatory
- manual CRM overrides are audited

## 16. Build order

1. Foundation models + financial-standing policy.
2. Cash receivable creation on completed cash jobs.
3. Provider balance read model and tasker/company APIs.
4. Cash restriction enforcement.
5. Future online-earnings debt offset + liability allocation.
6. Tasker/company Balance UI.
7. Durable provider identity + claim hashing / closure checks.
8. Locked verified profile photo + photo-change workflow.
9. Company worker identity verification + customer identity confirmation.
10. Duplicate/proxy risk engine + CRM review.
11. CRM finance/identity/policy surfaces.
12. Sri Lanka online gateway adapter after provider approval.
13. Canada PayPal sandbox E2E + Sri Lanka cash/online E2E.
14. Security/regression/production rollout gates.

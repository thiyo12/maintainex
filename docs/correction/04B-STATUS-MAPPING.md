# 04B-STATUS-MAPPING.md — Complete Status/State Mapping

> Generated: Phase 4B — Status and State Mapping
> Scope: Every status field across all marketplace models, with transitions, actors, and side effects

---

## MARKETPLACEJOB STATUS

### Current Values

| Status | Production Count | Meaning |
|---|---|---|
| OPEN | 12 | Job posted, awaiting provider quotes |
| QUOTE_ACCEPTED | 0 | Customer selected a quote, awaiting escrow funding |
| IN_PROGRESS | 10 | Escrow funded, work in progress |
| COMPLETED | 6 | Work completed, escrow released |
| CANCELLED | 8 | Job cancelled by customer/provider/admin |

### Canonical Lifecycle

```
                    ┌──────────────────────────────────────┐
                    │                                      │
                    ▼                                      │
                  OPEN ──────→ QUOTE_ACCEPTED ──────→ IN_PROGRESS ──────→ COMPLETED
                    │              │                       │
                    │              │                       │
                    ▼              ▼                       ▼
                CANCELLED      CANCELLED              CANCELLED
                               (escrow timeout)       (dispute)
```

### Valid Transitions

| From | To | Actor | Financial Side Effects | Notification Side Effects |
|---|---|---|---|---|
| (new) | OPEN | Customer (POST /v2/jobs) | None | blastJobToTaskers |
| OPEN | QUOTE_ACCEPTED | Customer (select-quote) | JobEscrow created (PENDING_PAYMENT) | notifyQuoteAccepted |
| QUOTE_ACCEPTED | IN_PROGRESS | Customer (POST /escrow) | CustomerWallet debited, JobEscrow → PROTECTED | notifyEscrowDeposited |
| QUOTE_ACCEPTED | OPEN | Cron (daily-maintenance, 24h timeout) | JobEscrow → CANCELLED, JobQuote → PENDING | notify provider (escrow timeout) |
| IN_PROGRESS | COMPLETED | Customer (APPROVE_COMPLETION or release-escrow) | ProviderWallet credited, JobEscrow → RELEASED, commission deducted | notifyJobCompleted, notifyPaymentReleased |
| IN_PROGRESS | CANCELLED | Customer or Provider (DISPUTE) | JobEscrow → ON_HOLD | None (dispute flow) |
| OPEN | CANCELLED | Customer/Admin (cancel) | None | None |
| Any | CANCELLED | Admin (PATCH /admin/jobs) | None | None |

### Workspace Side Effects

| Job Status Change | Workspace Effect |
|---|---|
| → QUOTE_ACCEPTED | JobWorkspace upserted (progressStatus=ACCEPTED) |
| → IN_PROGRESS | JobWorkspace.progressStatus = IN_PROGRESS (after OTP verify) |
| → COMPLETED | JobWorkspace.progressStatus = COMPLETED |
| → CANCELLED (dispute) | JobWorkspace.progressStatus = DISPUTED |

---

## JOBQUOTE STATUS

### Current Values

| Status | Meaning |
|---|---|
| PENDING | Quote submitted, awaiting customer decision |
| ACCEPTED | Customer selected this quote |
| REJECTED | Customer selected a different quote |
| WITHDRAWN | Customer refunded escrow, quote withdrawn |

### Valid Transitions

| From | To | Actor | Side Effects |
|---|---|---|---|
| (new) | PENDING | Provider (POST /quotes) | First quote: MarketplaceJob.responseState → responded |
| PENDING | ACCEPTED | Customer (select-quote) | All other quotes → REJECTED; JobWorkspace upserted; JobEscrow created |
| PENDING | REJECTED | Customer (select-quote) | Batch rejection of non-selected quotes |
| PENDING | WITHDRAWN | Customer (escrow refund) | MarketplaceJob → CANCELLED |
| ACCEPTED | PENDING | Cron (daily-maintenance, escrow timeout) | MarketplaceJob → OPEN |

---

## JOBWORKSPACE STATUS (progressStatus)

### Current Values

| ProgressStatus | Meaning |
|---|---|
| ACCEPTED | Quote accepted, awaiting escrow funding |
| IN_PROGRESS | Escrow funded, OTP verified, work started |
| WAITING_CUSTOMER | Provider waiting for customer action |
| COMPLETION_REQUESTED | Provider marked work complete, awaiting customer approval |
| COMPLETED | Customer approved completion |
| DISPUTED | Dispute raised by either party |

### Valid Transitions

| From | To | Actor | Side Effects |
|---|---|---|---|
| (new) | ACCEPTED | Customer (select-quote) | MarketplaceJob → QUOTE_ACCEPTED |
| ACCEPTED | IN_PROGRESS | Customer (OTP verify) | notifyJobStarted |
| IN_PROGRESS | WAITING_CUSTOMER | Provider | None |
| IN_PROGRESS | COMPLETION_REQUESTED | Provider (MARK_COMPLETE) | notifyCompletionRequested |
| WAITING_CUSTOMER | IN_PROGRESS | Customer/Provider | None |
| COMPLETION_REQUESTED | COMPLETED | Customer (APPROVE) | MarketplaceJob → COMPLETED, escrow release |
| Any | DISPUTED | Customer/Provider (DISPUTE) | MarketplaceJob → CANCELLED, escrow → ON_HOLD |

---

## JOBESCROW STATUS

### Current Values

| Status | Meaning |
|---|---|
| PENDING_PAYMENT | Escrow created, awaiting customer funding |
| PROTECTED | Funds deposited from customer wallet |
| RELEASED | Funds released to provider (job completed) |
| REFUNDED | Funds returned to customer (job cancelled) |
| ON_HOLD | Funds held during dispute |

### Valid Transitions

| From | To | Actor | Side Effects |
|---|---|---|---|
| (new) | PENDING_PAYMENT | Customer (select-quote) | MarketplaceJob → QUOTE_ACCEPTED |
| PENDING_PAYMENT | PROTECTED | Customer (POST /escrow) | CustomerWallet debited, WalletTransaction created, MarketplaceJob → IN_PROGRESS |
| PENDING_PAYMENT | CANCELLED | Cron (daily-maintenance, 24h) | MarketplaceJob → OPEN, JobQuote → PENDING |
| PROTECTED | RELEASED | Customer (approve/release) or Cron (48h auto) | ProviderWallet credited, commission deducted, MarketplaceJob → COMPLETED |
| PROTECTED | REFUNDED | Customer (refund) | CustomerWallet credited, MarketplaceJob → CANCELLED, JobQuote → WITHDRAWN |
| PROTECTED | ON_HOLD | Customer/Provider (DISPUTE) | MarketplaceJob → CANCELLED |
| ON_HOLD | RELEASED | Admin (force-release) | ProviderWallet credited, MarketplaceJob → COMPLETED |
| ON_HOLD | REFUNDED | Admin (force-refund) | CustomerWallet credited, MarketplaceJob → CANCELLED |

---

## OFFERBOOKING STATUS (if used)

| Status | Meaning |
|---|---|
| pending | Offer booking created, awaiting matching |
| finding | System searching for taskers |
| accepted | Tasker accepted the offer |
| in_progress | Work in progress |
| completed | Work completed |
| no_tasker_available | No taskers available in pool |
| cancelled | Customer cancelled |

**Note:** OfferBooking has 0 production rows. This status machine exists in code but is unused.

---

## DISPUTE STATUS (V1)

| Status | Meaning |
|---|---|
| OPEN | Dispute raised |
| UNDER_REVIEW | Admin reviewing |
| RESOLVED | Dispute resolved |
| DISMISSED | Dispute dismissed |

**Note:** V1 Dispute references JobPosting. V2 dispute is via MarketplaceJob action (no dedicated model).

---

## REVIEW STATUS (V1)

| Status | Meaning |
|---|---|
| PENDING | Review awaiting moderation |
| APPROVED | Review published |
| REJECTED | Review rejected |

---

## JOBPOSTING STATUS (V1)

| Status | Production Count | Meaning |
|---|---|---|
| OPEN | 1 | Job posted, awaiting bids |
| ASSIGNED | 0 | Provider assigned |
| IN_PROGRESS | 0 | Work in progress |
| COMPLETED | 3 | Work completed |
| CANCELLED | 1 | Job cancelled |

---

## BOOKING STATUS (V1)

| Status | Production Count | Meaning |
|---|---|---|
| PENDING | 29 | Booking submitted |
| CONFIRMED | 0 | Booking confirmed |
| IN_PROGRESS | 1 | Service in progress |
| COMPLETED | 0 | Service completed |
| CANCELLED | 0 | Booking cancelled |
| INVOICED | 1 | Invoice created |

---

## OFFERMATCHQUEUE STATUS

| Status | Meaning |
|---|---|
| pending | Candidate in queue |
| notified | Candidate notified via push |
| accepted | Candidate accepted |
| declined | Candidate declined |
| expired | Notification timed out |

---

## JOBMATCHQUEUE STATUS

| Status | Meaning |
|---|---|
| pending | Candidate in queue |
| notified | Candidate notified |
| accepted | Candidate accepted |
| declined | Candidate declined |
| expired | Notification timed out |

---

## WEEKLYSETTLEMENT STATUS

| Status | Meaning |
|---|---|
| PENDING | Awaiting payment |
| PAID | Commission paid |
| OVERDUE | Payment overdue |
| SUSPENDED | Provider suspended for non-payment |

---

## COMMISSIONPAYMENT STATUS

| Status | Meaning |
|---|---|
| PENDING | Payment reference created |
| CONFIRMED | Payment confirmed by admin |

---

## PAYOUT STATUS

| Status | Meaning |
|---|---|
| PENDING | Withdrawal requested |
| PROCESSING | Payment being processed |
| CLEARED | Payment completed |
| REJECTED | Payment rejected |
| FAILED | Payment failed |

# 05A-FINANCIAL-STATE-MACHINES.md — State Machine Definitions

**Date**: Sep 8, 2026
**Evidence**: Code analysis, production data

---

## 1. JOB ESCROW STATE MACHINE

### States

```
┌──────────────┐     ┌──────────────────┐     ┌─────────────┐
│ PENDING_PAYMENT│────▶│    PROTECTED     │────▶│  RELEASED   │
└──────────────┘     └──────────────────┘     └─────────────┘
                            │                        ▲
                            ▼                        │
                     ┌──────────────┐     ┌──────────────┐
                     │   ON_HOLD    │────▶│  RELEASED    │
                     └──────────────┘     └──────────────┘
                            │
                            ▼
                     ┌──────────────┐     ┌──────────────┐
                     │  CANCELLED   │◀────│  REFUNDED    │
                     └──────────────┘     └──────────────┘
```

### Transitions

| From | To | Trigger | Guard | File:Line |
|------|-----|---------|-------|-----------|
| — | PENDING_PAYMENT | Quote accepted | Job status = OPEN | `select-quote/route.ts:47` |
| PENDING_PAYMENT | PROTECTED | Customer funds | Wallet balance ≥ amount | `escrow/route.ts:61` |
| PROTECTED | RELEASED | Manual release | Customer owns job | `release-escrow/route.ts:34` |
| PROTECTED | RELEASED | Completion | Customer approves | `complete/route.ts:68` |
| PROTECTED | RELEASED | Auto-release | Cron: escrow.timeout < now | `cron/escrow-release/route.ts:62` |
| PROTECTED | RELEASED | Cash payment | Provider triggers | `cash-payment/route.ts:38` |
| PROTECTED | RELEASED | Admin force | Admin FINANCE+ | `admin/escrows/route.ts:60` |
| PROTECTED | ON_HOLD | Dispute raised | Customer/Provider | `complete/route.ts:121` |
| ON_HOLD | RELEASED | Admin resolve | Admin FINANCE+ | `admin/escrows/route.ts:60` |
| PROTECTED | REFUNDED | Customer refund | Customer owns job | `escrow/refund/route.ts:29` |
| PROTECTED | REFUNDED | Admin force | Admin FINANCE+ | `admin/escrows/route.ts:102` |
| PENDING_PAYMENT | CANCELLED | Stale timeout | Cron: daily-maintenance | `cron/daily-maintenance/route.ts:44` |
| ON_HOLD | CANCELLED | Stale timeout | Cron: daily-maintenance | `cron/daily-maintenance/route.ts:44` |

### Production Distribution

| Status | Count | Amount (LKR) |
|--------|-------|-------------|
| PROTECTED | 4 | 2,132,500 |
| ON_HOLD | 3 | 292,500 |
| RELEASED | 2 | 440,000 |
| REFUNDED | 2 | 195,000 |
| **Total** | **11** | **3,060,000** |

---

## 2. MARKETPLACE JOB STATE MACHINE

### States

```
┌──────┐     ┌──────────────────┐     ┌─────────────┐
│ OPEN │────▶│ QUOTE_ACCEPTED   │────▶│ IN_PROGRESS │
└──────┘     └──────────────────┘     └─────────────┘
    │               │                        │
    ▼               ▼                        ▼
┌──────────┐  ┌──────────┐           ┌──────────┐
│CANCELLED │  │CANCELLED │           │ COMPLETED│
└──────────┘  └──────────┘           └──────────┘
                                          │
                                          ▼
                                   ┌──────────┐
                                   │CANCELLED │
                                   └──────────┘
```

### Transitions

| From | To | Trigger | Guard |
|------|-----|---------|-------|
| — | OPEN | Customer creates job | Auth required |
| OPEN | QUOTE_ACCEPTED | Customer selects quote | Exactly 1 quote selected |
| QUOTE_ACCEPTED | IN_PROGRESS | Customer funds escrow | Escrow PROTECTED |
| IN_PROGRESS | COMPLETED | Workspace completed | Both parties confirm |
| IN_PROGRESS | CANCELLED | Dispute raised | Escrow → ON_HOLD |
| Any | CANCELLED | Admin action | Admin role required |

---

## 3. JOB WORKSPACE STATE MACHINE

### States

```
┌───────────┐     ┌─────────────┐     ┌───────────┐
│ PENDING   │────▶│ IN_PROGRESS │────▶│ COMPLETED │
└───────────┘     └─────────────┘     └───────────┘
                        │
                        ▼
                 ┌───────────┐
                 │ DISPUTED  │
                 └───────────┘
```

### Production Distribution

| Status | Count |
|--------|-------|
| PENDING | 2 |
| IN_PROGRESS | 2 |
| COMPLETED | 1 |
| DISPUTED | 0 |
| **Total** | **5** |

---

## 4. WEEKLY SETTLEMENT STATE MACHINE

### States

```
┌─────────┐     ┌──────────┐     ┌──────────┐
│ PENDING │────▶│   PAID   │     │ OVERDUE  │
└─────────┘     └──────────┘     └──────────┘
     │                               │
     ▼                               ▼
┌──────────┐                  ┌──────────┐
│SUSPENDED │                  │ UNSUSPEND│
└──────────┘                  └──────────┘
```

### Transitions

| From | To | Trigger |
|------|-----|---------|
| — | PENDING | Weekly calculation |
| PENDING | PAID | Commission confirmed |
| PENDING | OVERDUE | Past due date |
| OVERDUE | PAID | Late payment |
| Any | SUSPENDED | Admin action |
| SUSPENDED | PENDING | Admin unsuspend |

### Production Distribution

| Status | Count |
|--------|-------|
| PENDING | 3 |
| PAID | 7 |
| **Total** | **10** |

---

## 5. COMMISSION SETTLEMENT STATE MACHINE

### States

```
┌─────────┐     ┌──────────┐
│ PENDING │────▶│ SETTLED  │
└─────────┘     └──────────┘
```

### Production Distribution

| Status | Count |
|--------|-------|
| PENDING | 3 |
| SETTLED | 7 |
| **Total** | **10** |

---

## 6. WALLET TRANSACTION ENTRY TYPES

### Types

| Type | Direction | Meaning |
|------|-----------|---------|
| ESCROW_DEPOSIT | DEBIT | Customer funds escrow |
| ESCROW_RELEASE | CREDIT | Provider receives escrow |
| ESCROW_REFUND | CREDIT | Customer receives refund |
| SERVICE_FEE | CREDIT/DEBIT | Platform fee movement |
| WITHDRAWAL | CREDIT/DEBIT | Provider withdrawal |
| TOPUP | CREDIT | Customer deposits funds |
| ADJUSTMENT | CREDIT/DEBIT | Admin manual adjustment |

### Production Distribution

| referenceType | CREDIT | DEBIT | Total |
|---------------|--------|-------|-------|
| ESCROW_RELEASE | 4 | 4 | 8 |
| SERVICE_FEE | 6 | 4 | 10 |
| WITHDRAWAL | 3 | 3 | 6 |
| **Total** | **13** | **11** | **24** |

---

## 7. PAYOUT STATE MACHINE (Current: DEAD)

### States

```
┌─────────┐     ┌──────────────┐     ┌─────────────┐
│ PENDING │────▶│  APPROVED    │────▶│ PROCESSING  │
└─────────┘     └──────────────┘     └─────────────┘
     │               │                    │
     ▼               ▼                    ▼
┌──────────┐  ┌──────────┐        ┌──────────┐
│ REJECTED │  │CANCELLED │        │ COMPLETED│
└──────────┘  └──────────┘        └──────────┘
                                    │
                                    ▼
                             ┌──────────┐
                             │  FAILED  │
                             └──────────┘
```

**Current production**: 0 rows in Payout table.

---

## STATE MACHINE SUMMARY

| Machine | States | Active Transitions | Production Rows |
|---------|--------|-------------------|-----------------|
| JobEscrow | 5 | 13 | 11 |
| MarketplaceJob | 4 | 5 | 36 |
| JobWorkspace | 4 | 4 | 5 |
| WeeklySettlement | 4 | 4 | 10 |
| CommissionSettlement | 2 | 2 | 10 |
| Payout | 7 | 8 | 0 (DEAD) |

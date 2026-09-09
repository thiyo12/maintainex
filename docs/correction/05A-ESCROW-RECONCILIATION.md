# 05A-ESCROW-RECONCILIATION.md — All 11 Escrows Classified

**Date**: Sep 8, 2026
**Evidence**: VPS PostgreSQL production data

---

## ESCROW INVENTORY

| # | Escrow ID | Amount (LKR) | Status | Job Status | Payment | Provider | Commission | Classification |
|---|-----------|-------------|--------|------------|---------|----------|------------|----------------|
| 1 | cmr8tov7z000dqyte7x1vjdar | 120,000 | PROTECTED | COMPLETED | CARD | NULL | NONE | SEED ORPHAN |
| 2 | cmr8tov740005qyteogf05h1b | 2,000,000 | PROTECTED | COMPLETED | CARD | NULL | NONE | SEED ORPHAN |
| 3 | cmq18o92g00059jtvcy73gm46 | 8,000 | PROTECTED | IN_PROGRESS | CASH | NULL | SETTLED (2,719) | LEGITIMATE |
| 4 | cmt2yxu6b000b5qrrjqaexmng | 4,500 | PROTECTED | IN_PROGRESS | CARD | cmt2yzqmx000c5qrrjxkczrj3 | NONE | LEGITIMATE |
| 5 | — | 150,000 | ON_HOLD | CANCELLED | CARD | — | NONE | DISPUTE |
| 6 | — | 82,500 | ON_HOLD | CANCELLED | CARD | — | NONE | DISPUTE |
| 7 | — | 60,000 | ON_HOLD | CANCELLED | CARD | — | NONE | DISPUTE |
| 8 | — | 200,000 | RELEASED | COMPLETED | CARD | — | NONE | SETTLED |
| 9 | — | 240,000 | RELEASED | COMPLETED | CARD | — | NONE | SETTLED |
| 10 | — | 100,000 | REFUNDED | CANCELLED | CARD | — | NONE | REFUNDED |
| 11 | — | 95,000 | REFUNDED | CANCELLED | CARD | — | NONE | REFUNDED |

---

## STATUS SUMMARY

| Status | Count | Amount (LKR) | % of Total |
|--------|-------|-------------|------------|
| PROTECTED | 4 | 2,132,500 | 69.7% |
| ON_HOLD | 3 | 292,500 | 9.6% |
| RELEASED | 2 | 440,000 | 14.4% |
| REFUNDED | 2 | 195,000 | 6.4% |
| **Total** | **11** | **3,060,000** | **100%** |

---

## PROTECTED ESCROW ANALYSIS

### Seed Data Orphans (2 escrows, LKR 2,120,000)

| Field | Job 1 | Job 2 |
|-------|-------|-------|
| Job Status | COMPLETED | COMPLETED |
| Created | Jul 6, 2026 | Jul 6, 2026 |
| Quote | NULL | NULL |
| Provider | NULL | NULL |
| Commission | NONE | NONE |
| Provider Wallet | DOES NOT EXIST | DOES NOT EXIST |

**Root Cause**: Seed data created escrows without corresponding customer deposits or provider assignments.

**Financial Impact**: ZERO — no real money was deposited. These are database artifacts.

**Resolution**: Mark as `SEED_ORPHAN` status in Phase 5 cleanup. Do NOT release to providers (money was never deposited).

### Legitimate Protected (2 escrows, LKR 12,500)

| Field | Escrow 3 | Escrow 4 |
|-------|----------|----------|
| Amount | LKR 8,000 | LKR 4,500 |
| Payment | CASH | CARD |
| Job Status | IN_PROGRESS | IN_PROGRESS |
| Provider | NULL (CASH) | cmt2yzqmx000c5qrrjxkczrj3 |
| Commission | SETTLED (LKR 2,719) | NONE |

**Resolution**: Keep PROTECTED until job completes. Normal lifecycle.

---

## ON_HOLD ESCROW ANALYSIS

| Escrow | Amount | Job Status | Trigger | Action Required |
|--------|--------|------------|---------|-----------------|
| #5 | LKR 150,000 | CANCELLED | Dispute raised | Admin review → release or refund |
| #6 | LKR 82,500 | CANCELLED | Dispute raised | Admin review → release or refund |
| #7 | LKR 60,000 | CANCELLED | Dispute raised | Admin review → release or refund |

**Total ON_HOLD**: LKR 292,500 (9.6% of total escrow)

**Issue**: These escrows have been ON_HOLD since the dispute was raised. Auto-release cron is NOT running (VPS cron not configured).

**Resolution Options**:
1. Admin manually release/refund via admin escrow endpoint
2. Configure VPS cron for daily-maintenance to process stale escrows
3. Both

---

## RELEASED ESCROW ANALYSIS

| Escrow | Amount | Release Path | Provider Credited | Commission |
|--------|--------|--------------|-------------------|------------|
| #8 | LKR 200,000 | Manual release | ✅ | Not calculated |
| #9 | LKR 240,000 | Completion | ✅ | Not calculated |

**Issue**: Released escrows show no CommissionSettlement records. Commission may have been skipped.

**Resolution**: Verify provider wallet credits match expected amounts. Retroactive commission may be needed.

---

## REFUNDED ESCROW ANALYSIS

| Escrow | Amount | Refund Path | Customer Credited | Commission |
|--------|--------|-------------|-------------------|------------|
| #10 | LKR 100,000 | Customer refund | ✅ | N/A |
| #11 | LKR 95,000 | Customer refund | ✅ | N/A |

**Status**: ✅ Correct — refunded money returned to customers.

---

## CROSS-REFERENCE: ESCROW → WALLET

### PROTECTED Escrows → Customer Debit Verification

| Escrow | Amount | Customer Wallet Debited? | Method |
|--------|--------|--------------------------|--------|
| #1 (seed) | LKR 120,000 | ⚠️ NO (no customer wallet for this user) | Seed artifact |
| #2 (seed) | LKR 2,000,000 | ⚠️ NO (no customer wallet for this user) | Seed artifact |
| #3 | LKR 8,000 | ✅ YES | CASH — no online debit |
| #4 | LKR 4,500 | ✅ YES | CARD — wallet debit |

### RELEASED Escrows → Provider Credit Verification

| Escrow | Amount | Provider Wallet Credited? | Amount Credited |
|--------|--------|---------------------------|-----------------|
| #8 | LKR 200,000 | ✅ YES | LKR 200,000 |
| #9 | LKR 240,000 | ✅ YES | LKR 240,000 |

---

## RECONCILIATION VERDICT

| Category | Status | Action |
|----------|--------|--------|
| Seed orphans (LKR 2,120,000) | ✅ Understood | Phase 5 cleanup — mark SEED_ORPHAN |
| Legitimate protected (LKR 12,500) | ✅ Correct | Keep until job completes |
| ON_HOLD disputes (LKR 292,500) | ⚠️ Stale | Admin action or cron needed |
| Released (LKR 440,000) | ⚠️ Verify commission | Check if commission was calculated |
| Refunded (LKR 195,000) | ✅ Correct | No action needed |

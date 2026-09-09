# 05A-FINANCIAL-WRITER-GRAPH.md — Complete Financial Writer Inventory

**Date**: Sep 8, 2026
**Scope**: All 27 writers that mutate financial state
**Evidence**: Production code analysis, Phase 4A.3 writer graph

---

## CLASSIFICATION LEGEND

| Class | Meaning |
|-------|---------|
| CANONICAL | Single correct implementation, uses `$transaction`, idempotent |
| UNSAFE | Active writer with bugs (no transaction, no idempotency, incorrect logic) |
| SEED | Seed/test data writer, no production financial impact |
| UNKNOWN | Writer exists but financial flow not traced |

---

## FINANCIAL WRITERS — 27 TOTAL

### CANONICAL (15 writers)

| # | Writer | Model Mutated | Operation | Classification |
|---|--------|---------------|-----------|----------------|
| 1 | `app/api/mobile/v2/jobs/[id]/select-quote/route.ts:47` | JobEscrow | CREATE | CANONICAL |
| 2 | `app/api/mobile/v2/jobs/[id]/select-quote/route.ts:40` | MarketplaceJob | UPDATE → QUOTE_ACCEPTED | CANONICAL |
| 3 | `app/api/mobile/v2/jobs/[id]/escrow/route.ts:61` | JobEscrow | UPDATE → PROTECTED | CANONICAL |
| 4 | `app/api/mobile/v2/jobs/[id]/escrow/route.ts:43` | CustomerWallet | UPDATE (debit) | CANONICAL |
| 5 | `app/api/mobile/v2/jobs/[id]/escrow/route.ts:50` | WalletTransaction | CREATE (ESCROW_DEPOSIT) | CANONICAL |
| 6 | `app/api/mobile/v2/jobs/[id]/escrow/refund/route.ts:29` | JobEscrow | UPDATE → REFUNDED | CANONICAL |
| 7 | `app/api/mobile/v2/jobs/[id]/escrow/refund/route.ts:33` | CustomerWallet | UPDATE (credit) | CANONICAL |
| 8 | `app/api/mobile/v2/jobs/[id]/escrow/refund/route.ts:41` | WalletTransaction | CREATE (ESCROW_REFUND) | CANONICAL |
| 9 | `app/api/mobile/v2/jobs/[id]/release-escrow/route.ts:34` | JobEscrow | UPDATE → RELEASED | CANONICAL |
| 10 | `app/api/mobile/v2/jobs/[id]/release-escrow/route.ts:38` | ProviderWallet | UPSERT (credit) | CANONICAL |
| 11 | `app/api/mobile/v2/jobs/[id]/release-escrow/route.ts:43` | WalletTransaction | CREATE (ESCROW_RELEASE) | CANONICAL |
| 12 | `app/api/mobile/v2/jobs/[id]/complete/route.ts:68` | JobEscrow | UPDATE → RELEASED | CANONICAL |
| 13 | `app/api/mobile/v2/jobs/[id]/complete/route.ts:72` | ProviderWallet | UPSERT (credit) | CANONICAL |
| 14 | `app/api/mobile/v2/jobs/[id]/complete/route.ts:84` | WalletTransaction | CREATE (ESCROW_RELEASE) | CANONICAL |
| 15 | `app/api/mobile/v2/admin/escrows/route.ts:60` | JobEscrow | UPDATE → RELEASED (admin) | CANONICAL |

### UNSAFE (8 writers)

| # | Writer | Model Mutated | Issue | Severity |
|---|--------|---------------|-------|----------|
| 16 | `app/api/mobile/v2/admin/escrows/route.ts:82` | MarketplaceJob | Admin force-release: sets absolute balance, skips commission calculation | P0 |
| 17 | `app/api/mobile/v2/admin/escrows/route.ts:102` | JobEscrow | Admin force-refund: no audit log, no `$transaction` | P1 |
| 18 | `app/api/mobile/v2/admin/escrows/route.ts:106` | CustomerWallet | Admin force-refund: no idempotency guard | P1 |
| 19 | `app/api/cron/escrow-release/route.ts:62` | JobEscrow | Auto-release: was missing `$transaction` (Phase 1 fixed), still no idempotency key | P1 |
| 20 | `app/api/cron/escrow-release/route.ts:68` | ProviderWallet | Auto-release: credit uses increment but no advisory lock | P1 |
| 21 | `app/api/cron/escrow-release/route.ts:82` | WalletTransaction | Auto-release: audit trail depends on stale read | P2 |
| 22 | `app/api/mobile/v2/jobs/[id]/cash-payment/route.ts:38` | JobEscrow | Cash payment: commission formula was wrong (Phase 1 fixed), no `$transaction` | P0 |
| 23 | `app/api/cron/daily-maintenance/route.ts:44` | JobEscrow | Stale escrow cancel: no `$transaction` around multi-step | P1 |

### SEED (10 writers)

| # | Writer | Model Mutated | Purpose |
|---|--------|---------------|---------|
| 24 | `prisma/seed.ts:736` | JobEscrow, ProviderWallet, CustomerWallet | Dev seed data |
| 25 | `app/api/seed/test-data/route.ts:153` | JobEscrow, ProviderWallet | Test data creation |
| 26 | `prisma/seed-*.ts` (5 files) | WeeklySettlement, CommissionPayment | Dev seed |
| 27 | `lib/v2-job-categories.ts:403` | TemplateJob, ServiceTemplate | Auto-seed catalog |

### UNKNOWN (1 writer)

| # | Writer | Model Mutated | Status |
|---|--------|---------------|--------|
| — | `app/api/mobile/v2/jobs/[id]/escrow/route.ts:110` | ProviderWallet read | READ-only but called in financial context |

---

## WRITERS WITHOUT `$transaction` (9 of 27)

| Writer | Writes | Risk |
|--------|--------|------|
| `admin/escrows/route.ts:82` (force-release) | JobEscrow + ProviderWallet + WalletTransaction | Crash mid-write = inconsistent balances |
| `admin/escrows/route.ts:102` (force-refund) | JobEscrow + CustomerWallet + WalletTransaction | Crash mid-write = money created/destroyed |
| `cash-payment/route.ts:38` | JobEscrow + ProviderWallet + WalletTransaction + CommissionSettlement | 4-step write without transaction |
| `daily-maintenance/route.ts:44` | JobEscrow + JobQuote + MarketplaceJob | Stale state left on partial failure |
| `escrow-release/route.ts:62` | JobEscrow + ProviderWallet + WalletTransaction | Phase 1 fixed with `$transaction` — **CANONICAL now** |
| `complete/route.ts:68` | JobEscrow + ProviderWallet + WalletTransaction | Uses `$transaction` — **CANONICAL** |
| `release-escrow/route.ts:34` | JobEscrow + ProviderWallet + WalletTransaction | Uses `$transaction` — **CANONICAL** |
| `select-quote/route.ts:47` | MarketplaceJob + JobEscrow + JobWorkspace | Uses `$transaction` — **CANONICAL** |
| `escrow/route.ts:61` | CustomerWallet + JobEscrow + WalletTransaction | Uses `$transaction` — **CANONICAL** |

---

## WRITERS WITHOUT IDEMPOTENCY (5 of 27)

| Writer | Duplicate Risk | Consequence |
|--------|---------------|-------------|
| `select-quote/route.ts:47` | Double escrow create on retry | Double wallet debit |
| `escrow/route.ts:61` | Double PROTECTED transition | Double customer debit |
| `release-escrow/route.ts:34` | Double provider credit | Overpayment |
| `complete/route.ts:68` | Double provider credit | Overpayment |
| `cash-payment/route.ts:38` | Double provider credit | Overpayment |

---

## WRITERS WITH ABSOLUTE BALANCE SET (2 of 27) — CRITICAL

| Writer | Current Logic | Required Logic |
|--------|---------------|----------------|
| `admin/escrows/route.ts:64` | `availableBalance: payout` (absolute) | `availableBalance: { increment: payout }` |
| `admin/escrows/route.ts:106` | `balance: refundedAmount` (absolute) | `balance: { increment: refundedAmount }` |

---

## WRITE SUMMARY BY MODEL

| Model | CANONICAL | UNSAFE | SEED | Total |
|-------|-----------|--------|------|-------|
| JobEscrow | 6 | 3 | 1 | 10 |
| ProviderWallet | 3 | 1 | 1 | 5 |
| CustomerWallet | 2 | 1 | 1 | 4 |
| WalletTransaction | 4 | 1 | 0 | 5 |
| MarketplaceJob | 1 | 1 | 0 | 2 |
| CommissionSettlement | 0 | 1 | 1 | 2 |
| JobQuote | 0 | 1 | 0 | 1 |
| **Total** | **16** | **8** | **3** | **27** |

*Note: Counts are per-model-mutation, not per-route-file. Some route files mutate multiple models.*

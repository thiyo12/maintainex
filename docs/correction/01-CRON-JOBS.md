# MaintainEX Cron Jobs Audit

## All 9 Cron Jobs

| # | File | Schedule | Auth | Transaction | Idempotent | Safe |
|---|---|---|---|---|---|---|
| 1 | `escrow-release` | `0 * * * *` (hourly) | Bearer | **NO** | NO | **NO** |
| 2 | `daily-maintenance` | `0 2 * * *` (daily) | Bearer | NO | NO | NO |
| 3 | `offer-timeouts` | `*/5 * * * *` (5min) | Bearer | NO | NO | NO |
| 4 | `matching-waves` | `*/10 * * * *` (10min) | Bearer | NO | NO | NO |
| 5 | `pricing-train` | `0 3 * * *` (daily) | Bearer | NO | NO | NO |
| 6 | `reputation` | `0 4 * * *` (daily) | Bearer | NO | NO | NO |
| 7 | `learn` | `0 3 * * *` (daily) | Bearer | NO | NO | NO |
| 8 | `job-response-escalation` | `*/15 * * * *` (15min) | Bearer | NO | NO | NO |
| 9 | `re-engagement` | `0 9 * * *` (daily) | Bearer | NO | NO | NO |

## Detailed Analysis

### Cron 1: Escrow Release (P0)
**File:** `app/api/cron/escrow-release/route.ts`
**Schedule:** Hourly
**4 unbounded operations in sequence — NO TRANSACTION:**

```
1. prisma.jobEscrow.update({ status: 'RELEASED' })
2. prisma.marketplaceJob.update({ status: 'COMPLETED' })
3. prisma.providerWallet.update({ availableBalance: { increment: payout } })
4. prisma.walletTransaction.create(...)
```

**Race condition:** Cron runs twice simultaneously → `increment: payout` executes twice → double credit.
**Failure mode:** Crash between steps 1-2 = money released but job not marked complete.

### Cron 2: Daily Maintenance (P1)
**File:** `app/api/cron/daily-maintenance/route.ts`
**Schedule:** Daily at 2am

Operations:
- Cancel stale OPEN quotes (5+ days)
- Cancel stale jobs (7+ days OPEN, never quoted)
- Cancel stale escrows (14+ days DEPOSITED)

No transaction wrapper. No idempotency.

### Cron 3: Offer Timeouts (P1)
**File:** `app/api/cron/offer-timeouts/route.ts`
**Schedule:** Every 5 minutes

Checks expiresAt on OfferBooking, OfferMatchQueue. Sets status to TIMED_OUT.

No transaction. Minimal impact.

### Cron 4: Matching Waves (P1)
**File:** `app/api/cron/matching-waves/route.ts`
**Schedule:** Every 10 minutes

Queries staggered by bookingType (template → flash → custom). Assigns from queue in batches of 5.

**Hardcoded ASSIGNED taskId:** `tsk037` assigned to all jobs regardless of template.

### Cron 5: Pricing Train (P2)
**File:** `app/api/cron/pricing-train/route.ts`
**Schedule:** Daily at 3am

**SQLite raw query in PostgreSQL production:**
```sql
SELECT ... FROM "JobPosting" WHERE createdAt >= datetime('now', '-30 days')
```
PostgreSQL requires `NOW() - INTERVAL '30 days'`. This **silently returns 0 rows** in production.

### Cron 6-9: Other Maintenance
Low risk. Simple queries, no financial mutations, no transaction needed.

## Recommendations

1. Wrap `escrow-release` in `prisma.$transaction` with idempotency key
2. Add distributed lock for `escrow-release` to prevent concurrent runs
3. Fix `datetime('now')` to `NOW()` in `pricing-train`
4. Remove hardcoded `tsk037` from matching-waves
5. Add transaction wrappers to all cron jobs that perform multiple mutations
6. Add idempotency (check if already processed) to all cron jobs

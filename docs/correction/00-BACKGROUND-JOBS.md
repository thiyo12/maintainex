# MaintainEX Background Jobs Audit

## 9 Cron Jobs

| # | Route | Schedule | Purpose | Financial? | Transaction? |
|---|---|---|---|---|---|
| 1 | `/api/cron/escrow-release` | Hourly | Release escrow to provider | YES | NO |
| 2 | `/api/cron/daily-maintenance` | Daily 2am | Cancel stale jobs/escrows | YES | NO |
| 3 | `/api/cron/offer-timeouts` | Every 5min | Expire old offers | No | NO |
| 4 | `/api/cron/matching-waves` | Every 10min | Wave escalation | No | NO |
| 5 | `/api/cron/pricing-train` | Daily 3am | ML training data | No | NO |
| 6 | `/api/cron/reputation` | Daily 4am | Score recalculation | No | NO |
| 7 | `/api/cron/learn` | Daily 3am | Learning cycle | No | NO |
| 8 | `/api/cron/job-response-escalation` | Every 15min | Escalation alerts | No | NO |
| 9 | `/api/cron/re-engagement` | Daily 9am | User re-engagement | No | NO |

## Vercel Cron Schedules

```json
// vercel.json
{ "crons": [
  {"path": "/api/cron/escrow-release", "schedule": "0 * * * *"},
  {"path": "/api/cron/daily-maintenance", "schedule": "0 2 * * *"},
  {"path": "/api/cron/offer-timeouts", "schedule": "*/5 * * * *"},
  {"path": "/api/cron/matching-waves", "schedule": "*/10 * * * *"},
  {"path": "/api/cron/pricing-train", "schedule": "0 3 * * *"},
  {"path": "/api/cron/reputation", "schedule": "0 4 * * *"},
  {"path": "/api/cron/learn", "schedule": "0 3 * * *"},
  {"path": "/api/cron/job-response-escalation", "schedule": "*/15 * * * *"},
  {"path": "/api/cron/re-engagement", "schedule": "0 9 * * *"}
]}
```

## Escrow Release Cron (P0)

**4 unbounded operations — NO TRANSACTION:**

```typescript
await prisma.jobEscrow.update({ status: 'RELEASED' })        // step 1
await prisma.marketplaceJob.update({ status: 'COMPLETED' })   // step 2
await prisma.providerWallet.update({ increment: payout })     // step 3
await prisma.walletTransaction.create(...)                     // step 4
```

**Race condition:** Cron runs twice → `increment: payout` executes twice → double credit.

## Matching Waves Cron

**Hardcoded ASSIGNED taskId:** `tsk037` assigned to all jobs regardless of template.

## Pricing Train Cron

**SQLite raw query in PostgreSQL production:**
```sql
SELECT ... FROM "JobPosting" WHERE createdAt >= datetime('now', '-30 days')
```
PostgreSQL requires `NOW() - INTERVAL '30 days'`. Silently returns 0 rows.

## Recommendations

1. Wrap `escrow-release` in `prisma.$transaction` with idempotency key
2. Add distributed lock for `escrow-release`
3. Fix `datetime('now')` to `NOW()` in `pricing-train`
4. Remove hardcoded `tsk037` from `matching-waves`

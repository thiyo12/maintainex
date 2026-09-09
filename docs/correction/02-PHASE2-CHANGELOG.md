# MaintainEX Phase 2 Changelog

## Changes Made

### Database Provider (Steps 2-3)

| File | Change |
|---|---|
| `prisma/schema.prisma:6` | `provider = "sqlite"` → `provider = "postgresql"` |
| `Dockerfile:12` | Removed `sed` provider swap hack |
| `Dockerfile:29` | Changed CMD from `prisma db push` to `prisma migrate deploy` |
| `.env:1` | Changed `DATABASE_URL` from `file:./dev.db` to PostgreSQL URL |

### SQLite-Specific SQL (Step 5)

| File | Change |
|---|---|
| `app/api/cron/pricing-train/route.ts:56` | `datetime('now')` → `NOW()`, quoted identifiers |
| `lib/security/tokens.ts` | Added double-quoted table/column names for PostgreSQL |

### Local Development (Step 11)

| File | Change |
|---|---|
| `docker-compose.yml` | NEW — PostgreSQL 16 Alpine with health check |

### Documentation (Steps 1, 4, 7-9, 17-20, 22, 27)

| File | Description |
|---|---|
| `docs/correction/02-DATABASE-PRECHANGE.md` | Pre-change safety snapshot |
| `docs/correction/02-SQL-COMPATIBILITY.md` | SQLite/PostgreSQL compatibility audit |
| `docs/correction/02-MIGRATION-AUDIT.md` | Migration history inventory |
| `docs/correction/02-MIGRATION-RUNBOOK.md` | Migration procedures for all environments |
| `docs/correction/02-LOCAL-POSTGRES.md` | Local PostgreSQL development setup |
| `docs/correction/02-MONEY-FIELD-INVENTORY.md` | All monetary fields classified |
| `docs/correction/02-INDEX-REVIEW.md` | Database index recommendations |
| `docs/correction/02-RELATION-INTEGRITY.md` | Foreign key audit |
| `docs/correction/02-BACKUP-RESTORE.md` | Backup/restore procedures |
| `docs/correction/02-CORS-POLICY.md` | CORS configuration |
| `docs/correction/02-PHASE2-CHANGELOG.md` | This file |
| `docs/correction/02-TEST-RESULTS.md` | Validation results |

## Files NOT Changed

- `prisma/schema.prisma` models — No structural changes
- Application routes — No business logic changes
- Auth system — No changes
- Financial system — No changes (withdrawal remains disabled)

## Risks Introduced

| Risk | Level | Mitigation |
|---|---|---|
| Local dev requires Docker | LOW | Documented in 02-LOCAL-POSTGRES.md |
| `prisma migrate deploy` in production | LOW | Already using `db push`, migration is safer |
| No `migration_lock.toml` | LOW | Will be created on first `migrate dev` |

## Risks Resolved

| Risk | Before | After |
|---|---|---|
| SQLite/PostgreSQL split | HIGH | RESOLVED — PostgreSQL is canonical |
| Docker sed hack | MEDIUM | RESOLVED — removed |
| `prisma db push` in production | MEDIUM | RESOLVED — using `migrate deploy` |
| `datetime('now')` SQLite SQL | HIGH | RESOLVED — using `NOW()` |
| `prisma validate` failure | HIGH | RESOLVED — passes with PostgreSQL |
| `prisma generate` failure | HIGH | RESOLVED — passes |
| `npm run build` failure | HIGH | RESOLVED — passes |

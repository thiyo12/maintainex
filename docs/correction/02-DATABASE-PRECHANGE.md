# MaintainEX Database Pre-Change Snapshot

## Current State

| Property | Value |
|---|---|
| Prisma provider | `sqlite` |
| Schema lines | 2640 |
| Model count | 122 |
| Enum count | 0 |
| Migration files | 5 (3 loose .sql, 2 proper folders) |
| Production provider | PostgreSQL (via Docker sed swap) |
| Production DB | `dokploy-postgres` container |
| DB password | `maintainex_db_2025` |
| Container | `maintainex-mx-vcaohy:prod-slim7` |

## Docker Provider Swap

```dockerfile
# Dockerfile line 12
RUN sed -i 's/provider = "sqlite"/provider = "postgresql"/' prisma/schema.prisma
```

## Build Scripts

| Script | Command | Issue |
|---|---|---|
| `npm run build` | `npx prisma generate && next build` | FAILS locally (SQLite + Json type) |
| Docker CMD | ~~`npx prisma db push && npm start`~~ `npx prisma migrate deploy && npm start` | ~~Uses `db push` not `migrate deploy`~~ **RESOLVED** |
| Docker builder | `sed` swap + `prisma generate` | Fragile hack |

## Database Environment Variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Prisma connection string |

## Raw SQL Locations

| File | Syntax | SQLite-specific? |
|---|---|---|
| `app/api/cron/pricing-train/route.ts:56` | `datetime('now')` | YES — needs `NOW()` |
| `lib/security/tokens.ts` | Parameterized queries | Compatible |
| `app/api/security/suspicious/route.ts` | Parameterized queries | Compatible |
| `app/api/industries/init/route.ts` | `NOW()`, `ON CONFLICT` | PostgreSQL-compatible |
| `app/api/health/route.ts` | `SELECT 1` | Compatible |

## Git Status

- Modified: 12 production files (Phase 1 changes)
- New: docs/correction/, tests/phase1/
- Pre-existing mobile changes: 40+ files

# MaintainEX Database Baseline

## Schema Provider Conflict

| Aspect | Local (Committed) | Production (Docker) |
|---|---|---|
| Provider | `sqlite` | `postgresql` (via `sed` swap) |
| DATABASE_URL | Local SQLite file | PostgreSQL on dokploy-postgres container |
| Schema application | `prisma db push` | ~~`prisma db push` (on container start)~~ **RESOLVED** — now uses `prisma migrate deploy` |
| Migrations | Never run via `prisma migrate` | Never run via `prisma migrate` |
| Raw queries | SQLite-compatible | Some break (`datetime('now')`) |

## Critical Issues

### 1. Fragile sed swap in Dockerfile
```
RUN sed -i 's/provider = "sqlite"/provider = "postgresql"/' prisma/schema.prisma
```
If the schema line format changes, this silently fails and the app tries to use SQLite against a PostgreSQL database.

### 2. datetime('now') in production
`app/api/cron/pricing-train/route.ts` uses SQLite-specific `datetime('now')`. PostgreSQL requires `NOW()` or `CURRENT_TIMESTAMP`. This raw query will fail in production.

### 3. No migration history
- No `migration_lock.toml` exists
- ~~Production uses `prisma db push` (destructive, non-versioned)~~ **RESOLVED** — now uses `prisma migrate deploy`
- 5 migration files exist but are never executed via `prisma migrate`
- 3 of 5 migrations are loose `.sql` files (non-standard format)

### 4. Dockerfile CMD runs db push on every start
```
CMD npx prisma migrate deploy && npm start
```
~~A breaking schema change could take down the service with no rollback.~~ **RESOLVED** — `migrate deploy` is versioned and non-destructive.

## Migration Files

| Migration | Format | Content |
|---|---|---|
| `20240101000000_add_crm_models.sql` | Loose .sql | Base schema (767 lines) |
| `20250101000000_add_mobile_models.sql` | Loose .sql | Chat, disputes, contracts, payouts |
| `20250601000000_add_location_fields.sql` | Loose .sql | Lat/lng fields |
| `20250626000000_add_name_change_cooldown/` | Proper folder | lastNameChangedAt on User |
| `20260830000000_add_customer_profile_fields/` | Proper folder | Customer profile fields |

## Recommendations

1. Standardize on PostgreSQL for both dev and production
2. Create proper migration history with `prisma migrate dev`
3. Switch production to `prisma migrate deploy` instead of `prisma db push`
4. Fix `datetime('now')` to `NOW()` in raw queries
5. Remove the `sed` hack from Dockerfile

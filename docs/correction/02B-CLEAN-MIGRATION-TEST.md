# MaintainEX Clean Migration Test

## Purpose

Verify that `prisma migrate deploy` can create the complete MaintainEX schema from scratch on an empty PostgreSQL database.

## Status

**BLOCKED** — No PostgreSQL instance available locally (Docker not installed).

## Expected Procedure

```bash
# 1. Start PostgreSQL
docker compose up -d

# 2. Create clean test database
docker compose exec postgres createdb -U maintainex maintainex_test

# 3. Set test URL
export TEST_DATABASE_URL="postgresql://maintainex:maintainex_dev_2025@localhost:5432/maintainex_test"

# 4. Run migration deploy
DATABASE_URL="$TEST_DATABASE_URL" npx prisma migrate deploy

# 5. Verify status
DATABASE_URL="$TEST_DATABASE_URL" npx prisma migrate status

# 6. Count tables
DATABASE_URL="$TEST_DATABASE_URL" psql -U maintainex -d maintainex_test -c "\dt" | wc -l

# 7. Verify Prisma can query
DATABASE_URL="$TEST_DATABASE_URL" npx prisma db execute --stdin <<< "SELECT 1"
```

## Expected Results

| Check | Expected |
|---|---|
| Migration deploy | SUCCESS |
| Migration status | All migrations applied |
| Table count | 122+ tables |
| Prisma query | Returns result |

## Blocking Issue

Docker is not installed on this machine. Integration tests require PostgreSQL.

## Resolution

When Docker is available:
1. `docker compose up -d`
2. Run the procedure above
3. Update this document with actual results

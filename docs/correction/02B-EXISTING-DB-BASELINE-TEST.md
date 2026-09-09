# MaintainEX Existing Database Baseline Test

## Purpose

Simulate baselining an existing production-like PostgreSQL database without data loss.

## Status

**BLOCKED** — No PostgreSQL instance available locally.

## Expected Procedure

```bash
# 1. Create "existing" database with representative data
docker compose exec postgres createdb -U maintainex maintainex_existing

# 2. Push schema to create tables
DATABASE_URL="postgresql://maintainex:maintainex_dev_2025@localhost:5432/maintainex_existing" \
  npx prisma db push  # DEVELOPMENT/TEST ONLY

# 3. Insert representative data
DATABASE_URL="postgresql://maintainex:maintainex_dev_2025@localhost:5432/maintainex_existing" \
  psql -U maintainex -d maintainex_existing -c "
INSERT INTO \"User\" (id, email, \"passwordHash\", name, role, \"createdAt\", \"updatedAt\")
VALUES ('test-user-1', 'test@example.com', 'hash', 'Test User', 'CUSTOMER', NOW(), NOW());
"

# 4. Check migration status (should show unapplied)
DATABASE_URL="postgresql://maintainex:maintainex_dev_2025@localhost:5432/maintainex_existing" \
  npx prisma migrate status

# 5. Mark baseline as applied (without re-running)
DATABASE_URL="postgresql://maintainex:maintainex_dev_2025@localhost:5432/maintainex_existing" \
  npx prisma migrate resolve --applied "20260101000000_baseline"

# 6. Verify status shows clean
DATABASE_URL="postgresql://maintainex:maintainex_dev_2025@localhost:5432/maintainex_existing" \
  npx prisma migrate status

# 7. Verify data preserved
DATABASE_URL="postgresql://maintainex:maintainex_dev_2025@localhost:5432/maintainex_existing" \
  psql -U maintainex -d maintainex_existing -c "SELECT COUNT(*) FROM \"User\""
```

## Expected Results

| Check | Expected |
|---|---|
| Pre-baseline status | Pending migrations |
| After resolve | All migrations applied |
| Data preserved | User count = 1 |
| Tables intact | All 122+ tables present |

## Production Operator Procedure

For real production baselining:

1. **Backup** production database
2. **Mark baseline as applied**:
   ```bash
   prisma migrate resolve --applied "20260101000000_baseline"
   ```
3. **Verify** with `prisma migrate status`
4. **Deploy** future migrations with `prisma migrate deploy`

This does NOT re-run the baseline. It tells Prisma "this schema state already exists."

## Blocking Issue

Docker not available. Results will be updated when PostgreSQL is accessible.

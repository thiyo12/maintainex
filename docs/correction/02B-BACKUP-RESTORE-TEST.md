# MaintainEX Backup & Restore Test

## Status

**BLOCKED** — No PostgreSQL instance available locally.

## Expected Procedure

```bash
# 1. Create test database with representative data
docker compose exec postgres createdb -U maintainex maintainex_backup_test
DATABASE_URL="postgresql://maintainex:maintainex_dev_2025@localhost:5432/maintainex_backup_test" \
  npx prisma db push  # DEVELOPMENT/TEST ONLY

# 2. Insert representative data
docker compose exec postgres psql -U maintainex -d maintainex_backup_test -c "
INSERT INTO \"User\" (id, email, \"passwordHash\", name, role, \"createdAt\", \"updatedAt\")
VALUES ('backup-test-1', 'backup@test.com', 'hash', 'Backup User', 'CUSTOMER', NOW(), NOW());
INSERT INTO \"Category\" (id, name, slug, \"isActive\", \"createdAt\")
VALUES ('backup-cat-1', 'Test Category', 'test-cat', true, NOW());
"

# 3. Create backup
docker compose exec postgres pg_dump -U maintainex maintainex_backup_test > /tmp/backup_test.sql

# 4. Drop and recreate database
docker compose exec postgres dropdb -U maintainex maintainex_backup_test
docker compose exec postgres createdb -U maintainex maintainex_backup_test

# 5. Restore backup
docker compose exec postgres psql -U maintainex -d maintainex_backup_test < /tmp/backup_test.sql

# 6. Verify data
docker compose exec postgres psql -U maintainex -d maintainex_backup_test -c "SELECT COUNT(*) FROM \"User\""
docker compose exec postgres psql -U maintainex -d maintainex_backup_test -c "SELECT COUNT(*) FROM \"Category\""
```

## Expected Results

| Check | Expected |
|---|---|
| Backup creation | SUCCESS |
| Restore | SUCCESS |
| User count after restore | 1 |
| Category count after restore | 1 |
| Schema intact | All tables present |

## Backup Format

- Format: Plain SQL (`pg_dump` default)
- Encoding: UTF-8
- Compression: None (add `| gzip` for compression)

## Production Backup Command

```bash
ssh -i ~/.ssh/id_ed25519_ssaaxcy root@147.93.106.54 \
  "docker exec maintainex-db-maintainex-iwjbmo pg_dump -U postgres postgres > /tmp/backup_$(date +%Y%m%d_%H%M%S).sql"
```

## Blocking Issue

Docker not installed. Results will be updated when PostgreSQL is accessible.

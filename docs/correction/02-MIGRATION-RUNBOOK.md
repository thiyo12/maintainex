# MaintainEX Migration Runbook

## NEW DEVELOPMENT DATABASE

```bash
# 1. Start PostgreSQL
docker compose up -d

# 2. Wait for health check
docker compose exec postgres pg_isready -U maintainex

# 3. Deploy schema using migrations (recommended)
npx prisma migrate deploy

# 4. Generate client
npx prisma generate

# 5. (Optional) Seed data
npx prisma db seed
```

## TEST DATABASE

```bash
# 1. Create test database
docker compose exec postgres createdb -U maintainex maintainex_test

# 2. Deploy schema
DATABASE_URL="postgresql://maintainex:maintainex_dev_2025@localhost:5432/maintainex_test" \
  npx prisma migrate deploy

# 3. Run tests
TEST_DATABASE_URL="postgresql://maintainex:maintainex_dev_2025@localhost:5432/maintainex_test" \
  npm test
```

## EXISTING STAGING DATABASE

```bash
# 1. Backup first
pg_dump -h <host> -U <user> -d <database> > backup_$(date +%Y%m%d).sql

# 2. Check migration status
npx prisma migrate status

# 3. Mark baseline as applied (if needed)
npx prisma migrate resolve --applied "20260101000000_baseline"

# 4. Deploy pending migrations
npx prisma migrate deploy

# 5. Smoke tests
curl -s https://staging.example.com/api/health | jq .
```

## EXISTING PRODUCTION DATABASE

**CRITICAL: Do NOT run `prisma migrate reset` on production.**

### Pre-Deploy Checklist

1. **Backup**
   ```bash
   ssh -i ~/.ssh/id_ed25519_ssaaxcy root@147.93.106.54 \
     "docker exec maintainex-db-maintainex-iwjbmo pg_dump -U postgres postgres > /tmp/backup_$(date +%Y%m%d_%H%M%S).sql"
   ```

2. **Migration Status**
   ```bash
   docker exec <container> npx prisma migrate status
   ```

3. **Mark Baseline (First Time Only)**
   ```bash
   docker exec <container> npx prisma migrate resolve --applied "20260101000000_baseline"
   ```

4. **Deploy**
   ```bash
   # Copy new build
   docker cp build.tar.gz <container>:/tmp/
   docker exec <container> sh -c "cd /tmp && tar xzf build.tar.gz"
   docker exec <container> npx prisma migrate deploy
   docker exec <container> npx prisma generate
   ```

5. **Smoke Tests**
   ```bash
   curl -s https://maintainex.lk/api/health | jq .
   curl -s https://maintainex.lk/api/mobile/auth/me | jq .
   ```

6. **Rollback Decision**
   - If any smoke test fails: restore from backup
   - If migration fails: `prisma migrate resolve --rolled-back <migration_name>`

7. **Monitoring**
   - Watch error rates for 15 minutes
   - Check database connection pool
   - Verify API response times

### Rollback Procedure

```bash
# 1. Stop the service
docker service update --force --image <previous_image> maintainex-mx-vcaohy

# 2. Restore database if needed
docker exec <db_container> psql -U postgres postgres < /tmp/backup_YYYYMMDD.sql

# 3. Verify
curl -s https://maintainex.lk/api/health
```

## MIGRATION FAILURE BEHAVIOR

If `prisma migrate deploy` fails during startup:

1. The application should not start
2. Docker healthcheck will fail
3. Docker Swarm will not route traffic to unhealthy containers
4. Operator must:
   - Check migration status
   - Fix the issue
   - Redeploy

The application does NOT silently start against an incompatible schema.

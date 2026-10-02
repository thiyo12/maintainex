# Production Deployment Runbook

**Version**: 1.0
**Date**: 2026-09-14
**Service**: MaintainEX (`maintainex-mx-vcaohy`)
**Database**: PostgreSQL (`dokploy-postgres`)

---

## Overview

This runbook provides step-by-step instructions for deploying MaintainEX to production via Docker Swarm. Each step includes copy-pasteable commands with explanations.

**Prerequisites**:
- SSH access to VPS (`~/.ssh/id_ed25519`)
- Docker access on VPS
- Local build environment with Node.js 20

---

## Step 1: Pre-Flight Checks

Run these locally to verify the build is ready.

```bash
# 1.1 Verify local build succeeds
npm run build

# 1.2 Verify Prisma client generates
npx prisma generate

# 1.3 Clean macOS resource forks from .next
find .next -name '._*' -type f -delete

# 1.4 Verify the canonical schema is PostgreSQL
grep 'provider' prisma/schema.prisma | head -1
# Expected: provider = "postgresql"
```

**Checkpoint**: Build must succeed and the canonical schema must already show `postgresql`; do not rewrite the provider during deployment.

---

## Step 2: Backup Current Production

SSH into the VPS and back up the running state before deploying.

```bash
# 2.1 SSH into VPS
ssh -i ~/.ssh/id_ed25519 root@<VPS_IP>

# 2.2 Identify current container
docker ps --filter name=maintainex --format "{{.Names}}"
# Output example: maintainex-mx-vcaohy

# 2.3 Backup database
docker exec dokploy-postgres pg_dump -U postgres postgres | gzip > /tmp/maintainex-db-backup-$(date +%Y%m%d-%H%M%S).sql.gz

# 2.4 Backup current container image
docker commit maintainex-mx-vcaohy maintainex-mx-vcaohy:pre-deploy-$(date +%Y%m%d-%H%M%S)

# 2.5 Record current image tag
docker service inspect maintainex-mx-vcaohy --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}'
# Save this output — you need it for rollback
```

**Checkpoint**: Database dump exists. Previous image tag recorded.

---

## Step 3: Build and Package

```bash
# 3.1 Package build artifacts (run locally)
tar czf /tmp/maintainex-build.tar.gz .next package.json package-lock.json prisma public/

# 3.2 Verify tarball contents
tar tzf /tmp/maintainex-build.tar.gz | head -20

# 3.3 SCP tarball to VPS
scp -i ~/.ssh/id_ed25519 /tmp/maintainex-build.tar.gz root@<VPS_IP>:/tmp/
```

**Checkpoint**: Tarball uploaded to VPS `/tmp/maintainex-build.tar.gz`.

---

## Step 4: Deploy to Docker Swarm

```bash
# 4.1 SSH into VPS
ssh -i ~/.ssh/id_ed25519 root@<VPS_IP>

# 4.2 Get container name
CONTAINER=$(docker ps --filter name=maintainex --format "{{.Names}}")
echo "Deploying to: $CONTAINER"

# 4.3 Copy tarball into container
docker cp /tmp/maintainex-build.tar.gz $CONTAINER:/tmp/

# 4.4 Remove old .next directory
docker exec $CONTAINER rm -rf /app/.next

# 4.5 Extract new build
docker exec $CONTAINER tar xzf /tmp/maintainex-build.tar.gz -C /app/

# 4.6 Regenerate Prisma client
docker exec $CONTAINER npx prisma generate

# 4.7 Run pending migrations (if any)
docker exec $CONTAINER npx prisma migrate deploy

# 4.8 Commit container as new image
docker commit $CONTAINER maintainex-mx-vcaohy:prod-latest

# 4.9 Force-update Swarm service to use new image
docker service update --force --image maintainex-mx-vcaohy:prod-latest maintainex-mx-vcaohy
```

**CRITICAL**: `docker service update` WITHOUT `--force` does NOT recreate the container. Always use `--force`.

**Checkpoint**: Service updated. New container running with latest image.

---

## Step 5: Verify Deployment

```bash
# 5.1 Check service status
docker service ps maintainex-mx-vcaohy --format "{{.CurrentState}}"

# 5.2 Check for running tasks
docker service ps maintainex-mx-vcaohy --filter "desired-state=running" --format "{{.ID}} {{.CurrentState}} {{.Error}}"

# 5.3 Verify container is healthy
docker ps --filter name=maintainex --format "{{.Names}} {{.Status}}"

# 5.4 Check application logs for errors
docker logs --tail 50 maintainex-mx-vcaohy 2>&1 | grep -i "error\|fatal\|panic"

# 5.5 Health check
curl -s http://localhost:3000/api/health
# Expected: {"status":"healthy","timestamp":"..."}
```

**Checkpoint**: Service shows "Running", no errors in logs, health returns 200.

---

## Step 6: Smoke Tests

Run these from any machine with internet access.

```bash
# 6.1 Public health endpoint
curl -s https://maintainex.lk/api/health | jq .
# Expected: {"status":"healthy"}

# 6.2 Public catalog (services list)
curl -s https://maintainex.lk/api/mobile/v2/services | jq '.[0]'
# Expected: first service object

# 6.3 Auth rejection (no token)
curl -s -o /dev/null -w "%{http_code}" https://maintainex.lk/api/mobile/v2/jobs
# Expected: 401

# 6.4 Admin auth rejection
curl -s -o /dev/null -w "%{http_code}" https://maintainex.lk/api/admin/users
# Expected: 401

# 6.5 Rate limiting (rapid fire)
for i in $(seq 1 30); do curl -s -o /dev/null -w "%{http_code}\n" https://maintainex.lk/api/health; done | sort | uniq -c
# Expected: mostly 200s, some 429s near end

# 6.6 Test account login (if needed)
curl -s -X POST https://maintainex.lk/api/mobile/v2/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"<TEST_ACCOUNT_EMAIL>","password":"<TEST_ACCOUNT_PASSWORD>"}' | jq '.token'
# Expected: JWT token
```

**Checkpoint**: All smoke tests return expected responses.

---

## Step 7: Rollback Procedure

If anything fails, execute immediately.

```bash
# 7.1 Identify the pre-deploy image tag (from Step 2.5)
# Example: maintainex-mx-vcaohy:pre-deploy-20260914-120000

# 7.2 Roll back container image
docker service update --force --image maintainex-mx-vcaohy:pre-deploy-YYYYMMDD-HHMMSS maintainex-mx-vcaohy

# 7.3 Verify rollback
docker service ps maintainex-mx-vcaohy --format "{{.CurrentState}}"
curl -s https://maintainex.lk/api/health

# 7.4 If database migration needs rollback
docker exec dokploy-postgres psql -U postgres postgres -c "SELECT * FROM _prisma_migrations WHERE finished_at IS NULL ORDER BY started_at DESC LIMIT 5;"
# Then resolve as needed:
# npx prisma migrate resolve --rolled-back <migration_name>
```

**Important**: Database rollbacks require matching application version. Roll back the container first, then handle DB if needed.

---

## Step 8: Post-Deployment Verification

After confirming smoke tests pass, run extended checks.

```bash
# 8.1 Verify all API routes respond
curl -s -o /dev/null -w "%{http_code}" https://maintainex.lk/api/health
curl -s -o /dev/null -w "%{http_code}" https://maintainex.lk/api/mobile/v2/services
curl -s -o /dev/null -w "%{http_code}" https://maintainex.lk/api/mobile/v2/professions
curl -s -o /dev/null -w "%{http_code}" https://maintainex.lk/api/mobile/v2/pricing/estimate

# 8.2 Verify database connectivity
docker exec dokploy-postgres psql -U postgres postgres -c "SELECT COUNT(*) FROM users;"
# Should return row count > 0

# 8.3 Verify container memory and CPU
docker stats --no-stream maintainex-mx-vcaohy
# Expected: memory < 300 MB, CPU < 80%

# 8.4 Verify no migration drift
docker exec maintainex-mx-vcaohy npx prisma migrate status
# Expected: all migrations applied, no pending

# 8.5 Check for any new errors in last 5 minutes
docker logs --since 5m maintainex-mx-vcaohy 2>&1 | grep -c "error\|fatal"
# Expected: 0 or very few (cosmetic warnings acceptable)
```

**Checkpoint**: Extended verification passes. No errors in recent logs.

---

## Step 9: Monitoring Checklist

Monitor for 30 minutes post-deployment.

| Check | Command | Expected |
|-------|---------|----------|
| Health endpoint | `curl https://maintainex.lk/api/health` | `{"status":"healthy"}` |
| Container memory | `docker stats --no-stream` | < 300 MB |
| Container CPU | `docker stats --no-stream` | < 80% |
| Error rate | `docker logs --since 5m \| grep -c error` | 0 |
| Active connections | `docker exec <container> ss -tlnp` | Normal range |
| DB connections | `docker exec dokploy-postgres psql -U postgres postgres -c "SELECT count(*) FROM pg_stat_activity;"` | < 50 |

### Red Flags

If any of these occur, initiate rollback (Step 7):

- Health endpoint returns 500 or times out
- Container memory exceeds 500 MB
- More than 5 errors in 1-minute window
- Database connection pool exhausted
- 5xx errors on public endpoints

---

## Post-Deployment Cleanup

```bash
# Clean up local tarball
rm /tmp/maintainex-build.tar.gz

# Clean up VPS tarball
ssh -i ~/.ssh/id_ed25519 root@<VPS_IP> "rm /tmp/maintainex-build.tar.gz"
```

---

## Emergency Contacts

| Role | Contact |
|------|---------|
| Platform owner | owner@example.invalid |
| VPS | <VPS_IP> |
| Database | dokploy-postgres container |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-09-14 | Initial runbook for Phase 10.9 deployment |

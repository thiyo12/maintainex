# Operations — Deployment

## Docker Build Process

### Multi-Stage Build (`Dockerfile`)

```
Stage 1: installer (node:20-slim)
  → apt-get install: openssl, build-essential, python3
  → npm install --ignore-scripts (for Prisma engine binaries)

Stage 2: builder (node:20-slim)
  → Copies node_modules from installer
  → COPY . .
  → npx prisma generate
  → mkdir -p public/uploads/services
  → npm run build (Next.js production build)

Stage 3: runtime (node:20-slim)
  → apt-get install: openssl, curl
  → Creates non-root user: appuser:appgroup (UID/GID 1001)
  → Copies: node_modules, .next, public, prisma, package.json, next.config.js
  → chown -R appuser:appgroup /app
  → USER appuser
  → HEALTHCHECK: curl -f http://localhost:3000/api/health
  → CMD: npx prisma migrate deploy && npm start
```

**Key properties**:
- Non-root execution (UID 1001)
- Prisma migration runs at container start
- Health check every 30s, 10s timeout, 60s start period, 3 retries
- Production environment: `NODE_ENV=production`, `NEXT_TELEMETRY_DISABLED=1`

## Environment Variables Required

| Variable | Purpose | Required |
|----------|---------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `MARKETPLACE_JWT_SECRET` | Marketplace access-token signing | Yes |
| `STAFF_JWT_SECRET` | Staff/admin access-token signing | Yes |
| `PASSWORD_PEPPER` | Password hashing pepper | Yes |
| `CRON_SECRET` | Scheduled job authentication | Yes |
| `INTERNAL_SYNC_SECRET` | Internal readiness/security synchronization auth | Yes |
| `JWT_SECRET` / `NEXTAUTH_SECRET` | Legacy compatibility where still required | Compatibility-dependent |
| `NODE_ENV` | `production` for prod builds | Yes |
| `APP_RELEASE_SHA` | Git commit SHA for health/status endpoints | Recommended |
| `LOG_LEVEL` | Override default log level | Optional |
| `REDIS_URL` | Redis connection for distributed rate limiting | Optional |
| `MOBILE_CORS_ORIGIN` | CORS origin for mobile API | Optional |
| `BACKUP_DIR` | Backup output directory | Optional |
| `BACKUP_RETENTION_DAYS` | Days to keep backups (default: 30) | Optional |

## Database Migration Strategy

### At Container Start

The Dockerfile CMD runs `npx prisma migrate deploy` before starting the app. This applies all pending migrations automatically.

### Readiness Check

`/api/internal/readiness` verifies no pending migrations remain:

```sql
SELECT COUNT(*) FROM "_prisma_migrations" WHERE "finished_at" IS NULL
```

Returns `503` if migrations are pending.

### Manual Migration

```bash
# Inside running container
docker exec <container> npx prisma migrate deploy

# Generate Prisma client only
docker exec <container> npx prisma generate
```

## Health Check Endpoints

### Liveness: `GET /api/health`

- **No auth** — safe for load balancers
- **Returns**: `{ status: "healthy", timestamp }`
- **Always 200** if process is alive
- **Used by**: Docker HEALTHCHECK, load balancer health probes

### Readiness: `GET /api/internal/readiness`

- **Auth**: `x-internal-sync` header
- **Returns**: `{ status: "ready"|"degraded", checks: { database, migrations }, releaseSha, uptime }`
- **Returns 503** if database unreachable or migrations pending
- **Used by**: Orchestrator readiness probes

## Rollback Procedure

### Container-Level Rollback

```bash
# 1. Identify previous image tag
docker service inspect maintainex-mx-vcaohy --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}'

# 2. Update to previous image
docker service update --force --image <previous-image> maintainex-mx-vcaohy

# 3. Verify
docker service ps maintainex-mx-vcaohy
curl http://localhost:3000/api/health
```

### Database Rollback

If a migration must be reverted:

```bash
# List migrations
npx prisma migrate status

# Resolve specific migration (sets as applied without running)
npx prisma migrate resolve --applied <migration_name>

# Or mark as rolled back
npx prisma migrate resolve --rolled-back <migration_name>
```

**Important**: Database rollbacks require application rollback to match the schema state.

### Full Rollback Sequence

1. Stop accepting traffic (load balancer drain)
2. Roll back database if needed (`prisma migrate resolve`)
3. Roll back container image (`docker service update --force --image`)
4. Verify readiness: `GET /api/internal/readiness`
5. Verify liveness: `GET /api/health`
6. Resume traffic

## Pre-Deployment Checklist

- [ ] `APP_RELEASE_SHA` set to current commit
- [ ] `DATABASE_URL` accessible from container network
- [ ] `MARKETPLACE_JWT_SECRET` set
- [ ] `STAFF_JWT_SECRET` set
- [ ] `PASSWORD_PEPPER` set
- [ ] `CRON_SECRET` set
- [ ] `INTERNAL_SYNC_SECRET` set
- [ ] Canonical schema remains `provider = "postgresql"`
- [ ] `.next` directory cleaned of macOS resource forks: `find .next -name '._*' -type f -delete`
- [ ] `npm run build` succeeds locally
- [ ] `npx prisma generate` succeeds
- [ ] Docker image builds without errors
- [ ] Health check passes: `curl http://localhost:3000/api/health`
- [ ] Readiness check passes: `curl http://localhost:3000/api/internal/readiness -H "x-internal-sync: $SECRET"`
- [ ] Dedicated non-privileged production smoke account works; credentials are managed outside Git

## Deployment Trigger Policy

Only one production activation path may be active for a release:

1. **Dokploy auto-deploy from `main`** — if enabled, merging the release PR is the deploy trigger. Complete credential rotation, backup, rollback capture, and environment verification **before merge**. Do not run `deploy-rsync.sh` in parallel.
2. **Manual immutable deployment** — pause/disable the Dokploy `main` auto-deploy first, then run `deploy-rsync.sh` from the exact merged `main` commit.

Never combine both paths for the same release.

## Deploy Script (`deploy-rsync.sh`)

Automated deployment via rsync to VPS:
1. Rsync source to VPS staging
2. Copy source into the current app container
3. Generate Prisma client and run the production build
4. Commit the validated container and force-update the Swarm service
5. Container startup runs `prisma migrate deploy` before `npm start`

**Manual deployment steps** (per `AGENTS.md`):

```bash
# 1. Clean macOS resource forks
find .next -name '._*' -type f -delete

# 2. Verify canonical PostgreSQL provider
grep 'provider = "postgresql"' prisma/schema.prisma

# 3. Package
tar czf /tmp/maintainex-build.tar.gz .next package.json package-lock.json prisma public/

# 4. SCP to VPS
scp /tmp/maintainex-build.tar.gz root@<VPS_IP>:/tmp/

# 5. On VPS
docker ps --filter name=maintainex --format "{{.Names}}"
docker cp /tmp/maintainex-build.tar.gz <container>:/tmp/
docker exec <container> rm -rf /app/.next
docker exec <container> tar xzf /tmp/maintainex-build.tar.gz -C /app/
docker exec <container> npx prisma generate
docker commit <container> maintainex-mx-vcaohy:prod-latest
docker service update --force --image maintainex-mx-vcaohy:prod-latest maintainex-mx-vcaohy

```

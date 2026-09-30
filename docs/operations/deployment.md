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
| `JWT_SECRET` / `NEXTAUTH_SECRET` | JWT signing key (used for both admin and mobile) | Yes |
| `INTERNAL_SYNC_SECRET` | Auth for internal API endpoints (readiness, IP blocklist) | Yes |
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
- [ ] `JWT_SECRET` / `NEXTAUTH_SECRET` set
- [ ] `INTERNAL_SYNC_SECRET` set
- [ ] Local schema has `provider = "postgresql"` (not `sqlite`)
- [ ] `.next` directory cleaned of macOS resource forks: `find .next -name '._*' -type f -delete`
- [ ] `npm run build` succeeds locally
- [ ] `npx prisma generate` succeeds
- [ ] Docker image builds without errors
- [ ] Health check passes: `curl http://localhost:3000/api/health`
- [ ] Readiness check passes: `curl http://localhost:3000/api/internal/readiness -H "x-internal-sync: $SECRET"`
- [ ] Known test account works: `test@test.com` / `test123`

## Deploy Script (`deploy-rsync.sh`)

Automated deployment via rsync to VPS:
1. Build locally
2. Rsync artifacts to VPS
3. Rebuild Docker image
4. Update Swarm service

**Manual deployment steps** (per `AGENTS.md`):

```bash
# 1. Clean macOS resource forks
find .next -name '._*' -type f -delete

# 2. Set schema provider
sed -i '' 's/provider = "sqlite"/provider = "postgresql"/' prisma/schema.prisma

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

# 6. Revert schema locally
sed -i '' 's/provider = "postgresql"/provider = "sqlite"/' prisma/schema.prisma
```

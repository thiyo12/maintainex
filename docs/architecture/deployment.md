# Deployment Architecture

Docker Swarm deployment, container structure, networking, secrets, and health checks.

---

## Overview

MaintainEX is deployed as a Docker Swarm service on a single VPS. PostgreSQL runs in a separate Docker container managed by Dokploy. Cloudflare provides TLS termination and CDN.

---

## Infrastructure

```mermaid
graph TB
    subgraph Internet
        Users["Users\n(Mobile + Web)"]
        CF["Cloudflare\n(CDN + TLS)"]
    end

    subgraph VPS["VPS"]
        subgraph Swarm["Docker Swarm"]
            Traefik["Traefik\n(Reverse Proxy)"]
            NextJS["maintainex-mx\n(Next.js App)\nPort 3000"]
        end
        subgraph Dokploy["Dokploy Managed"]
            Postgres["dokploy-postgres\n(PostgreSQL 16)\nPort 5432"]
        end
    end

    Users --> CF
    CF -->|"HTTPS"| Traefik
    Traefik -->|"HTTP"| NextJS
    NextJS -->|"TCP"| Postgres

    style VPS fill:#16213e,stroke:#0f3460,color:#fff
    style Swarm fill:#1a1a2e,stroke:#e94560,color:#fff
    style Dokploy fill:#533483,stroke:#e94560,color:#fff
```

---

## Docker Configuration

### Dockerfile (Multi-Stage Build)

Defined in `Dockerfile` (32 lines):

| Stage | Base Image | Purpose |
|---|---|---|
| `installer` | `node:20-slim` | Install dependencies |
| `builder` | `node:20-slim` | Build Next.js application |
| `runtime` | `node:20-slim` | Production runtime |

### Runtime Container

| Property | Value |
|---|---|
| User | `appuser` (UID 1001) |
| Group | `appgroup` (GID 1001) |
| Port | 3000 |
| Working Dir | `/app` |
| Environment | `NODE_ENV=production`, `NEXT_TELEMETRY_DISABLED=1` |

### Health Check

```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1
```

- Interval: 30 seconds
- Timeout: 10 seconds
- Start period: 60 seconds (warm-up)
- Retries: 3 consecutive failures = unhealthy

### Startup Command

```dockerfile
CMD npx prisma migrate deploy && npm start
```

Runs Prisma migrations on container start, then starts Next.js.

---

## Docker Compose (Development)

Defined in `docker-compose.yml`:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: maintainex-postgres
    ports: ['5432:5432']
    environment:
      POSTGRES_DB: maintainex
      POSTGRES_USER: maintainex
      POSTGRES_PASSWORD: maintainex_dev_2025
    volumes: [postgres_data:/var/lib/postgresql/data]
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U maintainex -d maintainex']
      interval: 5s
      timeout: 5s
      retries: 5
```

---

## Deployment Process

### Build Steps

1. Clean macOS resource forks:
   ```bash
   find .next -name '._*' -type f -delete
   ```

2. Verify Prisma remains PostgreSQL:
   ```bash
   grep 'provider = "postgresql"' prisma/schema.prisma
   ```

3. Create build tarball:
   ```bash
   tar czf /tmp/maintainex-build.tar.gz .next package.json package-lock.json prisma public/
   ```

4. SCP to VPS:
   ```bash
   scp -i ~/.ssh/id_ed25519_ssaaxcy /tmp/maintainex-build.tar.gz root@<VPS_IP>:/tmp/
   ```

### Deploy Steps

1. Find container:
   ```bash
   docker ps --filter name=maintainex-mx-vcaohy --format "{{.Names}}"
   ```

2. Copy tarball into container:
   ```bash
   docker cp /tmp/maintainex-build.tar.gz <container>:/tmp/
   ```

3. Clean and extract:
   ```bash
   docker exec <container> rm -rf /app/.next
   docker exec <container> tar xzf /tmp/maintainex-build.tar.gz -C /app/
   docker exec <container> npx prisma generate
   ```

4. Commit and update:
   ```bash
   docker commit <container> maintainex-mx-vcaohy:prod-latest
   docker service update --force --image maintainex-mx-vcaohy:prod-latest maintainex-mx-vcaohy
   ```

---

## Critical Deployment Gotchas

| Issue | Impact | Prevention |
|---|---|---|
| Prisma provider differs from `postgresql` | New containers fail to connect to PostgreSQL | Treat `prisma/schema.prisma` as canonical PostgreSQL and validate before deploy |
| `docker service update` without `--force` | Container not recreated, old code runs | Always use `--force` flag |
| `docker cp` merges files | Old `.next` artifacts remain | Always `rm -rf /app/.next` first |
| `docker restart` | Swarm recreates from old image | Use `docker commit` + `docker service update --image` |

---

## Networking

| Path | Protocol | Port | Exposure |
|---|---|---|---|
| Cloudflare -> Traefik | HTTPS | 443 | External |
| Traefik -> Next.js | HTTP | 3000 | Internal (Swarm network) |
| Next.js -> PostgreSQL | TCP | 5432 | Internal (Docker network) |

### Service Discovery

Docker Swarm provides built-in service discovery. Services communicate via service names:
- `maintainex-mx` -> Next.js app
- `dokploy-postgres` -> PostgreSQL

---

## Secrets Management

All secrets stored as environment variables in Docker service configuration:

| Secret | Variable | Source |
|---|---|---|
| Database URL | `DATABASE_URL` | Docker service env |
| JWT Secret | `JWT_SECRET` | Docker service env |
| Marketplace JWT | `MARKETPLACE_JWT_SECRET` | Docker service env |
| Staff JWT | `STAFF_JWT_SECRET` | Docker service env |
| NextAuth Secret | `NEXTAUTH_SECRET` | Docker service env |

Secrets are never committed to the repository or embedded in images.

---

## Monitoring

### Health Checks

- Application: `GET /api/health` (every 30s)
- PostgreSQL: `pg_isready` (every 5s in dev)

### Logs

```bash
docker service logs maintainex-mx-vcaohy --tail 100 -f
```

### Container Status

```bash
docker ps --filter name=maintainex-mx-vcaohy
docker inspect <container> --format '{{.State.Health.Status}}'
```

---

## Rollback

If deployment fails:

1. Identify last working image:
   ```bash
   docker images | grep maintainex-mx
   ```

2. Roll back:
   ```bash
   docker service update --force --image maintainex-mx-vcaohy:<previous-tag> maintainex-mx-vcaohy
   ```

---

## Local Development

1. Start PostgreSQL:
   ```bash
   docker compose up -d
   ```

2. Set environment:
   ```bash
   DATABASE_URL="postgresql://maintainex:maintainex_dev_2025@localhost:5432/maintainex"
   ```

3. Run migrations:
   ```bash
   npx prisma migrate dev
   ```

4. Start dev server:
   ```bash
   npm run dev
   ```

---

## References

- Dockerfile: `Dockerfile`
- Docker Compose: `docker-compose.yml`
- Prisma schema: `prisma/schema.prisma`
- Security: [security-layers.md](./security-layers.md)
- Concurrency: [concurrency.md](./concurrency.md)

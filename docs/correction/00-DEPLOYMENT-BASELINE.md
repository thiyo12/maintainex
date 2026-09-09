# MaintainEX Deployment Baseline

## Deployment Methods

| Method | Target | Trigger | Status |
|---|---|---|---|
| Dokploy/Nixpacks | VPS (147.93.106.54) | Git push to main | Active |
| Docker manual | VPS | Manual build + push | Active |
| Vercel | Web only | Git push | Active |
| Expo/EAS | Mobile | Manual export | Not configured |

## VPS Infrastructure

| Component | Value |
|---|---|
| IP | `147.93.106.54` |
| SSH key | `~/.ssh/id_ed25519_ssaaxcy` |
| Container | `maintainex-mx-vcaohy:prod-slim7` |
| Database container | `maintainex-db-maintainex-iwjbmo` |
| DB password | `ba29bc6e06e48c5b702d0f4a8b224a6d088be43ec949c8e3` |
| Known-good env | `/tmp/maint.service.env` |
| App URL | `https://maintainex.lk` |
| Health check | `GET /api/health` → 200 OK |

## Docker Deployment

```bash
# Build
docker build -t maintainex .

# Push to registry
docker push maintainex:latest

# Activate in Dokploy dashboard
# Or manually:
docker stop maintainex-mx-vcaohy
docker rm maintainex-mx-vcaohy
docker run -d --name maintainex-mx-vcaohy --env-file /tmp/maint.service.env -p 3000:3000 maintainex:latest
```

## Vercel Deployment

| Setting | Value |
|---|---|
| Framework | Next.js |
| Build command | `npx prisma generate && next build` |
| Output directory | `.next` |
| Node version | 20 |
| Cron jobs | 9 scheduled functions |

## Rollback Procedure

1. **Dokploy:** Activate previous image in dashboard
2. **Docker:** `docker run` with previous image tag
3. **Vercel:** Rollback to previous deployment in dashboard

## Known Deployment Issues

1. **Dokploy env source unknown** — Why does Dokploy store wrong DB password?
2. ~~**Docker CMD runs `prisma db push` on every start** — Breaking schema change = service down~~ **RESOLVED** — CMD now uses `prisma migrate deploy`
3. **No automated rollback** — Manual intervention required
4. **No health check integration** — Docker healthcheck not configured

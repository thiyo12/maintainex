# Operations Runbook

Day-2 operations: monitoring, alerts, scaling, backup, and disaster recovery for MaintainEX.

---

## Monitoring

### Health Checks

| Check | Endpoint | Interval | Alert Threshold |
|-------|----------|----------|-----------------|
| HTTP health | `GET /api/health` | 60s | 3 consecutive failures |
| Database connectivity | Prisma `$queryRaw` | 30s | 2 consecutive failures |
| Docker container | `docker inspect` | 60s | Container not running |
| Disk usage | `df -h` | 300s | > 85% utilization |
| Memory usage | `free -m` | 60s | > 90% utilization |

### Key Metrics

| Metric | Source | Warning | Critical |
|--------|--------|---------|----------|
| Request latency (p95) | Traefik access logs | > 2s | > 5s |
| Error rate (5xx) | Traefik access logs | > 1% | > 5% |
| Active DB connections | `pg_stat_activity` | > 80 | > 95 |
| Queue depth (jobs) | `MarketplaceJob` count by status | > 100 OPEN | > 500 OPEN |
| Failed login rate | `LoginActivity` table | > 10/min | > 50/min |

### Log Locations

| Service | Log Location | Rotation |
|---------|-------------|----------|
| Next.js app | Docker stdout/stderr | Docker log driver |
| PostgreSQL | `/var/lib/docker/volumes/.../pg_log/` | Manual |
| Traefik | `/var/log/traefik/` | logrotate daily |
| Cloudflare | Dashboard > Logs | 7-day retention |

---

## Alerts

### Alert Severity Levels

| Level | Response Time | Notification |
|-------|--------------|--------------|
| P1 Critical | 15 minutes | SMS + Slack + Email |
| P2 High | 1 hour | Slack + Email |
| P3 Medium | 4 hours | Email |
| P4 Low | Next business day | Ticket |

### Alert Rules

| Alert | Condition | Severity |
|-------|-----------|----------|
| Service down | Health check fails 3x | P1 |
| Database unreachable | Connection fails 2x | P1 |
| Disk full | > 95% utilization | P1 |
| Error spike | 5xx rate > 5% for 5 min | P2 |
| Slow responses | p95 > 5s for 5 min | P2 |
| SSL expiry | < 7 days to expiry | P2 |
| Failed logins | > 50/min from single IP | P3 |
| Queue backlog | > 100 OPEN jobs | P3 |

---

## Scaling

### Current Architecture

Single VPS deployment with Docker Swarm. No auto-scaling.

### Vertical Scaling

When to scale up:
- Database connections consistently > 80
- Memory usage consistently > 80%
- Response latency p95 > 2s sustained

Scaling steps:
1. Stop Docker services
2. Resize VPS (add CPU/RAM)
3. Restart services
4. Verify health checks pass
5. Monitor for 24 hours

### Horizontal Scaling

For future multi-node:
1. Add worker nodes to Docker Swarm
2. Deploy PostgreSQL to dedicated node
3. Add Redis for session/cache layer
4. Configure Traefik for load balancing across nodes

### Database Scaling

Current: single PostgreSQL instance.
Future options:
- Read replicas for analytics queries
- Connection pooling via PgBouncer
- Table partitioning for `LedgerEntry`, `MarketplaceJob` at 10M+ rows

---

## Backup & Recovery

### Backup Schedule

| Component | Method | Frequency | Retention |
|-----------|--------|-----------|-----------|
| PostgreSQL | `pg_dump` | Daily 02:00 UTC | 30 days |
| PostgreSQL WAL | Continuous archiving | Continuous | 7 days |
| Application config | Git repository | On change | Indefinite |
| Docker images | Registry push | On deploy | Last 10 versions |
| Secrets | Encrypted file | On change | Last 5 versions |

### Backup Verification

Weekly backup restore test:
1. Pull latest backup from storage
2. Restore to isolated PostgreSQL instance
3. Run smoke test queries
4. Verify row counts match production (within 1%)
5. Document results in operations log

### Recovery Procedures

#### Database Recovery

```bash
# Stop app container
docker service update --scale mx=0 maintainex-mx-vcaohy

# Restore database
docker exec -i dokploy-postgres pg_restore -U postgres -d postgres < backup.dump

# Verify data
docker exec dokploy-postgres psql -U postgres -c "SELECT COUNT(*) FROM users;"

# Restart app
docker service update --scale mx=1 maintainex-mx-vcaohy
```

#### Full VPS Recovery

1. Provision new VPS with SSH key
2. Install Docker and Docker Swarm
3. Pull Docker image from registry
4. Restore database from backup
5. Copy secrets and config
6. Start services
7. Update DNS records
8. Verify health checks

**Target RTO**: 4 hours
**Target RPO**: 1 hour (WAL archiving)

---

## Incident Response

### Severity Classification

| Severity | Definition | Example |
|----------|-----------|---------|
| P1 | Complete service outage | Database down, app container crashed |
| P2 | Major feature broken | Payments failing, matching engine down |
| P3 | Minor feature degraded | Slow responses, non-critical errors |
| P4 | Cosmetic or low-impact | UI glitch, non-urgent bug |

### Response Steps

1. **Detect**: Monitoring alert or user report
2. **Triage**: Assess severity, identify affected systems
3. **Mitigate**: Restart service, rollback deploy, or apply hotfix
4. **Resolve**: Root cause fix, not just symptom treatment
5. **Post-mortem**: Document timeline, root cause, action items

### Common Incidents

| Incident | Likely Cause | Resolution |
|----------|-------------|------------|
| App won't start | Prisma generate failed after deploy | Re-run `npx prisma generate` in container |
| Database connection refused | Connection limit reached | Kill idle connections, restart PgBouncer |
| Mobile 401 errors | JWT secret rotated without notice | Ensure `NEXTAUTH_SECRET` matches across services |
| Slow matching | Large candidate pool | Check `MatchingConfig` wave sizes, add DB indexes |

---

## Deployment Checklist

Pre-deployment:
- [ ] All tests passing in CI
- [ ] Staging deployment verified
- [ ] Database migration tested
- [ ] Secrets updated if needed

Deployment:
- [ ] Build `.next` output
- [ ] Clean macOS resource forks (`find .next -name '._*' -type f -delete`)
- [ ] Verify `provider = "postgresql"` in schema for tarball
- [ ] SCP tarball to VPS
- [ ] Stop old container, remove `.next`, extract tarball
- [ ] Run `npx prisma generate`
- [ ] `docker commit` + `docker service update --force --image`
- [ ] Revert schema to SQLite locally

Post-deployment:
- [ ] Health check passes
- [ ] Smoke test critical paths
- [ ] Monitor error rates for 30 minutes
- [ ] Notify team of deployment
